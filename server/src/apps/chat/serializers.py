from rest_framework import serializers
from .models import ChatSession, ChatMessage, SavedAnswer


class ChatAskInputSerializer(serializers.Serializer):
    question = serializers.CharField(required=True, allow_blank=False, max_length=2000, trim_whitespace=True)
    course_id = serializers.UUIDField(required=False, allow_null=True, default=None)
    session_id = serializers.UUIDField(required=False, allow_null=True, default=None)


class ChatMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChatMessage
        fields = [
            "id",
            "role",
            "content",
            "status",
            "confidence_score",
            "response_time",
            "citations",
            "created_at",
        ]


class _SessionBase(serializers.ModelSerializer):
    course_code = serializers.CharField(source="course.code", read_only=True, default=None)
    course_title = serializers.CharField(source="course.title", read_only=True, default=None)


class ChatSessionListSerializer(_SessionBase):
    message_count = serializers.IntegerField(read_only=True)
    last_message = serializers.SerializerMethodField()

    class Meta:
        model = ChatSession
        fields = ["id", "course", "course_code", "course_title", "title", "message_count", "last_message", "created_at", "updated_at"]

    def get_last_message(self, obj):
        last = obj.messages.order_by("-created_at").first()
        if not last:
            return None
        text = " ".join(last.content.split())
        return text[:140]


class ChatSessionDetailSerializer(_SessionBase):
    messages = ChatMessageSerializer(many=True, read_only=True)

    class Meta:
        model = ChatSession
        fields = ["id", "course", "course_code", "course_title", "title", "messages", "created_at", "updated_at"]


class ChatSessionUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChatSession
        fields = ["title"]
        extra_kwargs = {"title": {"required": True, "allow_blank": False}}


class SavedAnswerSerializer(serializers.ModelSerializer):
    course_code = serializers.CharField(source="course.code", read_only=True, default=None)

    class Meta:
        model = SavedAnswer
        fields = ["id", "message", "course", "course_code", "question", "content", "citations", "created_at"]
        read_only_fields = ["id", "course", "course_code", "question", "content", "citations", "created_at"]
