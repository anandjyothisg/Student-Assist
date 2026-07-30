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
    student_email = "concept_student@test.com"
    student, created = User.objects.get_or_create(
        email=student_email,
        defaults={
            "first_name": "Concept",
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
        title="Concept Extraction Testing Course",
        code=f"CS-CON-{uuid.uuid4().hex[:6]}",
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
        title="Other Concept Course",
        code=f"CS-CON-OTHER-{uuid.uuid4().hex[:6]}",
        subject=subject,
        is_published=True,
        enrollment_open=True
    )
    print(f"Other Course: {other_course.code} (ID: {other_course.id})")

    # 5. Create Document and Chunks for enrolled course
    doc = Document.objects.create(
        title="Concept Test Document",
        course=course,
        file_type="txt",
        processing_status="completed",
        chunk_count=1
    )
    DocumentChunk.objects.create(
        document=doc,
        chunk_index=0,
        content="Newton's second law states that F = ma, where force equals mass times acceleration.",
        page_number=2,
        chroma_id=f"chunk_{doc.id}_0"
    )
    print(f"Created Document in enrolled course: {doc.title} (ID: {doc.id})")

    # 6. Create Document in non-enrolled course
    other_doc = Document.objects.create(
        title="Other Concept Document",
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
    print("\n--- Running Concept Extraction API Tests ---")
    client = Client()
    
    access_token = str(AccessToken.for_user(student))
    auth_headers = {"HTTP_AUTHORIZATION": f"Bearer {access_token}"}
    
    # Mock Ollama response
    mock_response = {
        "message": {
            "content": """
            {
              "important_topics": [
                "Newtonian Mechanics",
                "Force and Acceleration"
              ],
              "definitions": [
                {
                  "term": "Force",
                  "definition": "The product of mass and acceleration."
                }
              ],
              "formula_references": [
                {
                  "formula": "F = ma",
                  "description": "Force equals mass times acceleration"
                }
              ],
              "keywords": [
                "Newton",
                "Force",
                "Acceleration",
                "Mass"
              ],
              "page_references": [
                {
                  "topic_or_term": "F = ma",
                  "page_numbers": [2]
                }
              ]
            }
            """
        }
    }

    # Test 1: Successful Concept Extraction
    print("\nTest 1: Extract concepts from enrolled document...")
    payload = {
        "document_id": str(doc.id)
    }
    with patch("ollama.Client.chat", return_value=mock_response) as mock_chat:
        response = client.post(
            "/api/assistant/concept/extract/",
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
        assert "important_topics" in data
        assert "definitions" in data
        assert "formula_references" in data
        assert "keywords" in data
        assert "page_references" in data
        assert "response_time" in data
        
        # Check database entry
        generated_count = GeneratedContent.objects.filter(
            course=doc.course,
            created_by=student,
            content_type="summary"
        ).count()
        assert generated_count == 1, "Generated content should be saved in DB"
        print("Test 1 PASSED!")

    # Test 2: Unauthorized Document Concept Extraction (should fail with 403)
    print("\nTest 2: Extract concepts from non-enrolled document...")
    payload_unauthorized = {
        "document_id": str(other_doc.id)
    }
    response = client.post(
        "/api/assistant/concept/extract/",
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
    print("\nAll concept extraction tests completed successfully!")
