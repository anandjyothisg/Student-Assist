from django.urls import path, include
from rest_framework.routers import SimpleRouter
from .views import ChatAskView, ChatSessionViewSet

app_name = "chat"

router = SimpleRouter()
router.register(r"", ChatSessionViewSet, basename="session")

urlpatterns = [
    path("ask/", ChatAskView.as_view(), name="ask"),
    path("", include(router.urls)),
]
