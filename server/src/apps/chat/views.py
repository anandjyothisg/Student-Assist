"""
SmartStudent AI — chat & assistant API.

    POST   /api/chat/ask/            answer a question (JSON)
    POST   /api/chat/ask/stream/     answer a question (server-sent events)
    GET    /api/chat/                your conversations
    GET    /api/chat/{id}/           a conversation with its messages
    PATCH  /api/chat/{id}/           rename
    DELETE /api/chat/{id}/           delete (soft)
    GET/POST/DELETE /api/chat/saved/ answers saved to the Notebook

    GET /api/v1/ai/health/    model + vector store status
    GET /api/v1/ai/insights/  question analytics for teachers/admins
    GET /api/v1/ai/scope/     courses the assistant can search for you
"""

import json
from collections import Counter, defaultdict
from datetime import timedelta

from django.db.models import Count
from django.http import StreamingHttpResponse
from django.utils import timezone
from rest_framework import mixins, status, viewsets
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.renderers import BaseRenderer, JSONRenderer
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from apps.academic.models import Course
from apps.core.ai import ollama_status
from apps.documents.models import Document

from .models import AnswerStatus, ChatMessage, ChatSession, SavedAnswer
from .serializers import (
    ChatAskInputSerializer,
    ChatSessionDetailSerializer,
    ChatSessionListSerializer,
    ChatSessionUpdateSerializer,
    SavedAnswerSerializer,
)
from .services import accessible_courses, ask, serialize_answer, stream_ask


class ChatAskView(APIView):
    """Ask the assistant. Scope: one course (`course_id`) or every course you can access."""

    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "ai"

    def post(self, request, *args, **kwargs):
        data = ChatAskInputSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        session, msg = ask(
            request.user,
            data.validated_data["question"],
            course_id=data.validated_data.get("course_id"),
            session_id=data.validated_data.get("session_id"),
        )
        return Response(serialize_answer(session, msg), status=status.HTTP_200_OK)


class EventStreamRenderer(BaseRenderer):
    """Lets DRF accept `Accept: text/event-stream`; error payloads are rendered as JSON."""

    media_type = "text/event-stream"
    format = "sse"
    charset = "utf-8"

    def render(self, data, accepted_media_type=None, renderer_context=None):
        if isinstance(data, (bytes, str)):
            return data
        return json.dumps(data, default=str).encode("utf-8")


class ChatAskStreamView(APIView):
    """Same as ChatAskView but streams the answer as server-sent events."""

    permission_classes = [IsAuthenticated]
    renderer_classes = [JSONRenderer, EventStreamRenderer]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "ai"

    def post(self, request, *args, **kwargs):
        data = ChatAskInputSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        _session, events = stream_ask(
            request.user,
            data.validated_data["question"],
            course_id=data.validated_data.get("course_id"),
            session_id=data.validated_data.get("session_id"),
        )
        response = StreamingHttpResponse(events, content_type="text/event-stream")
        response["Cache-Control"] = "no-cache"
        response["X-Accel-Buffering"] = "no"
        return response


class ChatSessionViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    """Your own conversations (every role)."""

    permission_classes = [IsAuthenticated]
    http_method_names = ["get", "patch", "delete", "head", "options"]
    pagination_class = None

    def get_queryset(self):
        qs = (
            ChatSession.objects.filter(student=self.request.user, is_active=True)
            .select_related("course")
            .annotate(message_count=Count("messages"))
            .order_by("-updated_at")
        )
        course = self.request.query_params.get("course")
        if course:
            qs = qs.filter(course_id=course)
        return qs[:100] if self.action == "list" else qs

    def get_serializer_class(self):
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


