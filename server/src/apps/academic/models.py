"""
SmartStudent AI — Academic Models

Hierarchy:
    Subject  →  Course  →  Enrollment (Student ↔ Course many-to-many through table)
"""

from django.conf import settings
from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.core.models import BaseModel


def course_thumbnail_upload(instance: "Course", filename: str) -> str:
    ext = filename.rsplit(".", 1)[-1]
    return f"course_thumbnails/{instance.id}.{ext}"


# ---------------------------------------------------------------------------
# Subject
# ---------------------------------------------------------------------------


class Subject(BaseModel):
    """
    Top-level academic domain (e.g. "Computer Science", "Mathematics").
    Created by admins or teachers.
    """

    name = models.CharField(_("name"), max_length=200)
    code = models.CharField(_("code"), max_length=20, unique=True, db_index=True)
    description = models.TextField(_("description"), blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_subjects",
        verbose_name=_("created by"),
    )
    is_active = models.BooleanField(_("active"), default=True, db_index=True)

    class Meta:
        db_table = "academic_subject"
        verbose_name = _("Subject")
        verbose_name_plural = _("Subjects")
        ordering = ["name"]

    def __str__(self) -> str:
        return f"{self.code} — {self.name}"


# ---------------------------------------------------------------------------
# Course
# ---------------------------------------------------------------------------


class Course(BaseModel):
    """
    A course within a subject, taught by a teacher.
    Students enroll via the Enrollment model.
    """

    title = models.CharField(_("title"), max_length=300)
    description = models.TextField(_("description"), blank=True)
    code = models.CharField(_("code"), max_length=30, unique=True, db_index=True)
    subject = models.ForeignKey(
        Subject,
        on_delete=models.CASCADE,
        related_name="courses",
        verbose_name=_("subject"),
    )
    teacher = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="taught_courses",
        verbose_name=_("teacher"),
        limit_choices_to={"role__in": ["teacher", "admin"]},
    )
    thumbnail = models.ImageField(
        _("thumbnail"),
        upload_to=course_thumbnail_upload,
        null=True,
        blank=True,
    )
    is_published = models.BooleanField(_("published"), default=False, db_index=True)
    enrollment_open = models.BooleanField(_("enrollment open"), default=True)

    class Meta:
        db_table = "academic_course"
        verbose_name = _("Course")
        verbose_name_plural = _("Courses")
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.code} — {self.title}"

    @property
    def enrolled_count(self) -> int:
        return self.enrollments.filter(is_active=True).count()


# ---------------------------------------------------------------------------
# Enrollment
# ---------------------------------------------------------------------------


class Enrollment(BaseModel):
    """
    Through model connecting a Student (User) to a Course.
    Unique constraint prevents double-enrollment.
    """

    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="enrollments",
        verbose_name=_("student"),
        limit_choices_to={"role": "student"},
    )
    course = models.ForeignKey(
        Course,
        on_delete=models.CASCADE,
        related_name="enrollments",
        verbose_name=_("course"),
    )
    is_active = models.BooleanField(_("active"), default=True, db_index=True)
    enrolled_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "academic_enrollment"
        verbose_name = _("Enrollment")
        verbose_name_plural = _("Enrollments")
        unique_together = [["student", "course"]]
        ordering = ["-enrolled_at"]

    def __str__(self) -> str:
        return f"{self.student.get_full_name()} → {self.course.code}"


# ---------------------------------------------------------------------------
# Course structure: Unit → Topic (documents attach to a Topic)
# ---------------------------------------------------------------------------


class Unit(BaseModel):
    """A unit / module inside a course (e.g. "Unit 2 · Search and Problem Solving")."""

    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="units", verbose_name=_("course"))
    title = models.CharField(_("title"), max_length=200)
    description = models.TextField(_("description"), blank=True)
    order = models.PositiveIntegerField(_("order"), default=0, db_index=True)

    class Meta:
        db_table = "academic_unit"
        verbose_name = _("Unit")
        verbose_name_plural = _("Units")
        ordering = ["order", "created_at"]

    def __str__(self) -> str:
        return f"{self.course.code} · {self.title}"


class Topic(BaseModel):
    """A topic inside a unit. Documents are filed under topics."""

    unit = models.ForeignKey(Unit, on_delete=models.CASCADE, related_name="topics", verbose_name=_("unit"))
    title = models.CharField(_("title"), max_length=200)
    description = models.TextField(_("description"), blank=True)
    order = models.PositiveIntegerField(_("order"), default=0, db_index=True)

    class Meta:
        db_table = "academic_topic"
        verbose_name = _("Topic")
        verbose_name_plural = _("Topics")
        ordering = ["order", "created_at"]

    def __str__(self) -> str:
        return f"{self.unit} · {self.title}"
