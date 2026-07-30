"""
SmartStudent AI — Documents Admin Configuration
"""

from django.contrib import admin
from django.utils.html import format_html

from apps.documents.models import Document, DocumentChunk, DocumentStatus, ProcessingJob


class DocumentChunkInline(admin.TabularInline):
    model = DocumentChunk
    extra = 0
    readonly_fields = ("chunk_index", "page_number", "content_preview", "chroma_id", "created_at")
    fields = ("chunk_index", "page_number", "content_preview", "chroma_id")
    can_delete = False
    max_num = 20  # Show first 20 chunks inline
    ordering = ("chunk_index",)

    def content_preview(self, obj: DocumentChunk) -> str:
        return obj.content[:120] + "..." if len(obj.content) > 120 else obj.content

    content_preview.short_description = "Content Preview"


class ProcessingJobInline(admin.StackedInline):
    model = ProcessingJob
    extra = 0
    readonly_fields = ("celery_task_id", "status", "started_at", "completed_at", "error_details")
    can_delete = False


@admin.register(Document)
class DocumentAdmin(admin.ModelAdmin):
    list_display = (
        "title",
        "file_type",
        "course",
        "uploaded_by",
        "processing_status_badge",
        "file_size_display",
        "page_count",
        "chunk_count",
        "created_at",
    )
    list_filter = ("processing_status", "file_type", "course__subject", "created_at")
    search_fields = ("title", "course__code", "course__title", "uploaded_by__email")
    readonly_fields = (
        "id",
        "file_hash",
        "file_size",
        "page_count",
        "chunk_count",
        "created_at",
        "updated_at",
    )
    ordering = ("-created_at",)
    inlines = [ProcessingJobInline, DocumentChunkInline]

    fieldsets = (
        (None, {"fields": ("id", "title", "description", "course", "uploaded_by")}),
        ("File", {"fields": ("file", "file_type", "file_size", "file_hash")}),
        (
            "Processing",
            {"fields": ("processing_status", "page_count", "chunk_count", "error_message")},
        ),
        (
            "Timestamps",
            {"fields": ("created_at", "updated_at"), "classes": ("collapse",)},
        ),
    )

    def processing_status_badge(self, obj: Document) -> str:
        colours = {
            DocumentStatus.PENDING: "#6b7280",
            DocumentStatus.PROCESSING: "#f59e0b",
            DocumentStatus.COMPLETED: "#10b981",
            DocumentStatus.FAILED: "#ef4444",
        }
        colour = colours.get(obj.processing_status, "#6b7280")
        return format_html(
            '<span style="background:{};color:#fff;padding:2px 8px;border-radius:4px;font-size:11px">{}</span>',
            colour,
            obj.get_processing_status_display(),
        )

    processing_status_badge.short_description = "Status"
    processing_status_badge.admin_order_field = "processing_status"

    def file_size_display(self, obj: Document) -> str:
        return f"{obj.file_size_mb} MB"

    file_size_display.short_description = "Size"


@admin.register(DocumentChunk)
class DocumentChunkAdmin(admin.ModelAdmin):
    list_display = ("document", "chunk_index", "page_number", "chroma_id", "created_at")
    list_filter = ("document__course", "created_at")
    search_fields = ("document__title", "content", "chroma_id")
    readonly_fields = ("document", "chunk_index", "page_number", "chroma_id", "content", "metadata", "created_at")
    ordering = ("document", "chunk_index")


@admin.register(ProcessingJob)
class ProcessingJobAdmin(admin.ModelAdmin):
    list_display = ("document", "status", "celery_task_id", "started_at", "completed_at", "duration_display")
    list_filter = ("status",)
    search_fields = ("document__title", "celery_task_id")
    readonly_fields = ("document", "celery_task_id", "started_at", "completed_at", "error_details")

    def duration_display(self, obj: ProcessingJob) -> str:
        d = obj.duration_seconds
        return f"{d:.1f}s" if d is not None else "-"

    duration_display.short_description = "Duration"
