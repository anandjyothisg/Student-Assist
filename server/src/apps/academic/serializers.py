"""
SmartStudent AI — Academic Serializers
"""

from rest_framework import serializers

from apps.academic.models import Course, Enrollment, Subject
from apps.accounts.serializers import UserPublicSerializer


class SubjectSerializer(serializers.ModelSerializer):
    created_by = UserPublicSerializer(read_only=True)
    course_count = serializers.SerializerMethodField()

    class Meta:
        model = Subject
        fields = (
            "id",
            "name",
            "code",
            "description",
            "is_active",
            "created_by",
            "course_count",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_by", "created_at", "updated_at")

    def get_course_count(self, obj: Subject) -> int:
        return obj.courses.count()


class SubjectWriteSerializer(serializers.ModelSerializer):
    """Used for create / update operations."""

    class Meta:
        model = Subject
        fields = ("name", "code", "description", "is_active")

    def validate_code(self, value: str) -> str:
        return value.strip().upper()


class CourseListSerializer(serializers.ModelSerializer):
    """Compact representation for list endpoints."""

    subject_name = serializers.CharField(source="subject.name", read_only=True)
    teacher_name = serializers.SerializerMethodField()
    enrolled_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Course
        fields = (
            "id",
            "code",
            "title",
            "subject_name",
            "teacher_name",
            "is_published",
            "enrollment_open",
            "enrolled_count",
            "thumbnail",
            "created_at",
        )
        read_only_fields = fields

    def get_teacher_name(self, obj: Course) -> str | None:
        return obj.teacher.get_full_name() if obj.teacher else None


class CourseDetailSerializer(serializers.ModelSerializer):
    """Full detail representation."""

    subject = SubjectSerializer(read_only=True)
    teacher = UserPublicSerializer(read_only=True)
    enrolled_count = serializers.SerializerMethodField()

    class Meta:
        model = Course
        fields = (
            "id",
            "code",
            "title",
            "description",
            "subject",
            "teacher",
            "thumbnail",
            "is_published",
            "enrollment_open",
            "enrolled_count",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")

    def get_enrolled_count(self, obj: Course) -> int:
        return obj.enrolled_count


class CourseWriteSerializer(serializers.ModelSerializer):
    """Used for create / update by teacher or admin."""

    class Meta:
        model = Course
        fields = (
            "title",
            "description",
            "code",
            "subject",
            "teacher",
            "thumbnail",
            "is_published",
            "enrollment_open",
        )

    def validate_code(self, value: str) -> str:
        return value.strip().upper()


class EnrollmentSerializer(serializers.ModelSerializer):
    course = CourseListSerializer(read_only=True)
    student = UserPublicSerializer(read_only=True)

    class Meta:
        model = Enrollment
        fields = ("id", "student", "course", "is_active", "enrolled_at", "created_at")
        read_only_fields = fields


class EnrollmentCreateSerializer(serializers.ModelSerializer):
    """Used when a student or admin creates an enrollment."""

    class Meta:
        model = Enrollment
        fields = ("course",)

    def validate_course(self, course: Course) -> Course:
        if not course.is_published:
            raise serializers.ValidationError("This course is not published.")
        if not course.enrollment_open:
            raise serializers.ValidationError("Enrollment for this course is closed.")
        return course
