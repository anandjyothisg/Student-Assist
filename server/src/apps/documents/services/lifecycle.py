"""
SmartStudent AI — deleting documents without leaving searchable leftovers.

Order matters: vectors first (if that fails nothing is deleted, so a deleted
document can never still be retrieved), then the database rows in one
transaction, then the file on disk once the transaction has committed
(signals.py).
"""

import logging

from django.db import transaction

from apps.documents.models import Document, DocumentStatus
from apps.documents.services.vector_store import delete_document_chunks

logger = logging.getLogger("apps.documents")


class IndexCleanupError(RuntimeError):
    """The document's vectors couldn't be removed; nothing was deleted."""


def _family(document):
    from django.db.models import Q

    root_id = document.parent_id or document.id
    return Document.objects.filter(Q(id=root_id) | Q(parent_id=root_id))


def delete_document(document: Document) -> None:
    try:
        delete_document_chunks(str(document.course_id), str(document.id))
    except Exception as exc:
        logger.exception(f"Could not remove vectors for document {document.id}")
        raise IndexCleanupError("The document couldn't be removed from the search index. Nothing was deleted.") from exc

    revive = None
    with transaction.atomic():
        family = list(_family(document).select_for_update().order_by("version"))
        others = [d for d in family if d.id != document.id]

        # `parent` is SET_NULL: deleting the root would orphan every later
        # version. Make the oldest remaining version the new root first.
        if document.parent_id is None and others:
            new_root = others[0]
            Document.objects.filter(parent_id=document.id).exclude(id=new_root.id).update(parent=new_root)
            Document.objects.filter(id=new_root.id).update(parent=None)

        was_latest = document.is_latest
        document.delete()

        if was_latest and others:
            in_flight = [d for d in others if d.processing_status in (DocumentStatus.PENDING, DocumentStatus.PROCESSING)
                         and d.version > document.version]
            if not in_flight:
                # The previous version's index entries were removed when it was
                # superseded, so it has to be re-indexed before it is searchable.
                candidates = [d for d in others if d.processing_status == DocumentStatus.COMPLETED]
                if candidates:
                    revive = max(candidates, key=lambda d: d.version)
                    Document.objects.filter(id=revive.id).update(
                        is_latest=True, processing_status=DocumentStatus.PENDING, error_message=""
                    )

    if revive is not None:
        from apps.documents.services.dispatch import dispatch_processing

        transaction.on_commit(lambda: dispatch_processing(revive.id))
        logger.info(f"Document {document.id} deleted; version {revive.version} ({revive.id}) is being re-indexed.")
