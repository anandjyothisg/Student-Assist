"""
SmartStudent AI — Accounts URL Configuration
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter

from apps.accounts.views import MeViewSet, UserViewSet

app_name = "accounts"

router = DefaultRouter()
router.register(r"users", UserViewSet, basename="user")
router.register(r"me", MeViewSet, basename="me")

urlpatterns = [
    path("", include(router.urls)),
]
