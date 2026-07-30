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
    student_email = "quiz_student@test.com"
    student, created = User.objects.get_or_create(
        email=student_email,
        defaults={
            "first_name": "Quiz",
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
        title="Quiz Generation Testing Course",
        code=f"CS-QUIZ-{uuid.uuid4().hex[:6]}",
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
        title="Other Quiz Course",
        code=f"CS-QUIZ-OTHER-{uuid.uuid4().hex[:6]}",
        subject=subject,
        is_published=True,
        enrollment_open=True
    )
    print(f"Other Course: {other_course.code} (ID: {other_course.id})")

    # 5. Create Document and Chunks for enrolled course
    doc = Document.objects.create(
        title="Quiz Test Document",
        course=course,
        file_type="txt",
        processing_status="completed",
        chunk_count=2
    )
    DocumentChunk.objects.create(
        document=doc,
        chunk_index=0,
        content="Django is a high-level Python web framework that encourages rapid development and clean, pragmatic design.",
        page_number=1,
        chroma_id=f"chunk_{doc.id}_0"
    )
    DocumentChunk.objects.create(
        document=doc,
        chunk_index=1,
        content="Built by experienced developers, it takes care of much of the hassle of web development, so you can focus on writing your app without needing to reinvent the wheel.",
        page_number=1,
        chroma_id=f"chunk_{doc.id}_1"
    )
    print(f"Created Document in enrolled course: {doc.title} (ID: {doc.id})")

    return student, course, other_course, doc


def run_tests(student, course, other_course, doc):
    print("\n--- Running Quiz Generation API Tests ---")
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
                  "question": "What kind of web framework is Django?",
                  "options": ["High-level Python", "Low-level JavaScript", "C++ desktop framework", "Ruby library"],
                  "answer": "High-level Python",
                  "explanation": "As stated in the text, Django is a high-level Python web framework."
                },
                {
                  "question": "What does Django encourage?",
                  "options": ["Slow development", "Rapid development and clean design", "Complex code structure", "No database configuration"],
                  "answer": "Rapid development and clean design",
                  "explanation": "Django encourages rapid development and clean, pragmatic design."
                },
                {
                  "question": "Who built Django?",
                  "options": ["Beginners", "Experienced developers", "Designers", "Database admins"],
                  "answer": "Experienced developers",
                  "explanation": "The text states Django was built by experienced developers."
                },
                {
                  "question": "What is the primary benefit of Django according to the text?",
                  "options": ["Reinventing the wheel", "Taking care of much of the hassle of web development", "Having no templates", "Restricting database types"],
                  "answer": "Taking care of much of the hassle of web development",
                  "explanation": "It takes care of much of the hassle of web development so you can focus on writing your app."
                },
                {
                  "question": "What is Django's approach to reinventing the wheel?",
                  "options": ["Encourages it", "Does not require it", "Makes it mandatory", "Restricts developers from using packages"],
                  "answer": "Does not require it",
                  "explanation": "Django is designed so that you can focus on writing your app without needing to reinvent the wheel."
                }
              ]
            }
            """
        }
    }

    # Test 1: Successful MCQ Quiz Generation (5 Qs, easy difficulty)
    print("\nTest 1: Generate MCQs in enrolled course (5 Qs, easy)...")
    payload = {
        "course_id": str(course.id),
        "difficulty": "easy",
        "question_count": 5
    }
    with patch("ollama.Client.chat", return_value=mock_response) as mock_chat:
        response = client.post(
            "/api/assistant/quiz/generate/",
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
        assert len(data["questions"]) == 5
        assert data["difficulty"] == "easy"
        assert data["question_count"] == 5
        assert "response_time" in data
        
        # Verify JSON keys of each question
        q0 = data["questions"][0]
        assert "question" in q0
        assert "options" in q0
        assert len(q0["options"]) == 4
        assert "answer" in q0
        assert "explanation" in q0
        
        # Check database entry
        generated_count = GeneratedContent.objects.filter(
            course=course,
            created_by=student,
            content_type="quiz"
        ).count()
        assert generated_count == 1, "Generated content should be saved in DB"
        print("Test 1 PASSED!")

    # Test 2: Unauthorized Course Quiz Generation (should fail with 403)
    print("\nTest 2: Generate quiz in non-enrolled course...")
    payload_unauthorized = {
        "course_id": str(other_course.id),
        "difficulty": "medium",
        "question_count": 10
    }
    response = client.post(
        "/api/assistant/quiz/generate/",
        data=payload_unauthorized,
        content_type="application/json",
        **auth_headers
    )
    print(f"Status Code: {response.status_code}")
    print(response.json())
    assert response.status_code == 403
    print("Test 2 PASSED!")

    # Test 3: Invalid difficulty level (should fail with 400)
    print("\nTest 3: Generate quiz with invalid difficulty...")
    payload_invalid_difficulty = {
        "course_id": str(course.id),
        "difficulty": "extreme",
        "question_count": 5
    }
    response = client.post(
        "/api/assistant/quiz/generate/",
        data=payload_invalid_difficulty,
        content_type="application/json",
        **auth_headers
    )
    print(f"Status Code: {response.status_code}")
    print(response.json())
    assert response.status_code == 400
    print("Test 3 PASSED!")

    # Test 4: Invalid question count (should fail with 400)
    print("\nTest 4: Generate quiz with invalid question count...")
    payload_invalid_count = {
        "course_id": str(course.id),
        "difficulty": "medium",
        "question_count": 7
    }
    response = client.post(
        "/api/assistant/quiz/generate/",
        data=payload_invalid_count,
        content_type="application/json",
        **auth_headers
    )
    print(f"Status Code: {response.status_code}")
    print(response.json())
    assert response.status_code == 400
    print("Test 4 PASSED!")


if __name__ == "__main__":
    student, course, other_course, doc = setup_test_data()
    run_tests(student, course, other_course, doc)
    print("\nAll quiz generation tests completed successfully!")
