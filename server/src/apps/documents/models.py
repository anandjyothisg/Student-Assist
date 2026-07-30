"""
SmartStudent AI — Document Models

Pipeline:
    Teacher uploads file → Document saved → ProcessingJob created →
    Celery task extracts text → chunks created → embeddings stored in ChromaDB
"""

from django.conf import settings
from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.core.models import BaseModel


# ---------------------------------------------------------------------------
# Choices
# ---------------------------------------------------------------------------


class DocumentStatus(models.TextChoices):
    PENDING = "pending", _("Pending")
    PROCESSING = "processing", _("Processing")
    COMPLETED = "completed", _("Completed")
    FAILED = "failed", _("Failed")


class DocumentType(models.TextChoices):
    PDF = "pdf", _("PDF")
    DOCX = "docx", _("Word Document")
    PPTX = "pptx", _("PowerPoint")
    TXT = "txt", _("Plain Text")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def document_upload_path(instance: "Document", filename: str) -> str:
    """Organise uploads by course: documents/course_{id}/{filename}"""
    return f"documents/course_{instance.course_id}/{filename}"


# ---------------------------------------------------------------------------
# Document
# ---------------------------------------------------------------------------


class Document(BaseModel):
    """
    Represents a study material file uploaded by a teacher.
    Tracks the full processing lifecycle from upload to vector storage.
    """

    title = models.CharField(_("title"), max_length=300)
    description = models.TextField(_("description"), blank=True)
    file = models.FileField(_("file"), upload_to=document_upload_path)
    file_type = models.CharField(
        _("file type"),
        max_length=10,
        choices=DocumentType.choices,
        db_index=True,
    )
    file_size = models.PositiveIntegerField(
        _("file size (bytes)"),
        default=0,
        help_text="File size in bytes.",
    )
    file_hash = models.CharField(
        _("file hash"),
        max_length=64,
        blank=True,
        db_index=True,
        help_text="SHA-256 hash for duplicate detection.",
    )
    course = models.ForeignKey(
        "academic.Course",
        on_delete=models.CASCADE,
        related_name="documents",
        verbose_name=_("course"),
    )
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="uploaded_documents",
        verbose_name=_("uploaded by"),
    )
    processing_status = models.CharField(
        _("processing status"),
        max_length=20,
        choices=DocumentStatus.choices,
        default=DocumentStatus.PENDING,
        db_index=True,
    )
    page_count = models.PositiveIntegerField(_("page count"), default=0)
    chunk_count = models.PositiveIntegerField(_("chunk count"), default=0)
    error_message = models.TextField(_("error message"), blank=True)

    # Versioning & Metadata
    parent = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="versions",
        verbose_name=_("parent document"),
        help_text="Points to the root (first version) document.",
    )
    version = models.PositiveIntegerField(_("version"), default=1)
    is_latest = models.BooleanField(_("is latest version"), default=True, db_index=True)
    metadata = models.JSONField(
        _("metadata"),
        default=dict,
        blank=True,
        help_text="Arbitrary metadata stored alongside the document (e.g. author, custom tags).",
    )

    class Meta:
        db_table = "documents_document"
        verbose_name = _("Document")
        verbose_name_plural = _("Documents")
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.title} [{self.get_file_type_display()}] ({self.processing_status})"

    # ------------------------------------------------------------------
    # Convenience properties
    # ------------------------------------------------------------------

    @property
    def is_processed(self) -> bool:
        return self.processing_status == DocumentStatus.COMPLETED

    @property
    def is_processing(self) -> bool:
        return self.processing_status == DocumentStatus.PROCESSING

    @property
    def has_failed(self) -> bool:
        return self.processing_status == DocumentStatus.FAILED

    @property
    def file_size_mb(self) -> float:
        return round(self.file_size / (1024 * 1024), 2)


# ---------------------------------------------------------------------------
# DocumentChunk
# ---------------------------------------------------------------------------


class DocumentChunk(models.Model):
    """
    A single text chunk extracted from a Document.
    Stored both in PostgreSQL (for retrieval/display) and ChromaDB (for vector search).
    """

    document = models.ForeignKey(
        Document,
        on_delete=models.CASCADE,
        related_name="chunks",
        verbose_name=_("document"),
    )
    chunk_index = models.PositiveIntegerField(_("chunk index"))
    content = models.TextField(_("content"))
    page_number = models.PositiveIntegerField(_("page number"), default=0)
    chroma_id = models.CharField(
        _("ChromaDB ID"),
        max_length=100,
        blank=True,
        db_index=True,
        help_text="Unique ID used to reference this chunk in ChromaDB.",
    )
    metadata = models.JSONField(
        _("metadata"),
        default=dict,
        help_text="Arbitrary metadata stored alongside the chunk (e.g. section title).",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "documents_chunk"
        verbose_name = _("Document Chunk")
        verbose_name_plural = _("Document Chunks")
        ordering = ["document", "chunk_index"]
        unique_together = [["document", "chunk_index"]]

    def __str__(self) -> str:
        return f"Chunk {self.chunk_index} of «{self.document.title}»"


# ---------------------------------------------------------------------------
# ProcessingJob
# ---------------------------------------------------------------------------


class ProcessingJob(models.Model):
    """
    Tracks the state of a Celery document-processing task.
    One job per document, updated by the Celery worker.
    """

    document = models.OneToOneField(
        Document,
        on_delete=models.CASCADE,
        related_name="processing_job",
        verbose_name=_("document"),
    )
    celery_task_id = models.CharField(
        _("Celery task ID"),
        max_length=255,
        blank=True,
        db_index=True,
    )
    status = models.CharField(
        _("status"),
        max_length=20,
        choices=DocumentStatus.choices,
        default=DocumentStatus.PENDING,
    )
    started_at = models.DateTimeField(_("started at"), null=True, blank=True)
    completed_at = models.DateTimeField(_("completed at"), null=True, blank=True)
    error_details = models.TextField(_("error details"), blank=True)

    class Meta:
        db_table = "documents_processing_job"
        verbose_name = _("Processing Job")
        verbose_name_plural = _("Processing Jobs")

    def __str__(self) -> str:
        return f"Job for «{self.document.title}» [{self.status}]"

    @property
    def duration_seconds(self) -> float | None:
        if self.started_at and self.completed_at:
            return (self.completed_at - self.started_at).total_seconds()
        return None
