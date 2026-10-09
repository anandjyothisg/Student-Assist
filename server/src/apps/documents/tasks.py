"""
SmartStudent AI — Document Processing Task

A document is only searchable once processing has fully succeeded:

  PENDING → (claimed) PROCESSING → COMPLETED   promoted to the live version
                                  → FAILED      the previous version stays live

Runs under Celery, in a background thread or inline (see services/dispatch.py).
"""

import logging
from datetime import timedelta

from celery import shared_task
from django.conf import settings
from django.db import models, transaction
from django.utils import timezone

logger = logging.getLogger("apps.documents")


class PermanentProcessingError(Exception):
    """The file itself can't be indexed; retrying won't help."""


def friendly_error(exc: Exception) -> str:
    """A short, actionable message for teachers. Technical detail stays in the log and ProcessingJob."""
    if isinstance(exc, PermanentProcessingError):
        return str(exc)
    text = str(exc).lower()
    if "password" in text or "encrypt" in text:
        return "This file is password-protected. Remove the password and upload it again."
    if any(k in text for k in ("cannot open", "broken", "corrupt", "not a zip", "bad zip", "file has not been decrypted")):
        return "This file couldn't be opened. It may be corrupted; try exporting it again."
    return "Processing failed unexpectedly. Try again, and re-export the file if it keeps failing."


def stale_cutoff():
    return timezone.now() - timedelta(minutes=getattr(settings, "DOCUMENT_STALE_MINUTES", 20))


def sweep_stale_documents(queryset=None) -> int:
    """
    Jobs run in a background thread die with the server process. Anything still
    marked PROCESSING long after it started was interrupted: mark it FAILED so
    the teacher can retry instead of watching a spinner forever.
    """
    from apps.documents.models import Document, DocumentStatus

    qs = (queryset if queryset is not None else Document.objects.all()).filter(
        processing_status=DocumentStatus.PROCESSING
    ).filter(models.Q(processing_job__started_at__lt=stale_cutoff()) | models.Q(processing_job__isnull=True,
                                                                                 updated_at__lt=stale_cutoff()))
    n = qs.update(
        processing_status=DocumentStatus.FAILED,
        error_message="Processing was interrupted (the server restarted). Retry to index this file.",
        updated_at=timezone.now(),
    )
    if n:
        logger.warning(f"[process_document] Marked {n} interrupted document(s) as failed.")
    return n


def _family(document):
    from apps.documents.models import Document

    root_id = document.parent_id or document.id
    return Document.objects.filter(models.Q(id=root_id) | models.Q(parent_id=root_id))


def promote_version(document) -> list:
    """
    Make a freshly indexed document the live version of its family, unless a
    newer version is already live. Returns the ids whose index entries are now
    stale (superseded versions), for the caller to clean up after commit.
    """
    from apps.documents.models import DocumentChunk, DocumentStatus

    family = _family(document).select_for_update()
    newer_live = family.exclude(id=document.id).filter(
        is_latest=True, version__gt=document.version, processing_status=DocumentStatus.COMPLETED
    ).exists()
    if newer_live:
        # An older version was re-processed after a newer one went live: keep it out of search.
        DocumentChunk.objects.filter(document=document).delete()
        type(document).objects.filter(id=document.id).update(is_latest=False)
        return [document.id]

    superseded = list(family.exclude(id=document.id).values_list("id", flat=True))
    family.exclude(id=document.id).update(is_latest=False)
    type(document).objects.filter(id=document.id).update(is_latest=True)
    DocumentChunk.objects.filter(document_id__in=superseded).delete()
    return superseded


