"""
SmartStudent AI — Assistant Serializers
"""

from rest_framework import serializers

from apps.accounts.serializers import UserPublicSerializer
from apps.assistant.models import (
    Citation,
    Conversation,
    GeneratedContent,
    GeneratedContentType,
    Message,
    MessageRole,
)
from apps.documents.serializers import DocumentListSerializer


class CitationSerializer(serializers.ModelSerializer):
    document_title = serializers.CharField(source="document.title", read_only=True)
    document_id = serializers.UUIDField(source="document.id", read_only=True)

    class Meta:
        model = Citation
        fields = (
            "id",
            "document_id",
            "document_title",
            "relevance_score",
            "excerpt",
            "page_number",
            "created_at",
        )
        read_only_fields = fields


class MessageSerializer(serializers.ModelSerializer):
    citations = CitationSerializer(many=True, read_only=True)

    class Meta:
        model = Message
        fields = (
            "id",
            "role",
            "content",
            "tokens_used",
            "model_used",
            "citations",
            "created_at",
        )
        read_only_fields = ("id", "tokens_used", "model_used", "citations", "created_at")


class MessageCreateSerializer(serializers.Serializer):
    """Used when a student sends a question to the assistant."""

    question = serializers.CharField(min_length=3, max_length=2000)

    def validate_question(self, value: str) -> str:
        return value.strip()


class ConversationListSerializer(serializers.ModelSerializer):
    course_code = serializers.CharField(source="course.code", read_only=True)
    course_title = serializers.CharField(source="course.title", read_only=True)
    message_count = serializers.IntegerField(read_only=True)
    last_message_at = serializers.SerializerMethodField()

    class Meta:
        model = Conversation
        fields = (
            "id",
            "title",
            "course_code",
            "course_title",
            "is_active",
            "message_count",
            "last_message_at",
            "created_at",
        )
        read_only_fields = fields

    def get_last_message_at(self, obj: Conversation):
        last = obj.messages.order_by("-created_at").first()
        return last.created_at if last else None


class ConversationDetailSerializer(serializers.ModelSerializer):
    student = UserPublicSerializer(read_only=True)
    messages = MessageSerializer(many=True, read_only=True)
    message_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Conversation
        fields = (
            "id",
            "title",
            "course",
            "student",
            "is_active",
            "message_count",
            "messages",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "student", "created_at", "updated_at")


class ConversationCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Conversation
        fields = ("course", "title")

    def validate_course(self, course):
        from apps.core.access import can_read_course

        request = self.context.get("request")
        if not request or not can_read_course(request.user, course):
            raise serializers.ValidationError("You don't have access to this course.")
        return course


class GeneratedContentSerializer(serializers.ModelSerializer):
    created_by = UserPublicSerializer(read_only=True)
    source_documents = DocumentListSerializer(many=True, read_only=True)

    class Meta:
        model = GeneratedContent
        fields = (
            "id",
            "course",
            "content_type",
            "title",
            "content",
            "source_documents",
            "created_by",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_by", "created_at", "updated_at")


class GeneratedContentCreateSerializer(serializers.Serializer):
    """Request body for generating AI content from course documents."""

    content_type = serializers.ChoiceField(choices=GeneratedContentType.choices)
    course_id = serializers.UUIDField()
    document_ids = serializers.ListField(
        child=serializers.UUIDField(),
        required=False,
        help_text="Optional: specific document IDs to use. If empty, all course docs are used.",
    )
    title = serializers.CharField(max_length=300, required=False, allow_blank=True)
    instructions = serializers.CharField(
        max_length=500,
        required=False,
        allow_blank=True,
        help_text="Optional extra instructions for the AI (e.g. 'Focus on Chapter 3').",
    )


class DocumentSummarizeInputSerializer(serializers.Serializer):
    document_id = serializers.UUIDField(required=True)
    mode = serializers.ChoiceField(choices=["short", "medium", "detailed"], required=True)


class QuizGenerateInputSerializer(serializers.Serializer):
    course_id = serializers.UUIDField(required=True)
    document_ids = serializers.ListField(
        child=serializers.UUIDField(),
        required=False,
        default=list
    )
    difficulty = serializers.ChoiceField(choices=["easy", "medium", "hard"], required=True)
    question_count = serializers.ChoiceField(choices=[5, 10, 20], required=True)


class FlashcardGenerateInputSerializer(serializers.Serializer):
    document_id = serializers.UUIDField(required=True)
    count = serializers.IntegerField(required=False, default=5, min_value=1, max_value=30)


class VivaGenerateInputSerializer(serializers.Serializer):
    course_id = serializers.UUIDField(required=True)
    document_ids = serializers.ListField(
        child=serializers.UUIDField(),
        required=False,
        default=list
    )
    level = serializers.ChoiceField(choices=["basic", "intermediate", "advanced"], required=True)
    count = serializers.IntegerField(required=False, default=5, min_value=1, max_value=30)


class ConceptExtractInputSerializer(serializers.Serializer):
    document_id = serializers.UUIDField(required=True)


class GlossaryGenerateInputSerializer(serializers.Serializer):
    document_id = serializers.UUIDField(required=True)
