"""
SmartStudent AI — Academic Views
"""

import logging

from django.db.models import Count, Q
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet

from apps.academic.models import Course, Enrollment, Subject, Topic, Unit
from apps.academic.serializers import (
    CourseDetailSerializer,
    CourseListSerializer,
    CourseWriteSerializer,
    EnrollmentCreateSerializer,
    EnrollmentSerializer,
    SubjectSerializer,
    SubjectWriteSerializer,
    TopicSerializer,
    UnitSerializer,
)
from apps.core.pagination import StandardPagination
from apps.core.permissions import IsAdmin, IsAdminOrTeacher

logger = logging.getLogger("apps.academic")


def can_manage_course(user, course: Course) -> bool:
    """Admins manage every course; teachers only the courses they teach."""
    return bool(user.is_admin or (user.is_teacher and course.teacher_id == user.id))


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
        logger.info(f"Subject '{serializer.instance.code}' created by user {self.request.user.pk}")

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        return Response(SubjectSerializer(serializer.instance).data, status=status.HTTP_201_CREATED)

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(SubjectSerializer(instance).data)


class CourseViewSet(ModelViewSet):
    """
    CRUD for courses.
    - List / Retrieve: all authenticated users (filtered by role)
    - Create: admin or teacher (teachers always own what they create)
    - Update: admin, or the teacher who owns the course
    - Delete: admin only
    """

    pagination_class = StandardPagination
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_permissions(self):
        if self.action in ("list", "retrieve", "structure"):
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
        qs = Course.objects.select_related("subject", "teacher").annotate(
            active_enrollments=Count("enrollments", filter=Q(enrollments__is_active=True), distinct=True)
        )

        if user.is_student:
            qs = qs.filter(is_published=True)
        elif user.is_teacher:
            scope = self.request.query_params.get("scope")
            qs = qs.filter(teacher=user) if scope == "mine" else qs.filter(Q(is_published=True) | Q(teacher=user))

        subject = self.request.query_params.get("subject")
        if subject:
            qs = qs.filter(subject__code__iexact=subject)
        if self.request.query_params.get("enrolled") == "true" and user.is_student:
            qs = qs.filter(enrollments__student=user, enrollments__is_active=True)

        return qs.order_by("code").distinct()

    def perform_create(self, serializer):
        if self.request.user.is_teacher:
            serializer.save(teacher=self.request.user)
        else:
            serializer.save()
        logger.info(f"Course '{serializer.instance.code}' created by user {self.request.user.pk}")

    def perform_update(self, serializer):
        if not can_manage_course(self.request.user, serializer.instance):
            raise PermissionDenied("You can only edit courses you teach.")
        serializer.save()

    def _respond_list_item(self, course, status_code=status.HTTP_200_OK):
        course = self.get_queryset().filter(pk=course.pk).first() or course
        return Response(CourseListSerializer(course, context={"request": self.request}).data, status=status_code)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        return self._respond_list_item(serializer.instance, status.HTTP_201_CREATED)

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        return self._respond_list_item(instance)

    def update(self, request, *args, **kwargs):
        kwargs["partial"] = True
        return self.partial_update(request, *args, **kwargs)

    def _assert_can_view_structure(self, course):
        user = self.request.user
        if user.is_admin or course.teacher_id == user.id:
            return
        if user.is_student and course.is_published:
            return
        if user.is_teacher and course.is_published:
            return
        raise PermissionDenied("You don't have access to this course.")

    @action(detail=True, methods=["get"])
    def structure(self, request: Request, pk=None) -> Response:
        """GET /courses/{id}/structure/ — units → topics, with document counts."""
        course = self.get_object()
        self._assert_can_view_structure(course)
        units = course.units.prefetch_related("topics")
        return Response(UnitSerializer(units, many=True).data)

    @action(detail=True, methods=["get"], permission_classes=[IsAuthenticated])
    def enrollments(self, request: Request, pk=None) -> Response:
        """GET /courses/{id}/enrollments/ — the course teacher or an admin."""
        course = self.get_object()
        if not can_manage_course(request.user, course):
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)
        qs = course.enrollments.select_related("student").filter(is_active=True)
        return Response(EnrollmentSerializer(qs, many=True, context={"request": request}).data)

    @action(detail=True, methods=["get"], permission_classes=[IsAuthenticated])
    def students(self, request: Request, pk=None) -> Response:
        """GET /courses/{id}/students/ — roster with simple engagement stats."""
        from apps.chat.models import ChatMessage

        course = self.get_object()
        if not can_manage_course(request.user, course):
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)

        enrollments = course.enrollments.select_related("student").filter(is_active=True)
        question_counts = {
            row["session__student"]: row["n"]
            for row in ChatMessage.objects.filter(role="user", session__course=course)
            .values("session__student")
            .annotate(n=Count("id"))
        }
        rows = []
        for e in enrollments:
            s = e.student
            rows.append({
                "id": str(s.id),
                "full_name": s.get_full_name(),
                "email": s.email,
                "student_number": s.student_number,
                "program": s.program,
                "year_of_study": s.year_of_study,
                "enrolled_at": e.enrolled_at,
                "questions_asked": question_counts.get(s.id, 0),
            })
        rows.sort(key=lambda r: r["full_name"].lower())
        return Response(rows)


