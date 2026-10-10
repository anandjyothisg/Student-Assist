"""
Guard against N+1 queries on the busiest list endpoints: the query count must
not grow with the number of rows.
"""

import pytest
from django.db import connection
from django.test.utils import CaptureQueriesContext
from rest_framework.test import APIClient

from apps.academic.models import Course, Enrollment, Subject
from apps.accounts.models import User
from apps.chat.models import ChatMessage, ChatSession

pytestmark = pytest.mark.django_db
PW = "Correct-Horse-42"


def _count(user, url):
    c = APIClient()
    c.force_authenticate(user)
    with CaptureQueriesContext(connection) as ctx:
        assert c.get(url).status_code == 200
    return len(ctx.captured_queries)


def _world(n):
    t = User.objects.create_user(email=f"t{n}@t.dev", password=PW, first_name="T", last_name="T", role="teacher")
    s = User.objects.create_user(email=f"s{n}@t.dev", password=PW, first_name="S", last_name="S", role="student")
    subj = Subject.objects.create(name=f"S{n}", code=f"S{n}")
    for i in range(n):
        c = Course.objects.create(code=f"C{n}-{i}", title="C", subject=subj, teacher=t, is_published=True)
        Enrollment.objects.create(student=s, course=c)
        sess = ChatSession.objects.create(student=s, course=c, title=f"q{i}")
        ChatMessage.objects.create(session=sess, role="user", content="question")
    return s


@pytest.mark.parametrize("url", ["/api/v1/academic/courses/?page_size=100", "/api/chat/", "/api/v1/documents/?page_size=100"])
def test_list_queries_do_not_grow_with_rows(url):
    small = _count(_world(2), url)
    large = _count(_world(12), url)
    assert large == small, f"{url}: {small} queries for 2 rows, {large} for 12"
