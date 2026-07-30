"""
SmartStudent AI — Custom DRF Permission Classes

Usage:
    from apps.core.permissions import IsAdmin, IsTeacher, IsStudent, IsAdminOrTeacher

Each permission checks request.user.role against the expected role value.
"""

from rest_framework.permissions import BasePermission, SAFE_METHODS


class IsAdmin(BasePermission):
    """Allow access only to users with role ADMIN."""

    message = "Access restricted to administrators."

    def has_permission(self, request, view) -> bool:
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role == "admin"
        )


class IsTeacher(BasePermission):
    """Allow access only to users with role TEACHER."""

    message = "Access restricted to teachers."

    def has_permission(self, request, view) -> bool:
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role == "teacher"
        )


class IsStudent(BasePermission):
    """Allow access only to users with role STUDENT."""

    message = "Access restricted to students."

    def has_permission(self, request, view) -> bool:
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role == "student"
        )


class IsAdminOrTeacher(BasePermission):
    """Allow access to admins and teachers."""

    message = "Access restricted to administrators and teachers."

    def has_permission(self, request, view) -> bool:
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role in ("admin", "teacher")
        )


class IsAdminOrReadOnly(BasePermission):
    """Read access for all authenticated users; write access for admins only."""

    message = "Write access restricted to administrators."

    def has_permission(self, request, view) -> bool:
        if not (request.user and request.user.is_authenticated):
            return False
        if request.method in SAFE_METHODS:
            return True
        return request.user.role == "admin"


class IsOwnerOrAdmin(BasePermission):
    """
    Object-level permission.
    Allows access if the user owns the object (obj.user == request.user)
    or the user is an admin.
    """

    message = "You do not have permission to access this resource."

    def has_object_permission(self, request, view, obj) -> bool:
        if request.user.role == "admin":
            return True
        owner = getattr(obj, "user", None) or getattr(obj, "student", None) or getattr(obj, "uploaded_by", None)
        return owner == request.user


class IsEnrolledStudent(BasePermission):
    """
    Object-level permission.
    Allows student access only if they are enrolled in the related course.
    Check is deferred to the view layer for flexibility.
    """

    message = "You are not enrolled in this course."

    def has_permission(self, request, view) -> bool:
        return bool(request.user and request.user.is_authenticated)
