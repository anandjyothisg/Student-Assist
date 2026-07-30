"""
SmartStudent AI — Academic URL Configuration
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter

from apps.academic.views import CourseViewSet, EnrollmentViewSet, SubjectViewSet

app_name = "academic"

router = DefaultRouter()
router.register(r"subjects", SubjectViewSet, basename="subject")
router.register(r"courses", CourseViewSet, basename="course")
router.register(r"enrollments", EnrollmentViewSet, basename="enrollment")

urlpatterns = [
    path("", include(router.urls)),
]
