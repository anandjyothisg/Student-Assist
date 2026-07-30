"""
SmartStudent AI — Assistant Admin Configuration
"""

from django.contrib import admin

from apps.assistant.models import Citation, Conversation, GeneratedContent, Message


class MessageInline(admin.TabularInline):
    model = Message
    extra = 0
    readonly_fields = ("role", "content_preview", "tokens_used", "model_used", "created_at")
    fields = ("role", "content_preview", "tokens_used", "created_at")
    can_delete = False
    ordering = ("created_at",)
    max_num = 30

    def content_preview(self, obj: Message) -> str:
        return obj.content[:100] + "..." if len(obj.content) > 100 else obj.content

    content_preview.short_description = "Content"


class CitationInline(admin.TabularInline):
    model = Citation
    extra = 0
    readonly_fields = ("document", "chunk", "relevance_score", "page_number", "excerpt_preview")
    fields = ("document", "relevance_score", "page_number", "excerpt_preview")
    can_delete = False

    def excerpt_preview(self, obj: Citation) -> str:
        return obj.excerpt[:80] + "..." if len(obj.excerpt) > 80 else obj.excerpt

    excerpt_preview.short_description = "Excerpt"


@admin.register(Conversation)
class ConversationAdmin(admin.ModelAdmin):
    list_display = (
        "title_display",
        "student",
        "course",
        "is_active",
        "message_count",
        "created_at",
    )
    list_filter = ("is_active", "course__subject", "created_at")
    search_fields = (
        "title",
        "student__email",
        "student__first_name",
        "course__code",
    )
    readonly_fields = ("id", "created_at", "updated_at", "message_count")
    ordering = ("-created_at",)
    inlines = [MessageInline]

    fieldsets = (
        (None, {"fields": ("id", "title", "student", "course", "is_active")}),
        ("Stats", {"fields": ("message_count",)}),
        ("Timestamps", {"fields": ("created_at", "updated_at"), "classes": ("collapse",)}),
    )

    def title_display(self, obj: Conversation) -> str:
        return obj.title or "Untitled"

    title_display.short_description = "Title"

    def message_count(self, obj: Conversation) -> int:
        return obj.message_count

    message_count.short_description = "Messages"


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ("conversation", "role", "content_preview", "tokens_used", "model_used", "created_at")
    list_filter = ("role", "created_at")
    search_fields = ("conversation__student__email", "content", "model_used")
    readonly_fields = ("id", "created_at", "updated_at")
    ordering = ("-created_at",)
    inlines = [CitationInline]

    def content_preview(self, obj: Message) -> str:
        return obj.content[:80] + "..." if len(obj.content) > 80 else obj.content

    content_preview.short_description = "Content"


@admin.register(Citation)
class CitationAdmin(admin.ModelAdmin):
    list_display = ("message", "document", "relevance_score", "page_number", "created_at")
    list_filter = ("created_at",)
    search_fields = ("document__title", "message__conversation__student__email")
    readonly_fields = ("created_at",)
    ordering = ("-relevance_score",)


@admin.register(GeneratedContent)
class GeneratedContentAdmin(admin.ModelAdmin):
    list_display = ("title_display", "content_type", "course", "created_by", "created_at")
    list_filter = ("content_type", "course__subject", "created_at")
    search_fields = ("title", "course__code", "created_by__email")
    readonly_fields = ("id", "created_at", "updated_at")
    filter_horizontal = ("source_documents",)
    ordering = ("-created_at",)

    fieldsets = (
        (None, {"fields": ("id", "title", "content_type", "course", "created_by")}),
        ("Content", {"fields": ("content",)}),
        ("Sources", {"fields": ("source_documents",)}),
        ("Timestamps", {"fields": ("created_at", "updated_at"), "classes": ("collapse",)}),
    )

    def title_display(self, obj: GeneratedContent) -> str:
        return obj.title or "Untitled"

    title_display.short_description = "Title"
