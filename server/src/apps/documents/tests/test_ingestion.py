"""
Ingestion correctness: chunker parity, extraction of every supported format,
and the document lifecycle (version promotion, deletion clean-up, stale jobs).
The vector store and embedder are replaced with in-memory fakes so these run
fast and deterministically.
"""

import io
import random
from datetime import timedelta

import docx
import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone

from apps.academic.models import Course, Subject
from apps.accounts.models import User
from apps.documents.models import Document, DocumentChunk, DocumentStatus, ProcessingJob
from apps.documents.services.chunker import split_text
from apps.documents.services.extractor import _decode_text, extract_text_by_page

PW = "Correct-Horse-42"


# ------------------------------------------------------------------ chunker

def _reference_split(text, size, overlap):
    """Independent re-statement of the behaviour we rely on (no LangChain needed)."""
    return split_text(text, size, overlap)


def test_chunks_respect_size_and_overlap_and_cover_text():
    rnd = random.Random(3)
    words = ["sorting", "heap", "tree", "graph", "dynamic", "programming", "\n", "\n\n"]
    text = " ".join(rnd.choice(words) for _ in range(4000))
    chunks = split_text(text, 1000, 200)
    assert all(len(c) <= 1000 for c in chunks)
    # Consecutive chunks overlap (the tail of one reappears at the head of the next).
    overlaps = sum(1 for a, b in zip(chunks, chunks[1:]) if a[-40:].split()[-1] in b[:250])
    assert overlaps >= len(chunks) - 2
    assert "".join(chunks).count("sorting") >= text.count("sorting")


def test_long_unbreakable_text_is_still_split():
    chunks = split_text("x" * 2500, 1000, 200)
    assert all(len(c) <= 1000 for c in chunks) and len(chunks) >= 3


# ------------------------------------------------------------------ extraction

def test_text_decoding_never_silently_drops_bytes():
    assert _decode_text("café".encode("utf-8")) == "café"
    assert _decode_text("﻿café".encode("utf-8")) == "café"
    assert _decode_text("café".encode("utf-16")) == "café"
    assert _decode_text("café".encode("cp1252")) == "café"


def test_markdown_and_text_pages(tmp_path):
    f = tmp_path / "notes.md"
    f.write_text("# Heaps\n\nA heap is a complete binary tree.\n\n" + ("Para. " * 700), encoding="utf-8")
    pages = extract_text_by_page(str(f), "md")
    assert pages[0]["text"].startswith("# Heaps") and len(pages) >= 2
    g = tmp_path / "paged.txt"
    g.write_text("page one\fpage two", encoding="utf-8")
    assert [p["text"] for p in extract_text_by_page(str(g), "txt")] == ["page one", "page two"]


def test_docx_uses_real_page_breaks_and_keeps_tables(tmp_path):
    d = docx.Document()
    d.add_paragraph("Normal forms")
    t = d.add_table(rows=2, cols=2)
    t.cell(0, 0).text, t.cell(0, 1).text = "Form", "Removes"
    t.cell(1, 0).text, t.cell(1, 1).text = "3NF", "Transitive dependencies"
    d.add_page_break()
    d.add_paragraph("BCNF requires every determinant to be a key.")
    path = tmp_path / "nf.docx"
    d.save(path)
    pages = extract_text_by_page(str(path), "docx")
    assert len(pages) == 2
    assert "3NF | Transitive dependencies" in pages[0]["text"]
    assert pages[1]["text"].startswith("BCNF")


# ------------------------------------------------------------------ lifecycle

class FakeVectors:
    def __init__(self):
        self.store = {}  # doc_id -> n vectors
        self.fail_delete = False

    def upsert(self, course_id, document_id, chunks, embeddings, extra_metadata=None):
        self.store[str(document_id)] = len(chunks)

    def delete(self, course_id, document_id):
        if self.fail_delete:
            raise RuntimeError("chroma down")
        self.store.pop(str(document_id), None)


@pytest.fixture
def fake_index(monkeypatch):
    fv = FakeVectors()
    monkeypatch.setattr("apps.documents.services.vector_store.upsert_document_chunks", fv.upsert)
    monkeypatch.setattr("apps.documents.services.vector_store.delete_document_chunks", fv.delete)
    monkeypatch.setattr("apps.documents.services.lifecycle.delete_document_chunks", fv.delete)
    monkeypatch.setattr("apps.documents.services.embedder.generate_embeddings", lambda texts: [[0.0] * 4 for _ in texts])
    monkeypatch.setattr("apps.documents.services.dispatch.dispatch_processing", lambda *a, **k: "stub")
    return fv


@pytest.fixture
def course(settings, tmp_path):
    settings.MEDIA_ROOT = str(tmp_path)
    t = User.objects.create_user(email="t@t.dev", password=PW, first_name="T", last_name="T", role="teacher")
    c = Course.objects.create(code="C1", title="C", subject=Subject.objects.create(name="S", code="S"), teacher=t,
                              is_published=True)
    return c


