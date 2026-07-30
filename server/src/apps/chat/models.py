import uuid
from django.db import models
from django.conf import settings
from django.utils.translation import gettext_lazy as _

from apps.academic.models import Course


class ChatSession(models.Model):
    """
    A chat session between an authenticated student and the AI assistant,
    associated with a specific course.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="chat_sessions",
        verbose_name=_("student"),
        limit_choices_to={"role": "student"},
    )
    course = models.ForeignKey(
        Course,
        on_delete=models.CASCADE,
        related_name="chat_sessions",
        verbose_name=_("course"),
    )
    title = models.CharField(_("title"), max_length=300, blank=True)
    is_active = models.BooleanField(_("active"), default=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "chat_session"
        verbose_name = _("Chat Session")
        verbose_name_plural = _("Chat Sessions")
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"Session {self.id} — [{self.course.code}] by {self.student.email}"


class ChatMessage(models.Model):
    """
    A single turn / message in a ChatSession.
    Contains either the user query or the assistant's response.
    If role=assistant, fields like confidence_score, response_time,
    and citations are filled.
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
    confidence_score = models.FloatField(
        _("confidence score"),
        null=True,
        blank=True,
        help_text="Relevance/Confidence score (Cosine similarity 0-1) of context retrieval.",
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
        help_text="Retrieved context source metadata (e.g. document titles, page numbers, excerpts).",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "chat_message"
        verbose_name = _("Chat Message")
        verbose_name_plural = _("Chat Messages")
        ordering = ["created_at"]

    def __str__(self) -> str:
        preview = self.content[:60] + "..." if len(self.content) > 60 else self.content
        return f"[{self.role}] {preview}"
