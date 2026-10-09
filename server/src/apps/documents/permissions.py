"""
SmartStudent AI — Document Permissions
"""

from rest_framework.permissions import BasePermission, SAFE_METHODS

from apps.core.access import can_manage_course, can_read_document


class IsDocumentAccessAllowed(BasePermission):
    """
    Object-level access to a Document (rules live in apps.core.access):

    - Admin, and the teacher of the document's course: full access.
    - Student: read-only, published course they're actively enrolled in,
      current fully-indexed version only.
    """

    message = "You do not have permission to access this document."

    def has_permission(self, request, view) -> bool:
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj) -> bool:
        user = request.user
        if can_manage_course(user, obj.course):
            return True
        if request.method not in SAFE_METHODS:
            return False
        return can_read_document(user, obj)
