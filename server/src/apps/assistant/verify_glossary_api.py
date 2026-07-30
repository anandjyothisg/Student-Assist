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
    student_email = "glossary_student@test.com"
    student, created = User.objects.get_or_create(
        email=student_email,
        defaults={
            "first_name": "Glossary",
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
        title="Glossary Generation Testing Course",
        code=f"CS-GLOS-{uuid.uuid4().hex[:6]}",
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
        title="Other Glossary Course",
        code=f"CS-GLOS-OTHER-{uuid.uuid4().hex[:6]}",
        subject=subject,
        is_published=True,
        enrollment_open=True
    )
    print(f"Other Course: {other_course.code} (ID: {other_course.id})")

    # 5. Create Document and Chunks for enrolled course
    doc = Document.objects.create(
        title="Glossary Test Document",
        course=course,
        file_type="txt",
        processing_status="completed",
        chunk_count=1
    )
    DocumentChunk.objects.create(
        document=doc,
        chunk_index=0,
        content="Polymorphism in object-oriented programming is the ability of different classes to respond to the same message.",
        page_number=3,
        chroma_id=f"chunk_{doc.id}_0"
    )
    print(f"Created Document in enrolled course: {doc.title} (ID: {doc.id})")

    # 6. Create Document in non-enrolled course
    other_doc = Document.objects.create(
        title="Other Glossary Document",
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
    print("\n--- Running Glossary Generation API Tests ---")
    client = Client()
    
    access_token = str(AccessToken.for_user(student))
    auth_headers = {"HTTP_AUTHORIZATION": f"Bearer {access_token}"}
    
    # Mock Ollama response
    mock_response = {
        "message": {
            "content": """
            {
              "glossary": [
                {
                  "term": "Polymorphism",
                  "definition": "The ability of different classes to respond to the same message or method call in their own specific way.",
                  "example": "A shape class having a draw() method, which is implemented differently by circle and square classes.",
                  "page": 3
                }
              ]
            }
            """
        }
    }

    # Test 1: Successful Glossary Generation
    print("\nTest 1: Generate glossary from enrolled document...")
    payload = {
        "document_id": str(doc.id)
    }
    with patch("ollama.Client.chat", return_value=mock_response) as mock_chat:
        response = client.post(
            "/api/assistant/glossary/generate/",
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
        assert "glossary" in data
        assert len(data["glossary"]) == 1
        assert "response_time" in data
        
        # Verify JSON keys of each glossary term
        g0 = data["glossary"][0]
        assert "term" in g0
        assert "definition" in g0
        assert "example" in g0
        assert "page" in g0
        
        # Check database entry
        generated_count = GeneratedContent.objects.filter(
            course=doc.course,
            created_by=student,
            content_type="summary"
        ).count()
        assert generated_count == 1, "Generated content should be saved in DB"
        print("Test 1 PASSED!")

    # Test 2: Unauthorized Document Glossary Generation (should fail with 403)
    print("\nTest 2: Generate glossary from non-enrolled document...")
    payload_unauthorized = {
        "document_id": str(other_doc.id)
    }
    response = client.post(
        "/api/assistant/glossary/generate/",
        data=payload_unauthorized,
        content_type="application/json",
        **auth_headers
    )
    print(f"Status Code: {response.status_code}")
    print(response.json())
    assert response.status_code == 403
    print("Test 2 PASSED!")


if __name__ == "__main__":
    student, doc, other_doc = setup_test_data()
    run_tests(student, doc, other_doc)
    print("\nAll glossary generation tests completed successfully!")
