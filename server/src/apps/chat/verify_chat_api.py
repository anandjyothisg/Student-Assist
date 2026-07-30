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
from apps.documents.services.vector_store import upsert_document_chunks
from apps.documents.services.embedder import generate_embeddings
from apps.chat.models import ChatSession, ChatMessage


def setup_test_data():
    print("--- Setting up test data ---")
    
    # 1. Create student user
    student_email = "chat_student_verify@test.com"
    student, created = User.objects.get_or_create(
        email=student_email,
        defaults={
            "first_name": "Chat",
            "last_name": "Student",
            "role": "student",
            "is_active": True
        }
    )
    if created:
        student.set_password("password123")
        student.save()
    else:
        # Reset password to ensure login works
        student.set_password("password123")
        student.save()
        
    print(f"Student: {student.email} (ID: {student.id})")

    # 2. Get or create Course
    course_code = "CS-201-CHAT-TEST"
    course = Course.objects.filter(code=course_code).first()
    if not course:
        # Get a subject first
        from apps.academic.models import Subject
        subject = Subject.objects.first()
        if not subject:
            subject = Subject.objects.create(name="Computer Science", code="CS")
        course = Course.objects.create(
            title="Chat API Testing Course",
            code=course_code,
            subject=subject,
            is_published=True,
            enrollment_open=True
        )
    print(f"Course: {course.code} (ID: {course.id})")

    # 3. Create active enrollment
    Enrollment.objects.filter(student=student, course=course).delete()
    enrollment = Enrollment.objects.create(
        student=student,
        course=course,
        is_active=True
    )
    print(f"Enrolled {student.email} in {course.code}")

    # 4. Create another course NOT enrolled
    other_course = Course.objects.filter(code="CS-999-NOT-ENROLLED").first()
    if not other_course:
        from apps.academic.models import Subject
        subject = Subject.objects.first()
        other_course = Course.objects.create(
            title="Not Enrolled Course",
            code="CS-999-NOT-ENROLLED",
            subject=subject,
            is_published=True,
            enrollment_open=True
        )
    print(f"Other Course: {other_course.code} (ID: {other_course.id})")

    # 5. Create document and document chunk
    doc = Document.objects.filter(course=course, title="Chat Guide").first()
    if not doc:
        doc = Document.objects.create(
            title="Chat Guide",
            course=course,
            file_type="txt",
            processing_status="completed",
            chunk_count=1
        )
    
    chunk = DocumentChunk.objects.filter(document=doc, chunk_index=0).first()
    if not chunk:
        chunk = DocumentChunk.objects.create(
            document=doc,
            chunk_index=0,
            content="RAG is Retrieval Augmented Generation. It fetches context from documents to answer questions.",
            page_number=1,
            chroma_id=f"chunk_{doc.id}_0"
        )
    
    # 6. Seed ChromaDB for this document chunk
    try:
        embeddings = generate_embeddings([chunk.content])
        upsert_document_chunks(
            course_id=str(course.id),
            document_id=str(doc.id),
            chunks=[{"chunk_index": 0, "content": chunk.content, "page_number": 1}],
            embeddings=embeddings
        )
        print("Upserted context chunk to ChromaDB successfully.")
    except Exception as e:
        print(f"Warning: Failed to index chunk in ChromaDB (is Chroma running?): {e}")

    return student, course, other_course


