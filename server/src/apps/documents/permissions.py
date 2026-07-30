"""
SmartStudent AI — Document Permissions
"""

from rest_framework.permissions import BasePermission, SAFE_METHODS

from apps.academic.models import Enrollment


class IsDocumentAccessAllowed(BasePermission):
    """
    Role-based permission check for Document resources.
    
    - Admin: Full CRUD access.
    - Teacher: Full CRUD access for documents within their own courses, 
      or if they were the uploader.
    - Student: Read-only access to documents of courses they are actively enrolled in.
    """
    message = "You do not have permission to access this document."

    def has_permission(self, request, view) -> bool:
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj) -> bool:
        user = request.user
        
        # Admins have full access
        if user.role == "admin":
            return True

        # Teachers can manage documents in courses they teach or if they uploaded it
        if user.role == "teacher":
            # Allow full CRUD if they are the teacher of the course or uploaded the document
            is_course_teacher = obj.course.teacher == user
            is_uploader = obj.uploaded_by == user
            return is_course_teacher or is_uploader

        # Students have read-only access to courses they are enrolled in
        if user.role == "student":
            if request.method not in SAFE_METHODS:
                return False
            
            # Must have an active enrollment in the course
            return Enrollment.objects.filter(
                student=user,
                course=obj.course,
                is_active=True
            ).exists()

        return False