class SavedAnswerViewSet(
    mixins.ListModelMixin, mixins.CreateModelMixin, mixins.DestroyModelMixin, viewsets.GenericViewSet
):
    """Notebook: answers the user chose to keep. Create with {"message": <assistant message id>}."""

    permission_classes = [IsAuthenticated]
    serializer_class = SavedAnswerSerializer
    pagination_class = None

    def get_queryset(self):
        return SavedAnswer.objects.filter(user=self.request.user).select_related("course")

    def create(self, request, *args, **kwargs):
        msg = (
            ChatMessage.objects.filter(id=request.data.get("message"), role="assistant", session__student=request.user)
            .select_related("session")
            .first()
        )
        if not msg:
            raise ValidationError({"message": "Answer not found."})
        if msg.status != AnswerStatus.ANSWERED:
            raise ValidationError({"message": "Only answered questions can be saved."})
        existing = SavedAnswer.objects.filter(user=request.user, message=msg).first()
        if existing:
            return Response(SavedAnswerSerializer(existing).data, status=status.HTTP_200_OK)
        question = (
            msg.session.messages.filter(role="user", created_at__lte=msg.created_at).order_by("-created_at").first()
        )
        course_ids = {c.get("course_id") for c in msg.citations if c.get("course_id")}
        saved = SavedAnswer.objects.create(
            user=request.user,
            message=msg,
            course_id=msg.session.course_id or (course_ids.pop() if len(course_ids) == 1 else None),
            question=question.content if question else msg.session.title,
            content=msg.content,
            citations=msg.citations,
        )
        return Response(SavedAnswerSerializer(saved).data, status=status.HTTP_201_CREATED)


# ---------------------------------------------------------------------------
# AI health, scope and insights
# ---------------------------------------------------------------------------


class AiHealthView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        llm = ollama_status(force=request.query_params.get("refresh") == "true")
        data = {
            "llm": {
                "reachable": llm["reachable"],
                "model": llm["model"],
                "model_available": llm["model_available"],
                "loaded": llm["loaded"],
                "error": llm["error"],
            },
            "ready": llm["reachable"] and llm["model_available"],
        }
        if request.user.is_admin:
            from django.conf import settings

            from apps.documents.services.vector_store import collection_stats

            try:
                vectors = collection_stats()
            except Exception as exc:  # pragma: no cover - surfaced to admins
                vectors = {"collections": 0, "vectors": 0, "error": str(exc)}
            data["vector_store"] = vectors
            data["embedding_model"] = settings.EMBEDDING_MODEL_NAME
            data["retrieval"] = {"top_k": settings.RAG_TOP_K_RESULTS, "max_distance": settings.RAG_MAX_DISTANCE}
        return Response(data)


