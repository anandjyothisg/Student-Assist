"""
SmartStudent AI — Academic URL Configuration
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter

from apps.academic.views import CourseViewSet, EnrollmentViewSet, SubjectViewSet, TopicViewSet, UnitViewSet

app_name = "academic"

router = DefaultRouter()
router.register(r"subjects", SubjectViewSet, basename="subject")
router.register(r"courses", CourseViewSet, basename="course")
router.register(r"enrollments", EnrollmentViewSet, basename="enrollment")
router.register(r"units", UnitViewSet, basename="unit")
router.register(r"topics", TopicViewSet, basename="topic")

urlpatterns = [
    path("", include(router.urls)),
]
