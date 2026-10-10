"""
Security regressions found in the production-readiness audit.

Each test pins a specific defect (S1–S11 in the audit register) so it can't
silently come back.
"""

import io
import os
import subprocess
import sys
import zipfile
from pathlib import Path

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.core.management.base import CommandError
from rest_framework.test import APIClient, APIRequestFactory, force_authenticate
from rest_framework_simplejwt.tokens import RefreshToken

from apps.academic.models import Course, Enrollment, Subject, Topic, Unit
from apps.accounts.models import PasswordResetOTP, User
from apps.chat.models import AnswerStatus, ChatMessage, ChatSession
from apps.documents.models import Document

pytestmark = pytest.mark.django_db
PW = "Correct-Horse-42"
SRC = Path(__file__).resolve().parents[3]


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
    Enrollment.objects.create(student=s1, course=c1)
    Enrollment.objects.create(student=s1, course=c2)
    unit = Unit.objects.create(course=c1, title="Unit 1", order=1)
    topic = Topic.objects.create(unit=unit, title="Topic 1", order=1)
    v1 = Document.objects.create(
        title="Notes", course=c1, topic=topic, uploaded_by=t1, file_type="txt", processing_status="completed",
        is_latest=False, version=1, file=SimpleUploadedFile("n1.txt", b"old version text"),
    )
    v2 = Document.objects.create(
        title="Notes", course=c1, topic=topic, uploaded_by=t1, file_type="txt", processing_status="completed",
        is_latest=True, version=2, parent=v1, file=SimpleUploadedFile("n2.txt", b"current version text"),
    )
    return locals()


# ---------------------------------------------------------------- S1 media

def test_private_documents_are_not_reachable_through_public_media(world, settings):
    doc = world["v2"]
    rel = doc.file.name  # documents/course_<id>/n2...txt
    anon = APIClient()
    for path in (f"/media/{rel}", f"/media/avatars/../{rel}", f"/media/avatars/..%2F{rel}", f"/media/avatars//../{rel}"):
        assert anon.get(path).status_code == 404, path


def test_public_avatars_are_still_served(world, settings):
    avatars = Path(settings.MEDIA_ROOT) / "avatars"
    avatars.mkdir(parents=True)
    (avatars / "a.png").write_bytes(b"\x89PNG\r\n\x1a\n")
    res = APIClient().get("/media/avatars/a.png")
    assert res.status_code == 200
    assert res["X-Content-Type-Options"] == "nosniff"


# ---------------------------------------------------------------- S2 seed guard

def test_seed_demo_refuses_to_run_outside_development(settings):
    settings.DEBUG = False
    with pytest.raises(CommandError, match="only runs on a local development"):
        call_command("seed_demo", "--no-history", "--no-flashcards")


def test_seed_demo_reset_refuses_non_sqlite(settings):
    settings.DEBUG = True
    settings.DATABASES = {**settings.DATABASES, "default": {**settings.DATABASES["default"], "ENGINE": "django.db.backends.postgresql"}}
    with pytest.raises(CommandError, match="only allowed on the SQLite"):
        call_command("seed_demo", "--reset", "--yes")


# ---------------------------------------------------------------- S3 settings selection

def _settings_probe(env):
    code = "import django; django.setup(); from django.conf import settings; print(settings.DEBUG)"
    full_env = {**os.environ, "DJANGO_SETTINGS_MODULE": "config.settings", **env}
    return subprocess.run([sys.executable, "-c", code], cwd=SRC, env=full_env, capture_output=True, text=True, timeout=120)


def test_development_settings_refuse_a_public_host():
    res = _settings_probe({"DJANGO_ENV": "development", "DJANGO_ALLOWED_HOSTS": "studentassist.example.com"})
    assert res.returncode != 0 and "Set DJANGO_ENV=production" in res.stderr


def test_unknown_environment_name_is_rejected():
    res = _settings_probe({"DJANGO_ENV": "prod"})
    assert res.returncode != 0 and "Unknown DJANGO_ENV" in res.stderr


# ---------------------------------------------------------------- S5 document scoping

def test_student_loses_document_access_when_course_is_unpublished(world):
    s = client_for(world["s1"])
    assert s.get(f"/api/v1/documents/{world['v2'].id}/").status_code == 200
    Course.objects.filter(id=world["c1"].id).update(is_published=False)
    assert s.get(f"/api/v1/documents/{world['v2'].id}/").status_code == 404
    assert s.get(f"/api/v1/documents/{world['v2'].id}/download/").status_code == 404
    assert world["v2"].id not in {d["id"] for d in s.get("/api/v1/documents/").data["results"]}


