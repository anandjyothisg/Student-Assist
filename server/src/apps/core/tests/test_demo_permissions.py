"""
Role boundaries and data scoping for the demo platform.

These tests exercise the real API with real auth (no frontend involved) to make
sure a student can't reach teacher/admin capabilities by calling endpoints
directly, teachers can only manage their own courses, and private data stays
private.
"""

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.academic.models import Course, Enrollment, Subject, Topic, Unit
from apps.accounts.models import User
from apps.chat.models import ChatSession
from apps.documents.models import Document

pytestmark = pytest.mark.django_db
PW = "Correct-Horse-42"


def client_for(user):
    c = APIClient()
    c.force_authenticate(user=user)
    return c


@pytest.fixture
def world(settings, tmp_path):
    settings.MEDIA_ROOT = str(tmp_path)
    admin = User.objects.create_user(email="admin@t.dev", password=PW, first_name="Ada", last_name="Admin", role="admin")
    t1 = User.objects.create_user(email="t1@t.dev", password=PW, first_name="Tara", last_name="One", role="teacher")
    t2 = User.objects.create_user(email="t2@t.dev", password=PW, first_name="Theo", last_name="Two", role="teacher")
    s1 = User.objects.create_user(email="s1@t.dev", password=PW, first_name="Sam", last_name="One", role="student")
    s2 = User.objects.create_user(email="s2@t.dev", password=PW, first_name="Sia", last_name="Two", role="student")
    subject = Subject.objects.create(name="CS", code="CS")
    c1 = Course.objects.create(code="C1", title="Course One", subject=subject, teacher=t1, is_published=True)
    c2 = Course.objects.create(code="C2", title="Course Two", subject=subject, teacher=t2, is_published=True)
    draft = Course.objects.create(code="D1", title="Draft", subject=subject, teacher=t1, is_published=False)
    Enrollment.objects.create(student=s1, course=c1)
    unit = Unit.objects.create(course=c1, title="Unit 1", order=1)
    topic = Topic.objects.create(unit=unit, title="Topic 1", order=1)
    doc1 = Document.objects.create(
        title="Notes 1", course=c1, topic=topic, uploaded_by=t1, file_type="txt", processing_status="completed",
        file=SimpleUploadedFile("n1.txt", b"hash tables map keys to buckets"),
    )
    doc2 = Document.objects.create(
        title="Notes 2", course=c2, uploaded_by=t2, file_type="txt", processing_status="completed",
        file=SimpleUploadedFile("n2.txt", b"private to course two"),
    )
    return locals()


# ---------------------------------------------------------------- students

def test_student_cannot_use_admin_or_teacher_apis(world):
    s = client_for(world["s1"])
    assert s.get("/api/v1/accounts/users/").status_code == 403
    assert s.post("/api/v1/academic/courses/", {"code": "X1", "title": "x", "subject": str(world["subject"].id)}).status_code == 403
    assert s.patch(f"/api/v1/academic/courses/{world['c1'].id}/", {"is_published": False}).status_code == 403
    assert s.post("/api/v1/academic/subjects/", {"name": "x", "code": "X"}).status_code == 403
    assert s.post("/api/v1/academic/units/", {"course": str(world["c1"].id), "title": "Hack"}).status_code == 403
    assert s.get("/api/v1/ai/insights/").status_code == 403
    upload = s.post(
        "/api/v1/documents/upload/",
        {"title": "x", "course": str(world["c1"].id), "file": SimpleUploadedFile("x.txt", b"x")},
        format="multipart",
    )
    assert upload.status_code == 403


def test_student_only_sees_enrolled_course_documents(world):
    s = client_for(world["s1"])
    ids = {d["id"] for d in s.get("/api/v1/documents/").data["results"]}
    assert ids == {str(world["doc1"].id)}
    assert s.get(f"/api/v1/documents/{world['doc2'].id}/").status_code == 404
    assert s.get(f"/api/v1/documents/{world['doc2'].id}/download/").status_code == 404
    assert s.get(f"/api/v1/documents/{world['doc1'].id}/download/").status_code == 200
    assert s.delete(f"/api/v1/documents/{world['doc1'].id}/").status_code == 403


def test_documents_are_not_served_from_public_media(world, client):
    assert client.get(f"/media/{world['doc1'].file.name}").status_code == 404


def test_student_cannot_ask_about_a_course_they_are_not_in(world):
    s = client_for(world["s1"])
    res = s.post("/api/chat/ask/", {"question": "what is in course two?", "course_id": str(world["c2"].id)}, format="json")
    assert res.status_code == 403
    res = s.post("/api/v1/ai/ask/", {"query": "what is in course two?", "course_id": str(world["c2"].id)}, format="json")
    assert res.status_code == 403


def test_conversations_are_private(world):
    session = ChatSession.objects.create(student=world["s1"], course=world["c1"], title="Mine")
    other = client_for(world["s2"])
    assert other.get(f"/api/chat/{session.id}/").status_code == 404
    assert str(session.id) not in {s["id"] for s in other.get("/api/chat/").data}
    res = other.post("/api/chat/ask/", {"question": "continue", "session_id": str(session.id)}, format="json")
    assert res.status_code == 403