@shared_task(bind=True, max_retries=3, default_retry_delay=60, name="documents.process_document")
def process_document(self, document_id: str) -> dict:
    """
    Extract → chunk → embed → store, then promote the document to the live version.
    """
    from apps.documents.models import Document, DocumentChunk, DocumentStatus, ProcessingJob
    from apps.documents.services.chunker import split_text_into_chunks as split_into_chunks
    from apps.documents.services.embedder import generate_embeddings
    from apps.documents.services.extractor import extract_text_by_page
    from apps.documents.services.vector_store import delete_document_chunks, upsert_document_chunks

    # Claim the document so two dispatches can't process it at the same time.
    claimed = Document.objects.filter(id=document_id).exclude(processing_status=DocumentStatus.PROCESSING).update(
        processing_status=DocumentStatus.PROCESSING, updated_at=timezone.now()
    )
    if not claimed:
        if not Document.objects.filter(id=document_id).exists():
            logger.error(f"[process_document] Document {document_id} not found.")
            return {"status": "error", "detail": "Document not found."}
        logger.info(f"[process_document] Document {document_id} is already being processed; skipping.")
        return {"status": "skipped", "document_id": document_id}

    document = Document.objects.select_related("course", "topic__unit").get(id=document_id)
    job, _ = ProcessingJob.objects.get_or_create(document=document)
    job.status = DocumentStatus.PROCESSING
    job.celery_task_id = self.request.id or ""
    job.started_at = timezone.now()
    job.save(update_fields=["status", "celery_task_id", "started_at"])
    logger.info(f"[process_document] Processing document {document_id} (type={document.file_type})")

    try:
        try:
            pages = extract_text_by_page(document.file.path, document.file_type)
        except (ValueError, FileNotFoundError) as exc:
            raise PermanentProcessingError(friendly_error(exc)) from exc
        if not any((p.get("text") or "").strip() for p in pages):
            raise PermanentProcessingError(
                "No readable text was found in this file. If it's a scan, run it through OCR first."
            )

        chunks = split_into_chunks(pages=pages, chunk_size=settings.RAG_CHUNK_SIZE, chunk_overlap=settings.RAG_CHUNK_OVERLAP)
        embeddings = generate_embeddings([c["content"] for c in chunks])

        with transaction.atomic():
            DocumentChunk.objects.filter(document=document).delete()
            delete_document_chunks(document.course_id, document.id)
            DocumentChunk.objects.bulk_create([
                DocumentChunk(
                    document=document,
                    chunk_index=c["chunk_index"],
                    content=c["content"],
                    page_number=c["page_number"],
                    chroma_id=f"chunk_{document.id}_{c['chunk_index']}",
                    metadata={"document_id": str(document.id), "page_number": int(c["page_number"]),
                              "chunk_index": int(c["chunk_index"])},
                )
                for c in chunks
            ])
            topic = document.topic
            upsert_document_chunks(
                course_id=str(document.course_id),
                document_id=str(document.id),
                chunks=chunks,
                embeddings=embeddings,
                extra_metadata={
                    "course_code": document.course.code,
                    "subject_id": str(document.course.subject_id),
                    "document_title": document.title,
                    "topic": topic.title if topic else "",
                    "unit": topic.unit.title if topic else "",
                },
            )
            Document.objects.filter(id=document.id).update(
                page_count=len(pages), chunk_count=len(chunks), processing_status=DocumentStatus.COMPLETED,
                error_message="", updated_at=timezone.now(),
            )
            stale_ids = promote_version(document)
            job.status = DocumentStatus.COMPLETED
            job.completed_at = timezone.now()
            job.error_details = ""
            job.save(update_fields=["status", "completed_at", "error_details"])

            def _drop_superseded_vectors():
                for doc_id in stale_ids:
                    try:
                        delete_document_chunks(str(document.course_id), str(doc_id))
                    except Exception:
                        logger.exception(f"[process_document] Could not remove vectors of superseded {doc_id}")

            transaction.on_commit(_drop_superseded_vectors)

        logger.info(f"[process_document] Document {document_id} indexed: {len(pages)} pages, {len(chunks)} chunks.")
        return {"status": "completed", "document_id": document_id, "pages": len(pages), "chunks": len(chunks)}

    except Exception as exc:
        permanent = isinstance(exc, PermanentProcessingError)
        final = permanent or self.request.is_eager or self.request.retries >= self.max_retries
        logger.exception(f"[process_document] Failed processing document {document_id}")
        Document.objects.filter(id=document_id).update(
            # While a retry is scheduled the document waits as PENDING, not FAILED.
            processing_status=DocumentStatus.FAILED if final else DocumentStatus.PENDING,
            error_message=friendly_error(exc),
            updated_at=timezone.now(),
        )
        job.status = DocumentStatus.FAILED if final else DocumentStatus.PENDING
        job.error_details = f"{type(exc).__name__}: {exc}"[:2000]
        job.completed_at = timezone.now()
        job.save(update_fields=["status", "error_details", "completed_at"])
        if final:
            return {"status": "failed", "document_id": document_id, "error": friendly_error(exc)}
        raise self.retry(exc=exc, countdown=60 * (self.request.retries + 1))