def test_student_cannot_see_superseded_versions(world):
    s = client_for(world["s1"])
    ids = {str(d["id"]) for d in s.get("/api/v1/documents/", {"all_versions": "true"}).data["results"]}
    assert str(world["v1"].id) not in ids and str(world["v2"].id) in ids
    assert s.get(f"/api/v1/documents/{world['v1'].id}/").status_code == 404
    assert s.get(f"/api/v1/documents/{world['v1'].id}/download/").status_code == 404
    # The course teacher still sees the history.
    t = client_for(world["t1"])
    ids = {str(d["id"]) for d in t.get("/api/v1/documents/", {"all_versions": "true"}).data["results"]}
    assert {str(world["v1"].id), str(world["v2"].id)} <= ids


# ---------------------------------------------------------------- S4 generators

def test_flashcards_respect_publication_and_ownership(world):
    url = "/api/assistant/flashcard/generate/"
    Course.objects.filter(id=world["c1"].id).update(is_published=False)
    assert client_for(world["s1"]).post(url, {"document_id": str(world["v2"].id)}, format="json").status_code == 403
    assert client_for(world["t2"]).post(url, {"document_id": str(world["v2"].id)}, format="json").status_code == 403
    res = client_for(world["t1"]).post(url, {"document_id": str(world["v2"].id), "count": 500}, format="json")
    assert res.status_code == 400  # count is bounded


def test_legacy_assistant_routes_are_not_mounted(world):
    t = client_for(world["t1"])
    for url in ("/api/assistant/summarize/", "/api/assistant/quiz/generate/", "/api/assistant/viva/generate/",
                "/api/assistant/concept/extract/", "/api/assistant/glossary/generate/", "/api/v1/assistant/conversations/",
                "/api/v1/assistant/ask/", "/api/v1/ai/ask/"):
        assert t.post(url, {}, format="json").status_code == 404, url


def test_conversation_serializer_rejects_unreadable_courses(world, rf):
    from apps.assistant.serializers import ConversationCreateSerializer

    req = rf.post("/")
    req.user = world["t2"]  # teaches C2, not C1
    ser = ConversationCreateSerializer(data={"course": str(world["c1"].id), "title": "x"}, context={"request": req})
    assert not ser.is_valid()


# ---------------------------------------------------------------- S6 analytics

def test_learning_analytics_only_cover_the_teachers_own_courses(world):
    from apps.assistant.views import LearningAnalyticsView

    ChatSession.objects.create(student=world["s1"], course=world["c2"], title="Course two private question")
    t1 = world["t1"]
    req = APIRequestFactory().get("/x", {"student_id": str(world["s1"].id), "course_id": str(world["c2"].id)})
    force_authenticate(req, user=t1)
    assert LearningAnalyticsView.as_view()(req).status_code == 403
    req = APIRequestFactory().get("/x", {"student_id": str(world["s1"].id), "course_id": "not-a-uuid"})
    force_authenticate(req, user=t1)
    assert LearningAnalyticsView.as_view()(req).status_code == 400


def _qa(student, course, question, status=AnswerStatus.ANSWERED, citations=None, active=True):
    session = ChatSession.objects.create(student=student, course=course, title=question, is_active=active)
    ChatMessage.objects.create(session=session, role="user", content=question)
    ChatMessage.objects.create(session=session, role="assistant", content="a", status=status, citations=citations or [])
    return session


def test_insights_ignore_deleted_sessions_and_unenrolled_students(world):
    t1 = client_for(world["t1"])
    _qa(world["s1"], world["c1"], "visible question")
    _qa(world["s1"], world["c1"], "deleted question", active=False)
    # s2 isn't enrolled in C1; an all-courses answer citing C1 must not count for C1.
    _qa(world["s2"], None, "unenrolled question", citations=[{"course_id": str(world["c1"].id)}])
    data = t1.get("/api/v1/ai/insights/").data
    assert data["totals"]["questions"] == 1
    asked = {q["question"] for q in data["top_questions"]}
    assert asked == {"visible question"}


def test_insights_previous_period_is_scoped_to_the_teacher(world):
    data = client_for(world["t1"]).get("/api/v1/ai/insights/").data
    _qa(world["s1"], world["c2"], "someone else's course")
    assert client_for(world["t1"]).get("/api/v1/ai/insights/").data["totals"]["questions"] == data["totals"]["questions"]


