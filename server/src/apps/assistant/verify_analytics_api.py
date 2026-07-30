import os
import sys
import uuid
import django

# Set up django
sys.path.append(r"c:\Users\Anand Jyothis G\StudentAssist\server\src")
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.development")
django.setup()

from django.conf import settings
settings.ALLOWED_HOSTS = ["*"]

from django.test import Client
from apps.accounts.models import User
from apps.academic.models import Course, Enrollment
from apps.documents.models import Document
from apps.chat.models import ChatSession, ChatMessage
from apps.assistant.models import GeneratedContent
from rest_framework_simplejwt.tokens import AccessToken


def setup_test_data():
    print("--- Setting up test data ---")
    
    # 1. Student User
    student_email = "analytics_student@test.com"
    student, created = User.objects.get_or_create(
        email=student_email,
        defaults={
            "first_name": "Analytics",
            "last_name": "Student",
            "role": "student",
            "is_active": True
        }
    )
    if created:
        student.set_password("password123")
        student.save()
    else:
        student.set_password("password123")
        student.save()

    # 2. Teacher User
    teacher_email = "analytics_teacher@test.com"
    teacher, created = User.objects.get_or_create(
        email=teacher_email,
        defaults={
            "first_name": "Analytics",
            "last_name": "Teacher",
            "role": "teacher",
            "is_active": True
        }
    )
    if created:
        teacher.set_password("password123")
        teacher.save()
    else:
        teacher.set_password("password123")
        teacher.save()

    # 3. Course
    from apps.academic.models import Subject
    subject = Subject.objects.first()
    if not subject:
        subject = Subject.objects.create(name="Computer Science", code="CS")
        
    course = Course.objects.create(
        title="Analytics Course",
        code=f"CS-AN-{uuid.uuid4().hex[:6]}",
        subject=subject,
        teacher=teacher,
        is_published=True,
        enrollment_open=True
    )
    print(f"Course: {course.code} (ID: {course.id})")

    # 4. Enroll Student
    Enrollment.objects.create(
        student=student,
        course=course,
        is_active=True
    )

    # 5. Create Document
    doc = Document.objects.create(
        title="Analytics Test Document",
        course=course,
        file_type="txt",
        processing_status="completed",
        chunk_count=1
    )

    # 6. Populate Chat messages
    session = ChatSession.objects.create(
        student=student,
        course=course,
        title="Analytics Session"
    )
    
    # Message turn 1: Easy concept (high confidence)
    ChatMessage.objects.create(
        session=session,
        role="user",
        content="What is Django ORM?"
    )
    ChatMessage.objects.create(
        session=session,
        role="assistant",
        content="Django ORM is a powerful Object-Relational Mapper.",
        confidence_score=0.95,
        response_time=0.85,
        citations=[{"document_id": str(doc.id), "document_title": doc.title}]
    )

    # Message turn 2: Hard/low confidence concept
    ChatMessage.objects.create(
        session=session,
        role="user",
        content="How do database transactions operate in Django?"
    )
    ChatMessage.objects.create(
        session=session,
        role="assistant",
        content="Database transactions ensure ACID compliance.",
        confidence_score=0.45,  # Low confidence
        response_time=1.20,
        citations=[{"document_id": str(doc.id), "document_title": doc.title}]
    )

    # Message turn 3: Extra user query
    ChatMessage.objects.create(
        session=session,
        role="user",
        content="Explain Django middleware mechanisms."
    )
    ChatMessage.objects.create(
        session=session,
        role="assistant",
        content="Middleware is a framework of hooks into Django's request/response processing.",
        confidence_score=0.80,
        response_time=0.90,
        citations=[]
    )

    # 7. Generated content response timing
    GeneratedContent.objects.create(
        course=course,
        created_by=student,
        content_type="quiz",
        title="Mock Quiz",
        content={"questions": [], "response_time": 0.55}
    )

    return student, teacher, course, doc


def run_tests(student, teacher, course, doc):
    print("\n--- Running Learning Analytics API Tests ---")
    client = Client()
    
    # Tokens
    student_token = str(AccessToken.for_user(student))
    teacher_token = str(AccessToken.for_user(teacher))
    
    student_headers = {"HTTP_AUTHORIZATION": f"Bearer {student_token}"}
    teacher_headers = {"HTTP_AUTHORIZATION": f"Bearer {teacher_token}"}

    # Test 1: Fetch own student analytics
    print("\nTest 1: Student fetching own analytics...")
    response = client.get("/api/assistant/analytics/", **student_headers)
    print(f"Status Code: {response.status_code}")
    print("Response JSON:")
    import json
    data = response.json()
    print(json.dumps(data, indent=2))
    
    assert response.status_code == 200
    assert data["questions_asked"] == 3
    # time_spent = (0.85 + 1.20 + 0.90) from chat messages + 0.55 from generated content = 3.5
    assert data["time_spent"] == 3.5
    
    # Frequently asked topics words of len > 3: "django" occurs in query 1, 2, 3 -> count 3. "database", "transactions" count 1.
    topics = [t["topic"] for t in data["frequently_asked_topics"]]
    assert "django" in topics
    
    # Most viewed docs: "Analytics Test Document" cited in chat twice
    assert len(data["most_viewed_documents"]) == 1
    assert data["most_viewed_documents"][0]["title"] == "Analytics Test Document"
    assert data["most_viewed_documents"][0]["views_count"] == 2
    
    # Difficult concepts: low confidence query preceding user question was: "How do database transactions operate in Django?"
    # Keywords extracted should include "database", "transactions", "operate", "django"
    diff_concepts = [c["concept"] for c in data["most_difficult_concepts"]]
    assert "transactions" in diff_concepts
    print("Test 1 PASSED!")

    # Test 2: Filter by course ID
    print("\nTest 2: Student filtering by course_id...")
    response = client.get(f"/api/assistant/analytics/?course_id={course.id}", **student_headers)
    print(f"Status Code: {response.status_code}")
    assert response.status_code == 200
    assert response.json()["questions_asked"] == 3
    print("Test 2 PASSED!")

    # Test 3: Teacher fetching student analytics
    print("\nTest 3: Teacher fetching student analytics...")
    response = client.get(f"/api/assistant/analytics/?student_id={student.id}", **teacher_headers)
    print(f"Status Code: {response.status_code}")
    assert response.status_code == 200
    assert response.json()["questions_asked"] == 3
    print("Test 3 PASSED!")

    # Test 4: Student fetching another user's analytics (should fail with 403)
    print("\nTest 4: Student trying to fetch teacher's analytics...")
    response = client.get(f"/api/assistant/analytics/?student_id={teacher.id}", **student_headers)
    print(f"Status Code: {response.status_code}")
    print(response.json())
    assert response.status_code == 403
    print("Test 4 PASSED!")


if __name__ == "__main__":
    student, teacher, course, doc = setup_test_data()
    run_tests(student, teacher, course, doc)
    print("\nAll learning analytics tests completed successfully!")