class AiScopeView(APIView):
    """Courses the assistant can search for the current user (drives the scope picker)."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        courses = accessible_courses(request.user).order_by("code")
        return Response([
            {"id": str(c.id), "code": c.code, "title": c.title, "subject": c.subject.name}
            for c in courses
        ])


class AiInsightsView(APIView):
    """
    Class-wide question analytics from stored conversations.
    Teachers see their own courses; admins see every course. `?course=<id>` narrows it.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        if not (user.is_teacher or user.is_admin):
            raise PermissionDenied("Insights are available to teachers and administrators.")

        courses = Course.objects.all() if user.is_admin else Course.objects.filter(teacher=user)
        course_param = request.query_params.get("course")
        if course_param:
            courses = courses.filter(id=course_param)
            if not courses.exists():
                raise PermissionDenied("You don't have access to that course.")
        courses = list(courses.order_by("code"))
        course_ids = {c.id for c in courses}
        code_by_id = {str(c.id): c.code for c in courses}

        days = max(7, min(90, int(request.query_params.get("days", 28))))
        since = timezone.now() - timedelta(days=days)

        # A question belongs to a course when the session was scoped to it, or —
        # for "all courses" sessions — when its answer cited that course.
        assistants = list(
            ChatMessage.objects.filter(role="assistant", created_at__gte=since, session__student__role="student")
            .select_related("session")
            .order_by("created_at")
        )
        user_msgs = defaultdict(list)
        for m in ChatMessage.objects.filter(
            role="user", created_at__gte=since - timedelta(minutes=10), session__student__role="student"
        ).order_by("created_at"):
            user_msgs[m.session_id].append(m)

        all_scope = user.is_admin and not course_param
        rows = []  # (course_code, student_id, created_at, status, question_text)
        for a in assistants:
            if a.session.course_id:
                cids = [str(a.session.course_id)]
            else:
                cids = [c.get("course_id") for c in a.citations if c.get("course_id")]
            cid = next((c for c in cids if c in code_by_id), None)
            if cid:
                label = code_by_id[cid]
            elif all_scope and a.status == AnswerStatus.NOT_FOUND:
                label = "All courses"  # unanswerable question asked across every course
            else:
                continue
            prior = [m for m in user_msgs.get(a.session_id, []) if m.created_at <= a.created_at]
            q_text = prior[-1].content if prior else a.session.title
            rows.append((label, a.session.student_id, a.created_at, a.status, q_text))

        total = len(rows)
        answered = sum(1 for r in rows if r[3] == AnswerStatus.ANSWERED)
        not_found = sum(1 for r in rows if r[3] == AnswerStatus.NOT_FOUND)
        students = {r[1] for r in rows}

        prev_since = since - timedelta(days=days)
        prev_total = ChatMessage.objects.filter(
            role="assistant", created_at__gte=prev_since, created_at__lt=since, session__student__role="student"
        ).count()

        # Heatmap: course × weekday
        weekday = defaultdict(lambda: [0] * 7)
        for r in rows:
            weekday[r[0]][timezone.localtime(r[2]).weekday()] += 1

        # Daily counts for the period
        today = timezone.localdate()
        daily_counter = Counter(timezone.localtime(r[2]).date() for r in rows)
        daily = [
            {"date": (today - timedelta(days=i)).isoformat(), "count": daily_counter.get(today - timedelta(days=i), 0)}
            for i in range(min(days, 14) - 1, -1, -1)
        ]

        # Top questions (normalised text)
        def norm(t):
            return " ".join(t.lower().strip().rstrip("?.!").split())

        q_counter, q_example, q_course = Counter(), {}, {}
        for r in rows:
            k = norm(r[4])
            q_counter[k] += 1
            q_example.setdefault(k, r[4].strip())
            q_course.setdefault(k, r[0])
        top_questions = [
            {"question": q_example[k], "count": n, "course_code": q_course[k]} for k, n in q_counter.most_common(6)
        ]

        unanswered = [
            {"question": r[4].strip(), "course_code": r[0], "asked_at": r[2]}
            for r in sorted(rows, key=lambda r: r[2], reverse=True)
            if r[3] == AnswerStatus.NOT_FOUND
        ][:6]

        per_course = []
        for c in courses:
            c_rows = [r for r in rows if r[0] == c.code]
            per_course.append({
                "course_id": str(c.id),
                "course_code": c.code,
                "course_title": c.title,
                "questions": len(c_rows),
                "answered_rate": round(sum(1 for r in c_rows if r[3] == AnswerStatus.ANSWERED) / len(c_rows), 3) if c_rows else None,
                "students": len({r[1] for r in c_rows}),
                "documents": Document.objects.filter(course=c, is_latest=True, processing_status="completed").count(),
            })

        return Response({
            "period_days": days,
            "courses": [{"id": str(c.id), "code": c.code, "title": c.title} for c in courses],
            "totals": {
                "questions": total,
                "previous_questions": prev_total if user.is_admin and not course_param else None,
                "active_students": len(students),
                "answered": answered,
                "not_found": not_found,
                "answered_rate": round(answered / total, 3) if total else None,
                "saved_answers": SavedAnswer.objects.filter(course_id__in=course_ids).count(),
            },
            "heatmap": [{"course_code": k, "counts": v} for k, v in sorted(weekday.items())],
            "daily": daily,
            "top_questions": top_questions,
            "unanswered": unanswered,
            "per_course": per_course,
        })
