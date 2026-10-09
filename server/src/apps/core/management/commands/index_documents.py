"""
Re-run text extraction, chunking and embedding for documents.

    python manage.py index_documents            # pending + failed documents
    python manage.py index_documents --all      # every current document
"""

from django.core.management.base import BaseCommand

from apps.documents.models import Document, DocumentStatus
from apps.documents.services.dispatch import dispatch_processing


class Command(BaseCommand):
    help = "Index (or re-index) course documents synchronously."

    def add_arguments(self, parser):
        parser.add_argument("--all", action="store_true", help="Re-index every current document, not just pending/failed ones.")

    def handle(self, *args, **opts):
        qs = Document.objects.filter(is_latest=True).select_related("course").order_by("course__code", "created_at")
        if not opts["all"]:
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
            mark = self.style.SUCCESS("✓") if good else self.style.ERROR("✗")
            self.stdout.write(f"  {mark} [{i}/{total}] {doc.course.code:7} {doc.title[:60]:60} {doc.chunk_count:>3} chunks")
            if not good:
                self.stdout.write(self.style.ERROR(f"      {doc.error_message}"))
        self.stdout.write(self.style.SUCCESS(f"\n{ok}/{total} documents indexed."))