# ---------------------------------------------------------------- S11 malformed input

@pytest.mark.parametrize("url", [
    "/api/v1/documents/?course=not-a-uuid",
    "/api/v1/documents/?topic=1;drop",
    "/api/v1/academic/units/?course=x",
    "/api/chat/?course=x",
    "/api/v1/ai/insights/?course=x",
    "/api/v1/ai/insights/?days=abc",
])
def test_malformed_query_parameters_are_400_not_500(world, url):
    assert client_for(world["t1"]).get(url).status_code == 400


def test_refresh_token_for_deleted_user_is_401(world):
    refresh = str(RefreshToken.for_user(world["s2"]))
    world["s2"].delete()
    res = APIClient().post("/api/v1/auth/token/refresh/", {"refresh": refresh}, format="json")
    assert res.status_code == 401


def test_course_teacher_cannot_be_cleared_by_a_teacher(world):
    res = client_for(world["t1"]).patch(f"/api/v1/academic/courses/{world['c1'].id}/", {"teacher": None}, format="json")
    assert res.status_code == 400
    world["c1"].refresh_from_db()
    assert world["c1"].teacher_id == world["t1"].id


def _upload(user, name, content, course):
    return client_for(user).post(
        "/api/v1/documents/upload/",
        {"file": SimpleUploadedFile(name, content), "title": "Upload", "course": str(course.id)},
        format="multipart",
    )


def test_uploads_must_match_their_extension(world):
    t1, c1 = world["t1"], world["c1"]
    assert _upload(t1, "fake.pdf", b"<html><script>alert(1)</script></html>", c1).status_code == 400
    assert _upload(t1, "empty.txt", b"", c1).status_code == 400
    assert _upload(t1, "fake.docx", b"PK\x03\x04 not really a zip", c1).status_code == 400
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr("hello.txt", "not a word document")
    assert _upload(t1, "wrong.docx", buf.getvalue(), c1).status_code == 400


def test_valid_text_upload_is_accepted(world, monkeypatch):
    monkeypatch.setattr("apps.documents.services.dispatch.dispatch_processing", lambda *a, **k: "sync")
    res = _upload(world["t1"], "ok.txt", b"Binary search halves the interval each step.", world["c1"])
    assert res.status_code in (201, 202), res.data


# ---------------------------------------------------------------- S8 OTP

def test_otp_attempts_cannot_exceed_the_limit(world):
    from django.contrib.auth.hashers import make_password
    from django.utils import timezone
    from datetime import timedelta

    otp = PasswordResetOTP.objects.create(
        user=world["s1"], otp_hash=make_password("123456"), expires_at=timezone.now() + timedelta(minutes=10)
    )
    c = APIClient()
    for _ in range(PasswordResetOTP.MAX_ATTEMPTS + 3):
        c.post("/api/v1/auth/password/verify-otp/", {"email": "s1@t.dev", "otp": "000000"}, format="json")
    otp.refresh_from_db()
    assert otp.attempts == PasswordResetOTP.MAX_ATTEMPTS
    # Even the right code is refused once locked.
    res = c.post("/api/v1/auth/password/verify-otp/", {"email": "s1@t.dev", "otp": "123456"}, format="json")
    assert res.status_code == 400


# ---------------------------------------------------------------- health

def test_health_probes_need_no_auth_and_leak_nothing(world):
    c = APIClient()
    assert c.get("/healthz").json() == {"status": "ok"}
    res = c.get("/readyz")
    assert res.status_code == 200
    assert set(res.json()["checks"]) == {"database", "vector_store", "language_model"}


def test_expired_access_token_is_rejected(world):
    from datetime import timedelta

    from rest_framework_simplejwt.tokens import AccessToken

    token = AccessToken.for_user(world["s1"])
    token.set_exp(lifetime=-timedelta(seconds=1))
    c = APIClient()
    c.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    assert c.get("/api/v1/documents/").status_code == 401


def test_logout_blacklists_the_refresh_token(world):
    refresh = RefreshToken.for_user(world["s1"])
    c = APIClient()
    c.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")
    assert c.post("/api/v1/auth/logout/", {"refresh": str(refresh)}, format="json").status_code in (200, 205)
    res = APIClient().post("/api/v1/auth/token/refresh/", {"refresh": str(refresh)}, format="json")
    assert res.status_code == 401
