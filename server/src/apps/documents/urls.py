"""
SmartStudent AI — Documents URL Configuration
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter

from apps.documents.views import DocumentViewSet

app_name = "documents"

router = DefaultRouter()
router.register(r"", DocumentViewSet, basename="document")

urlpatterns = [
    # /documents/upload/ is a convenience alias for POST /documents/
    # The router also registers POST /documents/ -> create, so both work.
    path("upload/", DocumentViewSet.as_view({"post": "create"}), name="document-upload"),
    path("", include(router.urls)),
]
