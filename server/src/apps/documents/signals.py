"""
SmartStudent AI — keep files and vectors in step with database deletes.

Covers every way a row can disappear (the API, the admin site, a course
cascade), not just the documents endpoint.
"""

import logging

from django.db import transaction
from django.db.models.signals import post_delete, pre_delete
from django.dispatch import receiver

from apps.academic.models import Course
from apps.documents.models import Document

logger = logging.getLogger("apps.documents")


@receiver(post_delete, sender=Document)
def remove_document_file(sender, instance, **kwargs):
    """Delete the uploaded file once the deletion has committed."""
    file = instance.file
    if not file:
        return
    name, storage = file.name, file.storage

    def _remove():
        if Document.objects.filter(file=name).exists():
            return  # another row still points at this file
        try:
            storage.delete(name)
        except Exception:
            logger.exception(f"Could not delete file {name}")

    transaction.on_commit(_remove)


@receiver(pre_delete, sender=Course)
def remove_course_vectors(sender, instance, **kwargs):
    """A deleted course must not stay searchable: drop its whole collection after commit."""
    course_id = str(instance.id)

    def _drop():
        from apps.documents.services.vector_store import delete_course_collection

        try:
            delete_course_collection(course_id)
        except Exception:
            logger.exception(f"Could not delete vector collection for course {course_id}")

    transaction.on_commit(_drop)
