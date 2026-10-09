"""
SmartStudent AI — Academic Serializers
"""

from rest_framework import serializers

from apps.academic.models import Course, Enrollment, Subject, Topic, Unit
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
    subject_code = serializers.CharField(source="subject.code", read_only=True)
    teacher_name = serializers.SerializerMethodField()
    enrolled_count = serializers.SerializerMethodField()
    unit_count = serializers.SerializerMethodField()
    document_count = serializers.SerializerMethodField()
    is_enrolled = serializers.SerializerMethodField()

    class Meta:
        model = Course
        fields = (
            "id",
            "code",
            "title",
            "description",
            "subject",
            "subject_name",
            "subject_code",
            "teacher",
            "teacher_name",
            "is_published",
            "enrollment_open",
            "enrolled_count",
            "unit_count",
            "document_count",
            "is_enrolled",
            "thumbnail",
            "created_at",
        )
        read_only_fields = fields

    def get_teacher_name(self, obj: Course) -> str | None:
        return obj.teacher.get_full_name() if obj.teacher else None

    def get_enrolled_count(self, obj: Course) -> int:
        annotated = getattr(obj, "active_enrollments", None)
        return annotated if annotated is not None else obj.enrolled_count

    def get_unit_count(self, obj: Course) -> int:
        return obj.units.count()

    def get_document_count(self, obj: Course) -> int:
        return obj.documents.filter(is_latest=True, processing_status="completed").count()

    def get_is_enrolled(self, obj: Course) -> bool:
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False
        return obj.enrollments.filter(student=request.user, is_active=True).exists()


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

    def validate_teacher(self, value):
        request = self.context.get("request")
        if request and not request.user.is_admin:
            # Covers null too: a teacher must not be able to orphan their own course.
            if self.instance is None:
                allowed = value is None or value == request.user  # create: the view assigns the requester
            else:
                allowed = value == self.instance.teacher
            if not allowed:
                raise serializers.ValidationError("Only administrators can change a course's teacher.")
        if value is not None and value.role not in ("teacher", "admin"):
            raise serializers.ValidationError("A course can only be assigned to a teacher.")
        return value


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


# ---------------------------------------------------------------------------
# Course structure
# ---------------------------------------------------------------------------


class TopicSerializer(serializers.ModelSerializer):
    document_count = serializers.SerializerMethodField()

    class Meta:
        model = Topic
        fields = ("id", "unit", "title", "description", "order", "document_count", "created_at")
        read_only_fields = ("id", "unit", "document_count", "created_at")

    def get_document_count(self, obj: Topic) -> int:
        return obj.documents.filter(is_latest=True).count()


class UnitSerializer(serializers.ModelSerializer):
    topics = TopicSerializer(many=True, read_only=True)

    class Meta:
        model = Unit
        fields = ("id", "course", "title", "description", "order", "topics", "created_at")
        read_only_fields = ("id", "course", "topics", "created_at")
