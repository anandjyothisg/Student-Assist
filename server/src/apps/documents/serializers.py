"""
SmartStudent AI — Document Serializers
"""

from django.db import models, transaction
from django.db.models import Max
from rest_framework import serializers

from apps.academic.serializers import CourseListSerializer
from apps.accounts.serializers import UserPublicSerializer
from apps.documents.models import Document, DocumentChunk, DocumentType, ProcessingJob


class ProcessingJobSerializer(serializers.ModelSerializer):
    duration_seconds = serializers.FloatField(read_only=True)

    class Meta:
        model = ProcessingJob
        fields = (
            "status",
            "celery_task_id",
            "started_at",
            "completed_at",
            "duration_seconds",
            "error_details",
        )
        read_only_fields = fields


class DocumentChunkSerializer(serializers.ModelSerializer):
    class Meta:
        model = DocumentChunk
        fields = (
            "id",
            "chunk_index",
            "content",
            "page_number",
            "chroma_id",
            "metadata",
            "created_at",
        )
        read_only_fields = fields


class DocumentVersionHistorySerializer(serializers.ModelSerializer):
    """Compact serializer to represent document history versions."""

    uploaded_by_name = serializers.SerializerMethodField()
    file_size_mb = serializers.FloatField(read_only=True)

    class Meta:
        model = Document
        fields = (
            "id",
            "title",
            "version",
            "is_latest",
            "file_type",
            "file_size_mb",
            "uploaded_by_name",
            "processing_status",
            "created_at",
        )
        read_only_fields = fields

    def get_uploaded_by_name(self, obj: Document) -> str | None:
        return obj.uploaded_by.get_full_name() if obj.uploaded_by else None


class TopicPlacementMixin(serializers.Serializer):
    """Read-only course/unit/topic placement shared by list and detail views."""

    course_code = serializers.CharField(source="course.code", read_only=True)
    course_title = serializers.CharField(source="course.title", read_only=True)
    topic_title = serializers.CharField(source="topic.title", read_only=True, default=None)
    unit_id = serializers.UUIDField(source="topic.unit_id", read_only=True, default=None)
    unit_title = serializers.CharField(source="topic.unit.title", read_only=True, default=None)


class DocumentListSerializer(TopicPlacementMixin, serializers.ModelSerializer):
    """Compact serializer for document list views."""

    uploaded_by_name = serializers.SerializerMethodField()
    file_size_mb = serializers.FloatField(read_only=True)

    class Meta:
        model = Document
        fields = (
            "id",
            "title",
            "description",
            "category",
            "course",
            "course_title",
            "topic",
            "topic_title",
            "unit_id",
            "unit_title",
            "error_message",
            "file_type",
            "file_size_mb",
            "course_code",
            "uploaded_by_name",
            "processing_status",
            "page_count",
            "chunk_count",
            "version",
            "is_latest",
            "parent",
            "created_at",
        )
        read_only_fields = fields

    def get_uploaded_by_name(self, obj: Document) -> str | None:
        return obj.uploaded_by.get_full_name() if obj.uploaded_by else None


class DocumentDetailSerializer(TopicPlacementMixin, serializers.ModelSerializer):
    """Full document detail. The file itself is only served via the download endpoint."""

    uploaded_by = UserPublicSerializer(read_only=True)
    processing_job = ProcessingJobSerializer(read_only=True)
    file_size_mb = serializers.FloatField(read_only=True)
    versions = serializers.SerializerMethodField()

    class Meta:
        model = Document
        fields = (
            "id",
            "title",
            "description",
            "category",
            "file_type",
            "file_size",
            "file_size_mb",
            "file_hash",
            "course",
            "course_code",
            "course_title",
            "topic",
            "topic_title",
            "unit_id",
            "unit_title",
            "uploaded_by",
            "processing_status",
            "page_count",
            "chunk_count",
            "error_message",
            "processing_job",
            "version",
            "is_latest",
            "parent",
            "metadata",
            "versions",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "file_hash",
            "file_size",
            "page_count",
            "chunk_count",
            "processing_status",
            "error_message",
            "version",
            "is_latest",
            "parent",
            "created_at",
            "updated_at",
        )

    def get_versions(self, obj: Document):
        # The root parent is either obj.parent or obj (if obj is the root and has versions)
        root = obj.parent if obj.parent else obj
        # Query other versions in this family, excluding the current instance
        qs = Document.objects.filter(
            models.Q(id=root.id) | models.Q(parent=root)
        ).exclude(id=obj.id).order_by("-version")
        return DocumentVersionHistorySerializer(qs, many=True, context=self.context).data


