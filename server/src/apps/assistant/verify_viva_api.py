import os
import sys
import uuid
import django
from unittest.mock import patch

# Set up django
sys.path.append(r"c:\Users\Anand Jyothis G\StudentAssist\server\src")
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.development")
django.setup()

from django.conf import settings
settings.ALLOWED_HOSTS = ["*"]

from django.test import Client
from apps.accounts.models import User
from apps.academic.models import Course, Enrollment
from apps.documents.models import Document, DocumentChunk
from apps.assistant.models import GeneratedContent
from rest_framework_simplejwt.tokens import AccessToken


def setup_test_data():
    print("--- Setting up test data ---")
    
    # 1. Student User
    student_email = "viva_student@test.com"
    student, created = User.objects.get_or_create(
        email=student_email,
        defaults={
            "first_name": "Viva",
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

    # 2. Course
    from apps.academic.models import Subject
    subject = Subject.objects.first()
    if not subject:
        subject = Subject.objects.create(name="Computer Science", code="CS")
        
    course = Course.objects.create(
        title="Viva Prep Testing Course",
        code=f"CS-VIVA-{uuid.uuid4().hex[:6]}",
        subject=subject,
        is_published=True,
        enrollment_open=True
    )
    print(f"Course: {course.code} (ID: {course.id})")

    # 3. Enroll Student
    Enrollment.objects.create(
        student=student,
        course=course,
        is_active=True
    )
    print(f"Enrolled student {student.email} in {course.code}")

    # 4. Another Course (not enrolled)
    other_course = Course.objects.create(
        title="Other Viva Course",
        code=f"CS-VIVA-OTHER-{uuid.uuid4().hex[:6]}",
        subject=subject,
        is_published=True,
        enrollment_open=True
    )
    print(f"Other Course: {other_course.code} (ID: {other_course.id})")

    # 5. Create Document and Chunks for enrolled course
    doc = Document.objects.create(
        title="Viva Test Document",
        course=course,
        file_type="txt",
        processing_status="completed",
        chunk_count=1
    )
    DocumentChunk.objects.create(
        document=doc,
        chunk_index=0,
        content="Python is an interpreted, high-level, general-purpose programming language. Created by Guido van Rossum and first released in 1991.",
        page_number=1,
        chroma_id=f"chunk_{doc.id}_0"
    )
    print(f"Created Document in enrolled course: {doc.title} (ID: {doc.id})")

    return student, course, other_course


def run_tests(student, course, other_course):
    print("\n--- Running Viva Preparation API Tests ---")
    client = Client()
    
    access_token = str(AccessToken.for_user(student))
    auth_headers = {"HTTP_AUTHORIZATION": f"Bearer {access_token}"}
    
    # Mock Ollama response
    mock_response = {
        "message": {
            "content": """
            {
              "questions": [
                {
                  "question": "What is Python?",
                  "ideal_answer": "Python is an interpreted, high-level, general-purpose programming language.",
                  "follow_up_questions": [
                    "What does interpreted mean?",
                    "What is a general-purpose programming language?"
                  ]
                },
                {
                  "question": "Who created Python and when?",
                  "ideal_answer": "Python was created by Guido van Rossum and first released in 1991.",
                  "follow_up_questions": [
                    "What was the release year?",
                    "Which version was released in 1991?"
                  ]
                }
              ]
            }
            """
        }
    }

    # Test 1: Successful Viva Generation (2 questions, basic)
    print("\nTest 1: Generate viva questions from enrolled course...")
    payload = {
        "course_id": str(course.id),
        "level": "basic",
        "count": 2
    }
    with patch("ollama.Client.chat", return_value=mock_response) as mock_chat:
        response = client.post(
            "/api/assistant/viva/generate/",
            data=payload,
            content_type="application/json",
            **auth_headers
        )
        print(f"Status Code: {response.status_code}")
        print("Response JSON:")
        import json
        print(json.dumps(response.json(), indent=2))
        
        assert response.status_code == 200
        data = response.json()
        assert "questions" in data
        assert len(data["questions"]) == 2
        assert data["level"] == "basic"
        assert "response_time" in data
        
        # Verify JSON keys of each question
        q0 = data["questions"][0]
        assert "question" in q0
        assert "ideal_answer" in q0
        assert "follow_up_questions" in q0
        assert len(q0["follow_up_questions"]) == 2
        
        # Check database entry
        generated_count = GeneratedContent.objects.filter(
            course=course,
            created_by=student,
            content_type="viva"
        ).count()
        assert generated_count == 1, "Generated content should be saved in DB"
        print("Test 1 PASSED!")

    # Test 2: Unauthorized Course Viva Generation (should fail with 403)
    print("\nTest 2: Generate viva questions from non-enrolled course...")
    payload_unauthorized = {
        "course_id": str(other_course.id),
        "level": "intermediate",
        "count": 2
    }
    response = client.post(
        "/api/assistant/viva/generate/",
        data=payload_unauthorized,
        content_type="application/json",
        **auth_headers
    )
    print(f"Status Code: {response.status_code}")
    print(response.json())
    assert response.status_code == 403
    print("Test 2 PASSED!")


if __name__ == "__main__":
    student, course, other_course = setup_test_data()
    run_tests(student, course, other_course)
    print("\nAll viva generation tests completed successfully!")
