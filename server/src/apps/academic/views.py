"""
SmartStudent AI — Academic Views
"""

import logging

from rest_framework import status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet

from apps.academic.models import Course, Enrollment, Subject
from apps.academic.serializers import (
    CourseDetailSerializer,
    CourseListSerializer,
    CourseWriteSerializer,
    EnrollmentCreateSerializer,
    EnrollmentSerializer,
    SubjectSerializer,
    SubjectWriteSerializer,
)
from apps.core.pagination import StandardPagination
from apps.core.permissions import IsAdmin, IsAdminOrTeacher, IsStudent

logger = logging.getLogger("apps.academic")


class SubjectViewSet(ModelViewSet):
    """
    CRUD for subjects.
    - List / Retrieve: all authenticated users
    - Create / Update / Delete: admin only
    """

    queryset = Subject.objects.all().select_related("created_by")
    pagination_class = StandardPagination
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsAdmin()]

    def get_serializer_class(self):
        if self.action in ("create", "partial_update", "update"):
            return SubjectWriteSerializer
        return SubjectSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        if not self.request.user.is_admin:
            qs = qs.filter(is_active=True)
        return qs

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)
        logger.info(f"Subject '{serializer.instance.code}' created by {self.request.user.email}")


class CourseViewSet(ModelViewSet):
    """
    CRUD for courses.
    - List / Retrieve: all authenticated users (filtered by role)
    - Create / Update: admin or teacher
    - Delete: admin only
    """

    pagination_class = StandardPagination
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [IsAuthenticated()]
        if self.action == "destroy":
            return [IsAuthenticated(), IsAdmin()]
        return [IsAuthenticated(), IsAdminOrTeacher()]

    def get_serializer_class(self):
        if self.action == "list":
            return CourseListSerializer
        if self.action in ("create", "partial_update", "update"):
            return CourseWriteSerializer
        return CourseDetailSerializer

    def get_queryset(self):
        user = self.request.user
        qs = Course.objects.select_related("subject", "teacher").all()

        if user.is_student:
            # Students see only published courses
            qs = qs.filter(is_published=True)
        elif user.is_teacher:
            # Teachers see their own courses + published courses
            qs = qs.filter(is_published=True) | qs.filter(teacher=user)

        subject = self.request.query_params.get("subject")
        if subject:
            qs = qs.filter(subject__code__iexact=subject)

        return qs.distinct()

    def perform_create(self, serializer):
        # If a teacher creates a course, default the teacher to themselves
        teacher = serializer.validated_data.get("teacher")
        if not teacher and self.request.user.is_teacher:
            serializer.save(teacher=self.request.user)
        else:
            serializer.save()
        logger.info(f"Course '{serializer.instance.code}' created by {self.request.user.email}")

    @action(detail=True, methods=["get"], permission_classes=[IsAuthenticated])
    def enrollments(self, request: Request, pk=None) -> Response:
        """GET /api/v1/academic/courses/{id}/enrollments/ — admin/teacher only."""
        course = self.get_object()
        if not (request.user.is_admin or request.user == course.teacher):
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)
        qs = course.enrollments.select_related("student").filter(is_active=True)
        serializer = EnrollmentSerializer(qs, many=True)
        return Response(serializer.data)


class EnrollmentViewSet(ModelViewSet):
    """
    Manages student enrollments.
    - List: student sees own enrollments; admin/teacher sees all
    - Create: student enrolls in a published course
    - Destroy: admin or the enrolled student
    """

    pagination_class = StandardPagination
    http_method_names = ["get", "post", "delete", "head", "options"]

    def get_permissions(self):
        return [IsAuthenticated()]

    def get_serializer_class(self):
        if self.action == "create":
            return EnrollmentCreateSerializer
        return EnrollmentSerializer

    def get_queryset(self):
        user = self.request.user
        qs = Enrollment.objects.select_related("student", "course", "course__subject")
        if user.is_student:
            return qs.filter(student=user)
        if user.is_teacher:
            return qs.filter(course__teacher=user)
        return qs  # admin sees all

    def perform_create(self, serializer):
        # Prevent duplicate enrollment
        course = serializer.validated_data["course"]
        if Enrollment.objects.filter(student=self.request.user, course=course).exists():
            from rest_framework.exceptions import ValidationError
            raise ValidationError({"course": "You are already enrolled in this course."})
        serializer.save(student=self.request.user)
        logger.info(f"Student {self.request.user.email} enrolled in {course.code}")

    def destroy(self, request: Request, *args, **kwargs) -> Response:
        enrollment = self.get_object()
        if not (request.user.is_admin or enrollment.student == request.user):
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)
        enrollment.is_active = False
        enrollment.save(update_fields=["is_active"])
        logger.info(f"Enrollment {enrollment.id} deactivated.")
        return Response(status=status.HTTP_204_NO_CONTENT)
