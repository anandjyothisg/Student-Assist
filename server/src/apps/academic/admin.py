"""
SmartStudent AI — Academic Admin Configuration
"""

from django.contrib import admin
from django.utils.html import format_html

from apps.academic.models import Course, Enrollment, Subject


@admin.register(Subject)
class SubjectAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "is_active", "created_by", "created_at")
    list_filter = ("is_active", "created_at")
    search_fields = ("code", "name")
    readonly_fields = ("id", "created_at", "updated_at")
    ordering = ("name",)

    fieldsets = (
        (None, {"fields": ("id", "code", "name", "description")}),
        ("Status", {"fields": ("is_active", "created_by")}),
        ("Timestamps", {"fields": ("created_at", "updated_at"), "classes": ("collapse",)}),
    )


class EnrollmentInline(admin.TabularInline):
    model = Enrollment
    extra = 0
    readonly_fields = ("student", "enrolled_at", "is_active")
    fields = ("student", "enrolled_at", "is_active")
    can_delete = False


@admin.register(Course)
class CourseAdmin(admin.ModelAdmin):
    list_display = (
        "code",
        "title",
        "subject",
        "teacher",
        "is_published",
        "enrollment_open",
        "enrolled_count_display",
        "created_at",
    )
    list_filter = ("is_published", "enrollment_open", "subject", "created_at")
    search_fields = ("code", "title", "teacher__email", "teacher__first_name")
    readonly_fields = ("id", "created_at", "updated_at")
    ordering = ("-created_at",)
    inlines = [EnrollmentInline]

    fieldsets = (
        (None, {"fields": ("id", "code", "title", "description", "subject", "teacher")}),
        ("Media", {"fields": ("thumbnail",)}),
        ("Settings", {"fields": ("is_published", "enrollment_open")}),
        ("Timestamps", {"fields": ("created_at", "updated_at"), "classes": ("collapse",)}),
    )

    def enrolled_count_display(self, obj: Course) -> str:
        return obj.enrolled_count

    enrolled_count_display.short_description = "Enrolled"


@admin.register(Enrollment)
class EnrollmentAdmin(admin.ModelAdmin):
    list_display = ("student", "course", "is_active", "enrolled_at")
    list_filter = ("is_active", "course__subject", "enrolled_at")
    search_fields = (
        "student__email",
        "student__first_name",
        "student__last_name",
        "course__code",
        "course__title",
    )
    readonly_fields = ("id", "enrolled_at", "created_at", "updated_at")
    ordering = ("-enrolled_at",)