def test_enrollment_rules(world):
    s2 = client_for(world["s2"])
    assert s2.post("/api/v1/academic/enrollments/", {"course": str(world["draft"].id)}).status_code == 400
    res = s2.post("/api/v1/academic/enrollments/", {"course": str(world["c1"].id)})
    assert res.status_code == 201
    assert s2.delete(f"/api/v1/academic/enrollments/{res.data['id']}/").status_code == 204
    # Re-enrolling after leaving reactivates the enrollment instead of failing.
    assert s2.post("/api/v1/academic/enrollments/", {"course": str(world["c1"].id)}).status_code == 201
    assert Enrollment.objects.filter(student=world["s2"], course=world["c1"]).count() == 1
    # Teachers and admins can't enroll.
    assert client_for(world["t1"]).post("/api/v1/academic/enrollments/", {"course": str(world["c2"].id)}).status_code == 403


def test_student_does_not_see_draft_courses(world):
    codes = {c["code"] for c in client_for(world["s1"]).get("/api/v1/academic/courses/").data["results"]}
    assert "D1" not in codes and {"C1", "C2"} <= codes


# ---------------------------------------------------------------- teachers

def test_teacher_cannot_edit_or_take_over_another_teachers_course(world):
    t1 = client_for(world["t1"])
    assert t1.patch(f"/api/v1/academic/courses/{world['c2'].id}/", {"title": "Mine now"}).status_code == 403
    res = t1.patch(f"/api/v1/academic/courses/{world['c1'].id}/", {"teacher": str(world["t2"].id)})
    assert res.status_code == 400
    world["c2"].refresh_from_db()
    assert world["c2"].title == "Course Two" and world["c2"].teacher == world["t2"]


def test_teacher_owns_courses_they_create(world):
    res = client_for(world["t1"]).post(
        "/api/v1/academic/courses/", {"code": "NEW1", "title": "New", "subject": str(world["subject"].id)}
    )
    assert res.status_code == 201
    assert Course.objects.get(code="NEW1").teacher == world["t1"]


def test_teacher_structure_and_upload_scope(world):
    t2 = client_for(world["t2"])
    assert t2.post("/api/v1/academic/units/", {"course": str(world["c1"].id), "title": "Nope"}).status_code == 403
    assert t2.post("/api/v1/academic/units/", {"course": str(world["c2"].id), "title": "Unit A"}).status_code == 201
    upload = t2.post(
        "/api/v1/documents/upload/",
        {"title": "x", "course": str(world["c1"].id), "file": SimpleUploadedFile("x.txt", b"x")},
        format="multipart",
    )
    assert upload.status_code == 403
    # A topic must belong to the course the file is uploaded to.
    bad_topic = t2.post(
        "/api/v1/documents/upload/",
        {"title": "x", "course": str(world["c2"].id), "topic": str(world["topic"].id), "file": SimpleUploadedFile("x.txt", b"x")},
        format="multipart",
    )
    assert bad_topic.status_code == 400


def test_teacher_roster_and_insights_are_scoped(world):
    t2 = client_for(world["t2"])
    assert t2.get(f"/api/v1/academic/courses/{world['c1'].id}/students/").status_code == 403
    roster = client_for(world["t1"]).get(f"/api/v1/academic/courses/{world['c1'].id}/students/")
    assert roster.status_code == 200 and [r["email"] for r in roster.data] == ["s1@t.dev"]
    assert t2.get("/api/v1/ai/insights/", {"course": str(world["c1"].id)}).status_code == 403
    codes = {c["code"] for c in t2.get("/api/v1/ai/insights/").data["courses"]}
    assert codes == {"C2"}


def test_teacher_cannot_read_unrelated_student_analytics(world):
    t2 = client_for(world["t2"])
    res = t2.get("/api/assistant/analytics/", {"student_id": str(world["s1"].id)})
    assert res.status_code == 403


# ---------------------------------------------------------------- admins

def test_admin_user_management(world):
    a = client_for(world["admin"])
    assert a.get("/api/v1/accounts/users/", {"search": "sam"}).status_code == 200
    res = a.patch(f"/api/v1/accounts/users/{world['s2'].id}/", {"role": "teacher"})
    assert res.status_code == 200 and res.data["role"] == "teacher"
    assert a.patch(f"/api/v1/accounts/users/{world['s2'].id}/", {"is_active": False}).status_code == 200
    world["s2"].refresh_from_db()
    assert world["s2"].is_active is False
    # Admins can't lock themselves out.
    assert a.patch(f"/api/v1/accounts/users/{world['admin'].id}/", {"is_active": False}).status_code == 400
    assert a.patch(f"/api/v1/accounts/users/{world['admin'].id}/", {"role": "student"}).status_code == 400


def test_deactivated_user_cannot_sign_in(world):
    world["s2"].is_active = False
    world["s2"].save()
    res = APIClient().post("/api/v1/auth/login/", {"email": "s2@t.dev", "password": PW}, format="json")
    assert res.status_code in (400, 401)


# ---------------------------------------------------------------- auth

def test_logout_rejects_someone_elses_refresh_token(world):
    other_refresh = str(RefreshToken.for_user(world["s2"]))
    res = client_for(world["s1"]).post("/api/v1/auth/logout/", {"refresh": other_refresh}, format="json")
    assert res.status_code == 400


def test_ai_endpoints_require_authentication(world):
    anon = APIClient()
    assert anon.get("/api/v1/ai/health/").status_code == 401
    assert anon.post("/api/chat/ask/", {"question": "hi"}, format="json").status_code == 401
    assert anon.get("/api/chat/").status_code == 401
