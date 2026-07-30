from rest_framework import serializers
from .models import ChatSession, ChatMessage


class ChatAskInputSerializer(serializers.Serializer):
    course_id = serializers.UUIDField(required=True)
    question = serializers.CharField(required=True, allow_blank=False)
    session_id = serializers.UUIDField(required=False, allow_null=True, default=None)


class ChatMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChatMessage
        fields = [
            "id",
            "role",
            "content",
            "confidence_score",
            "response_time",
            "citations",
            "created_at",
        ]


class ChatSessionListSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChatSession
        fields = ["id", "student", "course", "title", "created_at", "updated_at"]


class ChatSessionDetailSerializer(serializers.ModelSerializer):
    messages = ChatMessageSerializer(many=True, read_only=True)

    class Meta:
        model = ChatSession
        fields = [
            "id",
            "student",
            "course",
            "title",
            "messages",
            "created_at",
            "updated_at",
        ]


class ChatSessionUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChatSession
        fields = ["title"]
        extra_kwargs = {
            "title": {"required": True, "allow_blank": False}
        }
