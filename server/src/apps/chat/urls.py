from django.urls import include, path
from rest_framework.routers import SimpleRouter

from .views import ChatAskStreamView, ChatAskView, ChatSessionViewSet, SavedAnswerViewSet

app_name = "chat"

saved_router = SimpleRouter()
saved_router.register(r"saved", SavedAnswerViewSet, basename="saved")

session_router = SimpleRouter()
session_router.register(r"", ChatSessionViewSet, basename="session")

urlpatterns = [
    path("ask/", ChatAskView.as_view(), name="ask"),
    path("ask/stream/", ChatAskStreamView.as_view(), name="ask-stream"),
    path("", include(saved_router.urls)),
    path("", include(session_router.urls)),
]