class EnrollmentViewSet(ModelViewSet):
    """
    Manages student enrollments.
    - List: students see their own; teachers see their courses'; admins see all
    - Create: students only, into a published course with enrollment open
    - Destroy: admin or the enrolled student (soft delete)
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
        qs = Enrollment.objects.select_related("student", "course", "course__subject", "course__teacher")
        if user.is_student:
            return qs.filter(student=user, is_active=True)
        if user.is_teacher:
            return qs.filter(course__teacher=user, is_active=True)
        return qs

    def create(self, request, *args, **kwargs):
        if not request.user.is_student:
            raise PermissionDenied("Only students can enroll in courses.")
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        course = serializer.validated_data["course"]

        enrollment = Enrollment.objects.filter(student=request.user, course=course).first()
        if enrollment and enrollment.is_active:
            raise ValidationError({"course": "You are already enrolled in this course."})
        if enrollment:
            enrollment.is_active = True
            enrollment.save(update_fields=["is_active", "updated_at"])
        else:
            enrollment = Enrollment.objects.create(student=request.user, course=course)
        logger.info(f"Student user {request.user.pk} enrolled in {course.code}")
        return Response(EnrollmentSerializer(enrollment, context={"request": request}).data, status=status.HTTP_201_CREATED)

    def destroy(self, request: Request, *args, **kwargs) -> Response:
        enrollment = self.get_object()
        if not (request.user.is_admin or enrollment.student == request.user):
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)
        enrollment.is_active = False
        enrollment.save(update_fields=["is_active"])
        logger.info(f"Enrollment {enrollment.id} deactivated.")
        return Response(status=status.HTTP_204_NO_CONTENT)


class UnitViewSet(ModelViewSet):
    """
    Units inside a course: /academic/units/?course=<id>
    Read: anyone who can see the course. Write: the course teacher or an admin.
    """

    serializer_class = UnitSerializer
    pagination_class = None
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = Unit.objects.select_related("course").prefetch_related("topics")
        if user.is_student:
            qs = qs.filter(course__is_published=True)
        elif user.is_teacher:
            qs = qs.filter(Q(course__is_published=True) | Q(course__teacher=user))
        course = self.request.query_params.get("course")
        if course:
            qs = qs.filter(course_id=course)
        return qs

    def perform_create(self, serializer):
        course_id = self.request.data.get("course")
        course = Course.objects.filter(pk=course_id).first()
        if not course:
            raise ValidationError({"course": "Course not found."})
        if not can_manage_course(self.request.user, course):
            raise PermissionDenied("You can only add units to courses you teach.")
        order = serializer.validated_data.get("order") or (course.units.count() + 1)
        serializer.save(course=course, order=order)

    def perform_update(self, serializer):
        if not can_manage_course(self.request.user, serializer.instance.course):
            raise PermissionDenied("You can only edit units in courses you teach.")
        serializer.save()

    def perform_destroy(self, instance):
        if not can_manage_course(self.request.user, instance.course):
            raise PermissionDenied("You can only delete units in courses you teach.")
        if instance.topics.filter(documents__isnull=False).exists():
            raise ValidationError({"detail": "Move or delete this unit's documents first."})
        instance.delete()


class TopicViewSet(ModelViewSet):
    """Topics inside a unit: /academic/topics/?unit=<id>"""

    serializer_class = TopicSerializer
    pagination_class = None
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = Topic.objects.select_related("unit__course")
        if user.is_student:
            qs = qs.filter(unit__course__is_published=True)
        elif user.is_teacher:
            qs = qs.filter(Q(unit__course__is_published=True) | Q(unit__course__teacher=user))
        unit = self.request.query_params.get("unit")
        if unit:
            qs = qs.filter(unit_id=unit)
        return qs

    def perform_create(self, serializer):
        unit = Unit.objects.select_related("course").filter(pk=self.request.data.get("unit")).first()
        if not unit:
            raise ValidationError({"unit": "Unit not found."})
        if not can_manage_course(self.request.user, unit.course):
            raise PermissionDenied("You can only add topics to courses you teach.")
        order = serializer.validated_data.get("order") or (unit.topics.count() + 1)
        serializer.save(unit=unit, order=order)

    def perform_update(self, serializer):
        if not can_manage_course(self.request.user, serializer.instance.unit.course):
            raise PermissionDenied("You can only edit topics in courses you teach.")
        serializer.save()

    def perform_destroy(self, instance):
        if not can_manage_course(self.request.user, instance.unit.course):
            raise PermissionDenied("You can only delete topics in courses you teach.")
        if instance.documents.exists():
            raise ValidationError({"detail": "Move or delete this topic's documents first."})
        instance.delete()
