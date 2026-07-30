"""
SmartStudent AI — Assistant URL Configuration
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter

from apps.assistant.views import ConversationViewSet, GeneratedContentViewSet, AiAskView

app_name = "assistant"

router = DefaultRouter()
router.register(r"conversations", ConversationViewSet, basename="conversation")
router.register(r"generated", GeneratedContentViewSet, basename="generated-content")

urlpatterns = [
    path("ask/", AiAskView.as_view(), name="ask"),
    path("", include(router.urls)),
]
