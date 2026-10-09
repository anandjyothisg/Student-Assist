"""
SmartStudent AI — who may read which course material.

One definition shared by the documents API, the assistant (chat and the
generators) and analytics, so the rules can't drift apart:

  admin    every course, every document version
  teacher  the courses they teach (all versions, any status)
  student  published courses they are actively enrolled in, and only the
           current, fully indexed version of each document
"""

from apps.academic.models import Course, Enrollment


def readable_courses(user):
    """Courses whose materials this user may read and ask about."""
    qs = Course.objects.select_related("subject")
    if user.is_admin:
        return qs
    if user.is_teacher:
        return qs.filter(teacher=user)
    enrolled = Enrollment.objects.filter(student=user, is_active=True).values_list("course_id", flat=True)
    return qs.filter(id__in=enrolled, is_published=True)


def can_manage_course(user, course) -> bool:
    """Admins manage every course; teachers only the courses they teach."""
    return bool(user.is_admin or (user.is_teacher and course.teacher_id == user.id))


def can_read_course(user, course) -> bool:
    if course is None:
        return False
    if can_manage_course(user, course):
        return True
    if not user.is_student or not course.is_published:
        return False
    return Enrollment.objects.filter(student=user, course=course, is_active=True).exists()


def can_read_course_id(user, course_id) -> bool:
    course = Course.objects.filter(id=course_id).first()
    return can_read_course(user, course)


def can_read_document(user, document) -> bool:
    """Managers see every version; students only the current, indexed version."""
    from apps.documents.models import DocumentStatus

    if can_manage_course(user, document.course):
        return True
    if not can_read_course(user, document.course):
        return False
    return document.is_latest and document.processing_status == DocumentStatus.COMPLETED
