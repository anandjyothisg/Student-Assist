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
from rest_framework_simplejwt.tokens import AccessToken


def setup_test_data():
    print("--- Setting up test data ---")
    
    # 1. Student User
    student_email = "summarize_student@test.com"
    student, created = User.objects.get_or_create(
        email=student_email,
        defaults={
            "first_name": "Summarize",
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

    # 2. Get a Course
    from apps.academic.models import Subject
    subject = Subject.objects.first()
    if not subject:
        subject = Subject.objects.create(name="Computer Science", code="CS")
        
    course = Course.objects.create(
        title="Summarization Testing Course",
        code=f"CS-SUM-{uuid.uuid4().hex[:6]}",
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
        title="Other Course Not Enrolled",
        code=f"CS-SUM-OTHER-{uuid.uuid4().hex[:6]}",
        subject=subject,
        is_published=True,
        enrollment_open=True
    )
    print(f"Other Course: {other_course.code} (ID: {other_course.id})")

    # 5. Create Document and Chunks for enrolled course
    doc = Document.objects.create(
        title="Summarization Test Document",
        course=course,
        file_type="txt",
        processing_status="completed",
        chunk_count=2
    )
    DocumentChunk.objects.create(
        document=doc,
        chunk_index=0,
        content="Artificial Intelligence (AI) refers to the simulation of human intelligence in machines that are programmed to think like humans and mimic their actions.",
        page_number=1,
        chroma_id=f"chunk_{doc.id}_0"
    )
    DocumentChunk.objects.create(
        document=doc,
        chunk_index=1,
        content="The term may also be applied to any machine that exhibits traits associated with a human mind such as learning and problem-solving.",
        page_number=1,
        chroma_id=f"chunk_{doc.id}_1"
    )
    print(f"Created Document in enrolled course: {doc.title} (ID: {doc.id})")

    # 6. Create Document in non-enrolled course
    other_doc = Document.objects.create(
        title="Other Test Document",
        course=other_course,
        file_type="txt",
        processing_status="completed",
        chunk_count=1
    )
    DocumentChunk.objects.create(
        document=other_doc,
        chunk_index=0,
        content="This is restricted content.",
        page_number=1,
        chroma_id=f"chunk_{other_doc.id}_0"
    )
    print(f"Created Document in other course: {other_doc.title} (ID: {other_doc.id})")

    return student, doc, other_doc


def run_tests(student, doc, other_doc):
    print("\n--- Running Summarization API Tests ---")
    client = Client()
    
    access_token = str(AccessToken.for_user(student))
    auth_headers = {"HTTP_AUTHORIZATION": f"Bearer {access_token}"}
    
    # Mock Ollama chat response
    mock_response = {
        "message": {
            "content": "This is a mock summary of artificial intelligence, describing its definition and key cognitive traits."
        }
    }

    # Test 1: Successful Summarization (mode: short)
    print("\nTest 1: Summarize enrolled document (mode: short)...")
    payload = {
        "document_id": str(doc.id),
        "mode": "short"
    }
    with patch("ollama.Client.chat", return_value=mock_response) as mock_chat:
        response = client.post(
            "/api/assistant/summarize/",
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
        assert "summary" in data
        assert "word_count" in data
        assert "response_time" in data
        assert data["word_count"] > 0
        print("Test 1 PASSED!")

    # Test 2: Summarize non-enrolled document (should fail with 403)
    print("\nTest 2: Summarize non-enrolled document...")
    payload_unauthorized = {
        "document_id": str(other_doc.id),
        "mode": "medium"
    }
    response = client.post(
        "/api/assistant/summarize/",
        data=payload_unauthorized,
        content_type="application/json",
        **auth_headers
    )
    print(f"Status Code: {response.status_code}")
    print(response.json())
    assert response.status_code == 403
    print("Test 2 PASSED!")

    # Test 3: Summarize non-existent document (should fail with 404)
    print("\nTest 3: Summarize non-existent document...")
    payload_not_found = {
        "document_id": str(uuid.uuid4()),
        "mode": "detailed"
    }
    response = client.post(
        "/api/assistant/summarize/",
        data=payload_not_found,
        content_type="application/json",
        **auth_headers
    )
    print(f"Status Code: {response.status_code}")
    print(response.json())
    assert response.status_code == 404
    print("Test 3 PASSED!")

    # Test 4: Invalid mode validation (should fail with 400)
    print("\nTest 4: Summarize with invalid mode...")
    payload_invalid_mode = {
        "document_id": str(doc.id),
        "mode": "super-long"
    }
    response = client.post(
        "/api/assistant/summarize/",
        data=payload_invalid_mode,
        content_type="application/json",
        **auth_headers
    )
    print(f"Status Code: {response.status_code}")
    print(response.json())
    assert response.status_code == 400
    print("Test 4 PASSED!")


if __name__ == "__main__":
    student, doc, other_doc = setup_test_data()
    run_tests(student, doc, other_doc)
    print("\nAll summarization tests completed successfully!")
