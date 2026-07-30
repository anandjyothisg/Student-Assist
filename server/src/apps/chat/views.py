from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated

from apps.core.permissions import IsStudent
from apps.academic.models import Enrollment, Course
from .models import ChatSession
from .serializers import ChatAskInputSerializer
from .services import run_chat_rag_query


class ChatAskView(APIView):
    """
    POST /api/chat/ask/
    Allows authenticated students to ask questions about study materials
    scoped to a course. Validates active student enrollment.
    """
    permission_classes = [IsAuthenticated, IsStudent]

    def post(self, request, *args, **kwargs):
        serializer = ChatAskInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        course_id = serializer.validated_data["course_id"]
        question = serializer.validated_data["question"]
        session_id = serializer.validated_data.get("session_id")

        # 1. Validate course exists
        if not Course.objects.filter(id=course_id).exists():
            return Response(
                {"detail": "Course not found."},
                status=status.HTTP_404_NOT_FOUND
            )

        # 2. Validate student enrollment
        if not Enrollment.objects.filter(student=request.user, course_id=course_id, is_active=True).exists():
            return Response(
                {"detail": "You are not enrolled in this course."},
                status=status.HTTP_403_FORBIDDEN
            )

        # 3. Fetch or initialize ChatSession
        if session_id:
            try:
                session = ChatSession.objects.get(id=session_id)
                if session.student != request.user:
                    return Response(
                        {"detail": "You do not have permission to access this chat session."},
                        status=status.HTTP_403_FORBIDDEN
                    )
                if session.course_id != course_id:
                    return Response(
                        {"detail": "This chat session belongs to a different course."},
                        status=status.HTTP_400_BAD_REQUEST
                    )
            except ChatSession.DoesNotExist:
                return Response(
                    {"detail": "Chat session not found."},
                    status=status.HTTP_404_NOT_FOUND
                )
        else:
            session = ChatSession.objects.create(
                student=request.user,
                course_id=course_id,
                title=question[:60]
            )

        # 4. Trigger RAG pipeline execution
        try:
            assistant_msg = run_chat_rag_query(session, question)
        except Exception as e:
            return Response(
                {"detail": f"Failed to execute RAG query: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        # 5. Format and return response
        return Response({
            "session_id": str(session.id),
            "answer": assistant_msg.content,
            "citations": assistant_msg.citations,
            "confidence_score": assistant_msg.confidence_score,
            "response_time": assistant_msg.response_time
        }, status=status.HTTP_200_OK)


from rest_framework import viewsets, mixins
from .serializers import (
    ChatSessionListSerializer,
    ChatSessionDetailSerializer,
    ChatSessionUpdateSerializer,
)


class ChatSessionViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    """
    ViewSet to manage student chat history:
    - List previous conversations: GET /api/chat/
    - Open a conversation: GET /api/chat/{id}/
    - Delete conversation: DELETE /api/chat/{id}/
    - Rename conversation: PATCH /api/chat/{id}/
    """
    permission_classes = [IsAuthenticated, IsStudent]
    http_method_names = ["get", "patch", "delete", "head", "options"]

    def get_queryset(self):
        return ChatSession.objects.filter(
            student=self.request.user,
            is_active=True
        ).select_related("course")

    def get_serializer_class(self):
        if self.action == "list":
            return ChatSessionListSerializer
        if self.action == "retrieve":
            return ChatSessionDetailSerializer
        if self.action in ("update", "partial_update"):
            return ChatSessionUpdateSerializer
        return ChatSessionListSerializer

    def destroy(self, request, *args, **kwargs):
        session = self.get_object()
        session.is_active = False
        session.save(update_fields=["is_active"])
        return Response(status=status.HTTP_204_NO_CONTENT)