def run_tests(student, course, other_course):
    from rest_framework_simplejwt.tokens import AccessToken
    print("\n--- Running API Tests ---")
    client = Client()
    
    access_token = str(AccessToken.for_user(student))
    auth_headers = {"HTTP_AUTHORIZATION": f"Bearer {access_token}"}
    print(f"JWT Access Token generated for {student.email}")

    # Mock Ollama chat response
    mock_response = {
        "message": {
            "content": "Retrieval Augmented Generation (RAG) is a technique that uses context files to answer user questions."
        }
    }
    
    # Test 1: Ask question in enrolled course (new session)
    print("\nTest 1: Ask question in enrolled course (new session)...")
    payload = {
        "course_id": str(course.id),
        "question": "What is RAG?"
    }
    
    with patch("ollama.Client.chat", return_value=mock_response) as mock_chat:
        response = client.post(
            "/api/chat/ask/",
            data=payload,
            content_type="application/json",
            **auth_headers
        )
        print(f"Status Code: {response.status_code}")
        print("Response JSON:")
        import json
        print(json.dumps(response.json(), indent=2))
        
        # Verify response keys
        data = response.json()
        assert response.status_code == 200, "Should succeed"
        assert "session_id" in data
        assert "answer" in data
        assert "citations" in data
        assert "confidence_score" in data
        assert "response_time" in data
        
        session_id = data["session_id"]
        
        # Verify DB entries
        session = ChatSession.objects.get(id=session_id)
        assert session.student == student
        assert session.course == course
        
        messages = session.messages.order_by("created_at")
        assert messages.count() == 2
        assert messages[0].role == "user"
        assert messages[0].content == "What is RAG?"
        assert messages[1].role == "assistant"
        assert messages[1].content == mock_response["message"]["content"]
        assert len(messages[1].citations) > 0
        print("Test 1 PASSED!")

    # Test 2: Resume existing session
    print("\nTest 2: Ask follow-up question (resume session)...")
    payload_resume = {
        "course_id": str(course.id),
        "question": "Why is it useful?",
        "session_id": session_id
    }
    
    with patch("ollama.Client.chat", return_value={"message": {"content": "It is useful to prevent hallucination."}}) as mock_chat:
        response = client.post(
            "/api/chat/ask/",
            data=payload_resume,
            content_type="application/json",
            **auth_headers
        )
        print(f"Status Code: {response.status_code}")
        
        data = response.json()
        assert response.status_code == 200
        assert data["session_id"] == session_id
        
        # Verify messages list grows
        messages = ChatSession.objects.get(id=session_id).messages.order_by("created_at")
        assert messages.count() == 4
        print("Test 2 PASSED!")

    # Test 3: Unauthorized Course Enrollment
    print("\nTest 3: Query course without active enrollment...")
    payload_unauthorized = {
        "course_id": str(other_course.id),
        "question": "Is anybody there?"
    }
    response = client.post(
        "/api/chat/ask/",
        data=payload_unauthorized,
        content_type="application/json",
        **auth_headers
    )
    print(f"Status Code: {response.status_code}")
    print(response.json())
    assert response.status_code == 403
    print("Test 3 PASSED!")

    # Test 4: Invalid Session ID
    print("\nTest 4: Resume with invalid session ID...")
    payload_invalid_session = {
        "course_id": str(course.id),
        "question": "Can I query?",
        "session_id": str(uuid.uuid4())
    }
    response = client.post(
        "/api/chat/ask/",
        data=payload_invalid_session,
        content_type="application/json",
        **auth_headers
    )
    print(f"Status Code: {response.status_code}")
    print(response.json())
    assert response.status_code == 404
    print("Test 4 PASSED!")

    # Test 5: List sessions
    print("\nTest 5: List previous conversations...")
    response = client.get(
        "/api/chat/",
        **auth_headers
    )
    print(f"Status Code: {response.status_code}")
    data_json = response.json()
    assert response.status_code == 200
    results = data_json["results"]
    assert len(results) >= 1
    # Check session structure in list (no messages list)
    assert "messages" not in results[0]
    assert "title" in results[0]
    assert results[0]["title"] == "What is RAG?"[:60]
    print("Test 5 PASSED!")

    # Test 6: Retrieve single session with messages
    print("\nTest 6: Retrieve single session with message history...")
    response = client.get(
        f"/api/chat/{session_id}/",
        **auth_headers
    )
    print(f"Status Code: {response.status_code}")
    data = response.json()
    assert response.status_code == 200
    assert data["id"] == session_id
    assert "messages" in data
    assert len(data["messages"]) == 4
    print("Test 6 PASSED!")

    # Test 7: Rename session via PATCH
    print("\nTest 7: Rename session...")
    rename_payload = {"title": "Updated RAG Discussion Session"}
    response = client.patch(
        f"/api/chat/{session_id}/",
        data=rename_payload,
        content_type="application/json",
        **auth_headers
    )
    print(f"Status Code: {response.status_code}")
    data = response.json()
    assert response.status_code == 200
    assert data["title"] == rename_payload["title"]
    # Check database
    assert ChatSession.objects.get(id=session_id).title == rename_payload["title"]
    print("Test 7 PASSED!")

    # Test 8: Soft-delete session via DELETE
    print("\nTest 8: Soft-delete session...")
    response = client.delete(
        f"/api/chat/{session_id}/",
        **auth_headers
    )
    print(f"Status Code: {response.status_code}")
    assert response.status_code == 204

    # Verify that it is no longer returned in list
    response = client.get(
        "/api/chat/",
        **auth_headers
    )
    data_json = response.json()
    results = data_json["results"]
    # Our session should not be in the active list
    session_ids = [s["id"] for s in results]
    assert session_id not in session_ids
    
    # Verify database model still has the record but is_active=False
    db_session = ChatSession.objects.get(id=session_id)
    assert db_session.is_active is False
    print("Test 8 PASSED!")


if __name__ == "__main__":
    student, course, other_course = setup_test_data()
    run_tests(student, course, other_course)
    print("\nAll verification tests completed successfully!")
