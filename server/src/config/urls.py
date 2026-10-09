"""
SmartStudent AI — Root URL Configuration
"""

from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path, re_path
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularRedocView,
    SpectacularSwaggerView,
)

from apps.assistant.views import (
    AiAskView,
    ConceptExtractView,
    DocumentSummarizeView,
    FlashcardGenerateView,
    GlossaryGenerateView,
    LearningAnalyticsView,
    QuizGenerateView,
    VivaGenerateView,
)
from apps.chat.views import AiHealthView, AiInsightsView, AiScopeView
from apps.core.views import healthz, public_media, readyz

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
    path("ai/health/", AiHealthView.as_view(), name="ai-health"),
    path("ai/scope/", AiScopeView.as_view(), name="ai-scope"),
    path("ai/insights/", AiInsightsView.as_view(), name="ai-insights"),

    # Authentication (register, login, logout, token refresh, me, password change)
    path("auth/", include("apps.accounts.auth_urls", namespace="auth")),

    # Accounts admin CRUD
    path("accounts/", include("apps.accounts.urls", namespace="accounts")),

    # Academic (subjects, courses, enrollments)
    path("academic/", include("apps.academic.urls", namespace="academic")),

    # Documents (upload, processing, chunks)
    path("documents/", include("apps.documents.urls", namespace="documents")),

    # AI Assistant (generated study content; legacy conversations when enabled)
    path("assistant/", include("apps.assistant.urls", namespace="assistant")),
]

if settings.ENABLE_LEGACY_ASSISTANT_API:
    api_v1_urlpatterns.insert(0, path("ai/ask/", AiAskView.as_view(), name="ai-ask"))

# ---------------------------------------------------------------------------
# Root URL Patterns
# ---------------------------------------------------------------------------

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/v1/", include(api_v1_urlpatterns)),

    # Chat (the assistant used by the web app)
    path("api/chat/", include("apps.chat.urls")),

    # Flashcards for a document (used by the reader)
    path("api/assistant/flashcard/generate/", FlashcardGenerateView.as_view(), name="generate-flashcard"),

    # Liveness / readiness probes (no authentication, no sensitive data)
    path("healthz", healthz, name="healthz"),
    path("readyz", readyz, name="readyz"),

    # Public media only (avatars, course thumbnails). Course documents are private
    # and are served exclusively by /api/v1/documents/{id}/download/.
    re_path(r"^media/(?P<path>.+)$", public_media, name="public-media"),
]

if settings.ENABLE_LEGACY_ASSISTANT_API:
    # Older generators and analytics with no UI; off unless explicitly enabled.
    urlpatterns += [
        path("api/assistant/summarize/", DocumentSummarizeView.as_view(), name="summarize"),
        path("api/assistant/quiz/generate/", QuizGenerateView.as_view(), name="generate-quiz"),
        path("api/assistant/viva/generate/", VivaGenerateView.as_view(), name="generate-viva"),
        path("api/assistant/concept/extract/", ConceptExtractView.as_view(), name="extract-concepts"),
        path("api/assistant/glossary/generate/", GlossaryGenerateView.as_view(), name="generate-glossary"),
        path("api/assistant/analytics/", LearningAnalyticsView.as_view(), name="learning-analytics"),
    ]

if settings.ENABLE_API_DOCS:
    # The OpenAPI schema describes every endpoint, so it is off in production unless enabled.
    urlpatterns += [
        path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
        path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
        path("api/redoc/", SpectacularRedocView.as_view(url_name="schema"), name="redoc"),
    ]

if settings.DEBUG:
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
