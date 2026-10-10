"""
Re-run text extraction, chunking and embedding for documents.

    python manage.py index_documents              # pending + failed documents
    python manage.py index_documents --all        # every current document
    python manage.py index_documents --rebuild    # drop every course collection, then index all
                                                  # (use after changing EMBEDDING_MODEL_NAME)
    python manage.py index_documents --reconcile  # report drift between the database and the vector store
"""

from django.conf import settings
from django.core.management.base import BaseCommand
from django.db.models import Count

from apps.documents.models import Document, DocumentChunk, DocumentStatus
from apps.documents.services.dispatch import dispatch_processing


class Command(BaseCommand):
    help = "Index (or re-index) course documents synchronously."

    def add_arguments(self, parser):
        parser.add_argument("--all", action="store_true", help="Re-index every current document, not just pending/failed ones.")
        parser.add_argument("--rebuild", action="store_true", help="Delete every course collection first, then re-index everything.")
        parser.add_argument("--reconcile", action="store_true", help="Only report differences between database chunks and stored vectors.")

    def handle(self, *args, **opts):
        if opts["reconcile"]:
            return self.reconcile()

        if opts["rebuild"]:
            from apps.documents.services.vector_store import get_chroma_client

            client = get_chroma_client()
            prefix = f"{settings.CHROMA_COLLECTION_PREFIX}_course_"
            dropped = 0
            for col in client.list_collections():
                name = getattr(col, "name", str(col))
                if name.startswith(prefix):
                    client.delete_collection(name)
                    dropped += 1
            self.stdout.write(f"Dropped {dropped} course collections; rebuilding with {settings.EMBEDDING_MODEL_NAME}.")

        qs = Document.objects.filter(is_latest=True).select_related("course").order_by("course__code", "created_at")
        if not (opts["all"] or opts["rebuild"]):
            qs = qs.filter(processing_status__in=[DocumentStatus.PENDING, DocumentStatus.FAILED])
        total = qs.count()
        ok = 0
        for i, doc in enumerate(qs, start=1):
            # Reset first so a crash can never leave a stale "completed" status behind.
            Document.objects.filter(pk=doc.pk).update(processing_status=DocumentStatus.PENDING)
            dispatch_processing(doc.id, wait=True)
            doc.refresh_from_db()
            good = doc.processing_status == DocumentStatus.COMPLETED
            ok += good
            mark = self.style.SUCCESS("OK") if good else self.style.ERROR("FAIL")
            self.stdout.write(f"  {mark:4} [{i}/{total}] {doc.course.code:7} {doc.title[:60]:60} {doc.chunk_count:>3} chunks")
            if not good:
                self.stdout.write(self.style.ERROR(f"      {doc.error_message}"))
        self.stdout.write(self.style.SUCCESS(f"\n{ok}/{total} documents indexed."))

    def reconcile(self):
        """Compare per-document chunk counts in the database with vectors in Chroma."""
        from apps.documents.services.vector_store import find_course_collection, index_compatibility

        drift = 0
        docs = (Document.objects.filter(is_latest=True, processing_status=DocumentStatus.COMPLETED)
                .select_related("course").annotate(n=Count("chunks")))
        for doc in docs:
            col = find_course_collection(str(doc.course_id))
            vectors = len(col.get(where={"document_id": str(doc.id)}, include=[])["ids"]) if col else 0
            if vectors != doc.n:
                drift += 1
                self.stdout.write(self.style.WARNING(f"  {doc.course.code:7} {doc.title[:50]:50} db={doc.n} vectors={vectors}"))
        orphan_chunks = DocumentChunk.objects.exclude(document__is_latest=True).count()
        self.stdout.write(f"Documents with drift: {drift}. Chunks on superseded versions: {orphan_chunks}.")
        self.stdout.write(f"Collection signatures: {index_compatibility()}")