class DocumentUploadSerializer(serializers.ModelSerializer):
    """Handles document upload from teacher/admin with optional versioning and metadata."""

    parent = serializers.PrimaryKeyRelatedField(
        queryset=Document.objects.all(),
        required=False,
        allow_null=True,
        write_only=True,
        help_text="Provide to upload a new version of an existing document.",
    )
    metadata = serializers.JSONField(
        required=False,
        help_text="Optional custom metadata (key-value tags) to store with the document.",
    )

    class Meta:
        model = Document
        fields = ("title", "description", "category", "file", "course", "topic", "parent", "metadata")

    def validate_file(self, file):
        from apps.core.utils import get_file_extension, validate_file_size

        validate_file_size(file)
        ext = get_file_extension(file.name)

        ext_to_type = {
            ".pdf": DocumentType.PDF,
            ".docx": DocumentType.DOCX,
            ".pptx": DocumentType.PPTX,
            ".txt": DocumentType.TXT,
            ".md": DocumentType.MD,
        }
        if ext not in ext_to_type:
            from apps.core.exceptions import UnsupportedFileTypeError
            raise serializers.ValidationError(
                f"Unsupported file type '{ext}'. Allowed: {', '.join(ext_to_type.keys())}"
            )

        from apps.core.utils import sniff_document

        problem = sniff_document(file, ext)
        if problem:
            raise serializers.ValidationError(problem)

        # Attach the detected type so create() can use it
        self._detected_file_type = ext_to_type[ext]
        return file

    def validate(self, attrs: dict) -> dict:
        parent = attrs.get("parent")
        course = attrs.get("course")
        topic = attrs.get("topic")
        if topic and topic.unit.course_id != course.id:
            raise serializers.ValidationError({"topic": "This topic belongs to a different course."})

        if parent:
            if parent.course != course:
                raise serializers.ValidationError(
                    {"parent": "The parent document must belong to the same course."}
                )
            # Ensure parent is the absolute root parent to keep version history flat
            if parent.parent:
                attrs["parent"] = parent.parent
        return attrs

    def create(self, validated_data: dict) -> Document:
        from apps.core.utils import compute_file_hash

        file = validated_data["file"]
        file_hash = compute_file_hash(file)
        file_size = file.size

        parent = validated_data.get("parent")
        metadata_val = validated_data.get("metadata", {})

        with transaction.atomic():
            if parent:
                # Number the new version under a lock on the family so two
                # concurrent uploads can't get the same version number.
                family = Document.objects.select_for_update().filter(
                    models.Q(id=parent.id) | models.Q(parent=parent)
                )
                new_version = (family.aggregate(Max("version"))["version__max"] or 1) + 1

                # The current version stays live until this one is fully indexed;
                # processing promotes it (see tasks.promote_version). Demoting now
                # would leave the material unanswerable if indexing failed.
                validated_data["parent"] = parent
                validated_data["version"] = new_version
                validated_data["is_latest"] = False
            else:
                validated_data["version"] = 1
                validated_data["is_latest"] = True

            validated_data["metadata"] = metadata_val

            return Document.objects.create(
                **validated_data,
                file_type=self._detected_file_type,
                file_hash=file_hash,
                file_size=file_size,
            )
