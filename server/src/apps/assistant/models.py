"""
SmartStudent AI — Assistant Models

Data model for the AI tutoring system:
    Conversation → Messages → Citations
    Course → GeneratedContent (summaries, quizzes, flashcards, viva questions)
"""

from django.conf import settings
from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.core.models import BaseModel


# ---------------------------------------------------------------------------
# Choices
# ---------------------------------------------------------------------------


class MessageRole(models.TextChoices):
    USER = "user", _("User")
    ASSISTANT = "assistant", _("Assistant")
    SYSTEM = "system", _("System")


class GeneratedContentType(models.TextChoices):
    SUMMARY = "summary", _("Summary")
    QUIZ = "quiz", _("Quiz")
    FLASHCARD = "flashcard", _("Flashcard")
    VIVA = "viva", _("Viva Questions")


# ---------------------------------------------------------------------------
# Conversation
# ---------------------------------------------------------------------------


class Conversation(BaseModel):
    """
    A conversation session between a student and the AI assistant,
    scoped to a specific course.

    The title is either provided by the student or auto-generated from
    the first question.
    """

    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="conversations",
        verbose_name=_("student"),
        limit_choices_to={"role": "student"},
    )
    course = models.ForeignKey(
        "academic.Course",
        on_delete=models.CASCADE,
        related_name="conversations",
        verbose_name=_("course"),
    )
    title = models.CharField(_("title"), max_length=300, blank=True)
    is_active = models.BooleanField(_("active"), default=True, db_index=True)

    class Meta:
        db_table = "assistant_conversation"
        verbose_name = _("Conversation")
        verbose_name_plural = _("Conversations")
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"[{self.course.code}] {self.title or 'Untitled'} — {self.student.get_short_name()}"

    @property
    def message_count(self) -> int:
        return self.messages.count()


# ---------------------------------------------------------------------------
# Message
# ---------------------------------------------------------------------------


class Message(BaseModel):
    """
    A single turn in a Conversation.
    role=user     → student's question
    role=assistant → AI's response (with citations)
    role=system   → injected system context (not shown in UI)
    """

    conversation = models.ForeignKey(
        Conversation,
        on_delete=models.CASCADE,
        related_name="messages",
        verbose_name=_("conversation"),
    )
    role = models.CharField(
        _("role"),
        max_length=20,
        choices=MessageRole.choices,
        db_index=True,
    )
    content = models.TextField(_("content"))
    tokens_used = models.PositiveIntegerField(
        _("tokens used"),
        default=0,
        help_text="Number of tokens consumed by this message.",
    )
    model_used = models.CharField(
        _("model used"),
        max_length=100,
        blank=True,
        help_text="Ollama model identifier used to generate this response.",
    )

    class Meta:
        db_table = "assistant_message"
        verbose_name = _("Message")
        verbose_name_plural = _("Messages")
        ordering = ["created_at"]

    def __str__(self) -> str:
        preview = self.content[:60] + "..." if len(self.content) > 60 else self.content
        return f"[{self.role}] {preview}"


# ---------------------------------------------------------------------------
# Citation
# ---------------------------------------------------------------------------


class Citation(models.Model):
    """
    Links an assistant Message to a specific DocumentChunk that was used
    as context in generating the response.
    Stored per-message for full auditability and UI display.
    """

    message = models.ForeignKey(
        Message,
        on_delete=models.CASCADE,
        related_name="citations",
        verbose_name=_("message"),
    )
    document = models.ForeignKey(
        "documents.Document",
        on_delete=models.CASCADE,
        related_name="citations",
        verbose_name=_("document"),
    )
    chunk = models.ForeignKey(
        "documents.DocumentChunk",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="citations",
        verbose_name=_("chunk"),
    )
    relevance_score = models.FloatField(
        _("relevance score"),
        default=0.0,
        help_text="Cosine similarity score from ChromaDB retrieval (0–1).",
    )
    excerpt = models.TextField(
        _("excerpt"),
        blank=True,
        help_text="Short excerpt from the chunk shown to the student.",
    )
    page_number = models.PositiveIntegerField(_("page number"), default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "assistant_citation"
        verbose_name = _("Citation")
        verbose_name_plural = _("Citations")
        ordering = ["-relevance_score"]

    def __str__(self) -> str:
        return f"Citation from «{self.document.title}» (score={self.relevance_score:.3f})"


# ---------------------------------------------------------------------------
# GeneratedContent
# ---------------------------------------------------------------------------


class GeneratedContent(BaseModel):
    """
    AI-generated study aids: summaries, quizzes, flashcards, viva questions.
    Content is stored as structured JSON whose schema depends on content_type.

    Schema examples:
        summary:   {"text": "...", "key_points": [...]}
        quiz:      {"questions": [{"question": "...", "options": [...], "answer": "..."}]}
        flashcard: {"cards": [{"front": "...", "back": "..."}]}
        viva:      {"questions": [{"question": "...", "expected_answer": "..."}]}
    """

    course = models.ForeignKey(
        "academic.Course",
        on_delete=models.CASCADE,
        related_name="generated_content",
        verbose_name=_("course"),
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="generated_content",
        verbose_name=_("created by"),
    )
    content_type = models.CharField(
        _("content type"),
        max_length=20,
        choices=GeneratedContentType.choices,
        db_index=True,
    )
    title = models.CharField(_("title"), max_length=300, blank=True)
    content = models.JSONField(
        _("content"),
        default=dict,
        help_text="Structured JSON payload whose schema depends on content_type.",
    )
    source_documents = models.ManyToManyField(
        "documents.Document",
        related_name="generated_content",
        blank=True,
        verbose_name=_("source documents"),
    )

    class Meta:
        db_table = "assistant_generated_content"
        verbose_name = _("Generated Content")
        verbose_name_plural = _("Generated Content")
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.get_content_type_display()} for {self.course.code}: {self.title or 'Untitled'}"
