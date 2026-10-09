"""
SmartStudent AI — Assistant URL Configuration

The web app uses `generated/` (the notebook). The older conversation-based RAG
API and the universal `ask/` endpoint duplicate /api/chat/ with weaker scoping
and have no UI, so they are only mounted when ENABLE_LEGACY_ASSISTANT_API is on.
"""

from django.conf import settings
from django.urls import path, include
from rest_framework.routers import DefaultRouter

from apps.assistant.views import ConversationViewSet, GeneratedContentViewSet, AiAskView

app_name = "assistant"

router = DefaultRouter()
router.register(r"generated", GeneratedContentViewSet, basename="generated-content")
if settings.ENABLE_LEGACY_ASSISTANT_API:
    router.register(r"conversations", ConversationViewSet, basename="conversation")

urlpatterns = [path("", include(router.urls))]
if settings.ENABLE_LEGACY_ASSISTANT_API:
    urlpatterns.insert(0, path("ask/", AiAskView.as_view(), name="ask"))
