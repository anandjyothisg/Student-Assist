"""
SmartStudent AI — Root URL Configuration
"""

from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularSwaggerView,
    SpectacularRedocView,
)
from apps.assistant.views import DocumentSummarizeView, QuizGenerateView, FlashcardGenerateView, VivaGenerateView, ConceptExtractView, GlossaryGenerateView, LearningAnalyticsView, AiAskView

# ---------------------------------------------------------------------------
# Admin customisation
# ---------------------------------------------------------------------------

admin.site.site_header = "SmartStudent AI Administration"
admin.site.site_title = "SmartStudent AI"
admin.site.index_title = "Dashboard"

# ---------------------------------------------------------------------------
# API v1 Routes
# ---------------------------------------------------------------------------

api_v1_urlpatterns = [
    # Universal AI query endpoint
    path("ai/ask/", AiAskView.as_view(), name="ai-ask"),

    # Authentication (register, login, logout, token refresh, me, password change)
    path("auth/", include("apps.accounts.auth_urls", namespace="auth")),

    # Accounts admin CRUD
    path("accounts/", include("apps.accounts.urls", namespace="accounts")),

    # Academic (subjects, courses, enrollments)
    path("academic/", include("apps.academic.urls", namespace="academic")),

    # Documents (upload, processing, chunks)
    path("documents/", include("apps.documents.urls", namespace="documents")),

    # AI Assistant (conversations, generated content)
    path("assistant/", include("apps.assistant.urls", namespace="assistant")),
]

# ---------------------------------------------------------------------------
# Root URL Patterns
# ---------------------------------------------------------------------------

urlpatterns = [
    # Django admin
    path("admin/", admin.site.urls),

    # API v1
    path("api/v1/", include(api_v1_urlpatterns)),

    # Chat API
    path("api/chat/", include("apps.chat.urls")),

    # Summarization API
    path("api/assistant/summarize/", DocumentSummarizeView.as_view(), name="summarize"),

    # Quiz Generation API
    path("api/assistant/quiz/generate/", QuizGenerateView.as_view(), name="generate-quiz"),

    # Flashcard Generation API
    path("api/assistant/flashcard/generate/", FlashcardGenerateView.as_view(), name="generate-flashcard"),

    # Viva Preparation API
    path("api/assistant/viva/generate/", VivaGenerateView.as_view(), name="generate-viva"),

    # Key Concept Extraction API
    path("api/assistant/concept/extract/", ConceptExtractView.as_view(), name="extract-concepts"),

    # Glossary Generation API
    path("api/assistant/glossary/generate/", GlossaryGenerateView.as_view(), name="generate-glossary"),

    # Learning Analytics API
    path("api/assistant/analytics/", LearningAnalyticsView.as_view(), name="learning-analytics"),

    # OpenAPI schema (raw JSON/YAML)
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),

    # Swagger UI
    path(
        "api/docs/",
        SpectacularSwaggerView.as_view(url_name="schema"),
        name="swagger-ui",
    ),

    # ReDoc UI
    path(
        "api/redoc/",
        SpectacularRedocView.as_view(url_name="schema"),
        name="redoc",
    ),
]

# ---------------------------------------------------------------------------
# Serve media and static files in development
# ---------------------------------------------------------------------------

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