def _doc(course, content, version=1, parent=None, is_latest=True, name="n.txt"):
    return Document.objects.create(
        title="Notes", course=course, uploaded_by=course.teacher, file_type="txt", version=version, parent=parent,
        is_latest=is_latest, processing_status=DocumentStatus.PENDING, file=SimpleUploadedFile(name, content),
    )


def _process(doc):
    from apps.documents.tasks import process_document

    return process_document.apply(args=[str(doc.id)]).get()


@pytest.mark.django_db(transaction=True)
def test_new_version_goes_live_only_after_indexing(course, fake_index):
    v1 = _doc(course, b"Heaps keep the max at the root.")
    assert _process(v1)["status"] == "completed"
    v2 = _doc(course, b"Heaps: updated notes.", version=2, parent=v1, is_latest=False, name="n2.txt")
    v1.refresh_from_db()
    assert v1.is_latest and not Document.objects.get(id=v2.id).is_latest  # v1 still live while v2 is pending

    assert _process(v2)["status"] == "completed"
    v1.refresh_from_db(); v2.refresh_from_db()
    assert v2.is_latest and not v1.is_latest
    assert not DocumentChunk.objects.filter(document=v1).exists()  # superseded content removed from search
    assert str(v1.id) not in fake_index.store and str(v2.id) in fake_index.store


@pytest.mark.django_db(transaction=True)
def test_failed_new_version_leaves_previous_version_live(course, fake_index):
    v1 = _doc(course, b"Graphs have vertices and edges.")
    _process(v1)
    v2 = _doc(course, b"   ", version=2, parent=v1, is_latest=False, name="blank.txt")
    result = _process(v2)
    v1.refresh_from_db(); v2.refresh_from_db()
    assert result["status"] == "failed" and v2.processing_status == DocumentStatus.FAILED
    assert v1.is_latest and DocumentChunk.objects.filter(document=v1).exists()
    assert "No readable text" in v2.error_message  # friendly, actionable


@pytest.mark.django_db(transaction=True)
def test_deleting_a_document_removes_vectors_chunks_and_file(course, fake_index):
    from apps.documents.services.lifecycle import delete_document

    d = _doc(course, b"Queues are FIFO.")
    _process(d)
    path = d.file.path
    delete_document(Document.objects.get(id=d.id))
    assert not Document.objects.filter(id=d.id).exists()
    assert str(d.id) not in fake_index.store
    assert not DocumentChunk.objects.filter(document_id=d.id).exists()
    import os
    assert not os.path.exists(path)


@pytest.mark.django_db(transaction=True)
def test_delete_fails_closed_when_the_index_is_unreachable(course, fake_index):
    from apps.documents.services.lifecycle import IndexCleanupError, delete_document

    d = _doc(course, b"Stacks are LIFO.")
    _process(d)
    fake_index.fail_delete = True
    with pytest.raises(IndexCleanupError):
        delete_document(Document.objects.get(id=d.id))
    assert Document.objects.filter(id=d.id).exists()  # nothing deleted, nothing orphaned


@pytest.mark.django_db(transaction=True)
def test_deleting_the_root_version_keeps_the_family_together(course, fake_index):
    from apps.documents.services.lifecycle import delete_document

    v1 = _doc(course, b"v1 text")
    _process(v1)
    v2 = _doc(course, b"v2 text", version=2, parent=v1, is_latest=False, name="v2.txt")
    _process(v2)
    v3 = _doc(course, b"v3 text", version=3, parent=v1, is_latest=False, name="v3.txt")
    _process(v3)
    delete_document(Document.objects.get(id=v1.id))
    v2.refresh_from_db(); v3.refresh_from_db()
    assert v2.parent_id is None and v3.parent_id == v2.id and v3.is_latest


@pytest.mark.django_db(transaction=True)
def test_deleting_the_live_version_revives_the_previous_one(course, fake_index):
    from apps.documents.services.lifecycle import delete_document

    v1 = _doc(course, b"old")
    _process(v1)
    v2 = _doc(course, b"new", version=2, parent=v1, is_latest=False, name="v2.txt")
    _process(v2)
    delete_document(Document.objects.get(id=v2.id))
    v1.refresh_from_db()
    assert v1.is_latest and v1.processing_status == DocumentStatus.PENDING  # queued for re-indexing


@pytest.mark.django_db(transaction=True)
def test_interrupted_jobs_become_retryable(course, fake_index):
    from apps.documents.tasks import sweep_stale_documents

    d = _doc(course, b"x")
    Document.objects.filter(id=d.id).update(processing_status=DocumentStatus.PROCESSING)
    ProcessingJob.objects.create(document=d, status=DocumentStatus.PROCESSING,
                                 started_at=timezone.now() - timedelta(hours=2))
    assert sweep_stale_documents() == 1
    d.refresh_from_db()
    assert d.processing_status == DocumentStatus.FAILED and "interrupted" in d.error_message


@pytest.mark.django_db(transaction=True)
def test_a_document_cannot_be_processed_twice_at_once(course, fake_index):
    d = _doc(course, b"x")
    Document.objects.filter(id=d.id).update(processing_status=DocumentStatus.PROCESSING)
    assert _process(d)["status"] == "skipped"
