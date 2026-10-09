import uuid
from django.db import models
from django.conf import settings
from django.utils.translation import gettext_lazy as _

from apps.academic.models import Course


class ChatSession(models.Model):
    """
    A conversation between a user and the AI assistant.

    `course` scopes retrieval to one course; when empty the assistant searches
    every course the owner can access. (`student` is the owner — kept under its
    original name, but teachers and admins can own sessions too.)
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="chat_sessions",
        verbose_name=_("owner"),
    )
    course = models.ForeignKey(
        Course,
        on_delete=models.CASCADE,
        related_name="chat_sessions",
        verbose_name=_("course"),
        null=True,
        blank=True,
    )
    title = models.CharField(_("title"), max_length=300, blank=True)
    is_active = models.BooleanField(_("active"), default=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "chat_session"
        verbose_name = _("Chat Session")
        verbose_name_plural = _("Chat Sessions")
        ordering = ["-updated_at"]

    def __str__(self) -> str:
        scope = self.course.code if self.course_id else "all courses"
        return f"Session {self.id} — [{scope}] by {self.student.email}"


class AnswerStatus(models.TextChoices):
    ANSWERED = "answered", _("Answered")
    NOT_FOUND = "not_found", _("Not found in materials")
    MODEL_UNAVAILABLE = "model_unavailable", _("Model unavailable")


class ChatMessage(models.Model):
    """
    A single turn in a ChatSession. Assistant turns carry citations, the
    retrieval confidence, timing and an answer status.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    session = models.ForeignKey(
        ChatSession,
        on_delete=models.CASCADE,
        related_name="messages",
        verbose_name=_("session"),
    )
    role = models.CharField(
        _("role"),
        max_length=20,
        choices=[("user", "User"), ("assistant", "Assistant")],
        db_index=True,
    )
    content = models.TextField(_("content"))
    status = models.CharField(
        _("status"), max_length=20, choices=AnswerStatus.choices, blank=True, db_index=True
    )
    confidence_score = models.FloatField(
        _("confidence score"),
        null=True,
        blank=True,
        help_text="Best retrieval similarity (0-1) for the question.",
    )
    response_time = models.FloatField(
        _("response time"),
        null=True,
        blank=True,
        help_text="Time taken to process and answer in seconds.",
    )
    citations = models.JSONField(
        _("citations"),
        default=list,
        blank=True,
        help_text="Retrieved sources: document, course, unit, topic, page and excerpt.",
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = "chat_message"
        verbose_name = _("Chat Message")
        verbose_name_plural = _("Chat Messages")
        ordering = ["created_at"]

    def __str__(self) -> str:
        preview = self.content[:60] + "..." if len(self.content) > 60 else self.content
        return f"[{self.role}] {preview}"


class SavedAnswer(models.Model):
    """An assistant answer a user chose to keep in their Notebook."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="saved_answers"
    )
    message = models.ForeignKey(
        ChatMessage, on_delete=models.SET_NULL, null=True, blank=True, related_name="saves"
    )
    course = models.ForeignKey(Course, on_delete=models.SET_NULL, null=True, blank=True, related_name="+")
    question = models.TextField(_("question"))
    content = models.TextField(_("content"))
    citations = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "chat_saved_answer"
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"Saved: {self.question[:50]}"
