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

from apps.accounts.models import User
from apps.academic.models import Course, Enrollment
from apps.documents.models import Document, DocumentChunk
from apps.assistant.services.orchestrator import AssistantOrchestrator


def setup_test_data():
    print("--- Setting up test data ---")
    student_email = "orch_student@test.com"
    student, created = User.objects.get_or_create(
        email=student_email,
        defaults={
            "first_name": "Orchestrator",
            "last_name": "Student",
            "role": "student",
            "is_active": True
        }
    )
    if created:
        student.set_password("password123")
        student.save()

    from apps.academic.models import Subject
    subject = Subject.objects.first()
    if not subject:
        subject = Subject.objects.create(name="Computer Science", code="CS")
        
    course = Course.objects.create(
        title="Orchestration Testing Course",
        code=f"CS-ORCH-{uuid.uuid4().hex[:6]}",
        subject=subject,
        is_published=True,
        enrollment_open=True
    )
    print(f"Course: {course.code} (ID: {course.id})")

    Enrollment.objects.create(
        student=student,
        course=course,
        is_active=True
    )

    doc = Document.objects.create(
        title="Orchestrator Test Document",
        course=course,
        file_type="txt",
        processing_status="completed",
        chunk_count=1
    )
    DocumentChunk.objects.create(
        document=doc,
        chunk_index=0,
        content="Service orchestration simplifies complex interactions between different APIs.",
        page_number=1,
        chroma_id=f"chunk_{doc.id}_0"
    )
    print(f"Created Document: {doc.title} (ID: {doc.id})")

    return student, course, doc


def run_orchestrator_tests(student, course, doc):
    print("\n--- Running Assistant Orchestrator Tests ---")

    # 1. Test generate_summary
    print("\nTesting summary orchestration...")
    mock_summary_response = {
        "message": {"content": "This is a summary of service orchestration."}
    }
    with patch("ollama.Client.chat", return_value=mock_summary_response):
        res = AssistantOrchestrator.generate_summary(student, doc.id, "short")
        print("Summary result:", res)
        assert "summary" in res
        assert "word_count" in res
        assert "response_time" in res

    # 2. Test generate_quiz
    print("\nTesting quiz orchestration...")
    mock_quiz_response = {
        "message": {
            "content": """
            {
              "questions": [
                {
                  "question": "What is simplified by orchestration?",
                  "options": ["Complex interactions", "Hardware wiring", "Manual grading", "Server cooling"],
                  "answer": "Complex interactions",
                  "explanation": "Orchestration simplifies complex interactions between APIs."
                }
              ]
            }
            """
        }
    }
    with patch("ollama.Client.chat", return_value=mock_quiz_response):
        res = AssistantOrchestrator.generate_quiz(student, course.id, [doc.id], "easy", 1)
        print("Quiz result:", res)
        assert "questions" in res
        assert res["difficulty"] == "easy"
        assert res["question_count"] == 1

    # 3. Test generate_flashcards
    print("\nTesting flashcard orchestration...")
    mock_fc_response = {
        "message": {
            "content": """
            {
              "cards": [
                {
                  "question": "What does orchestration simplify?",
                  "answer": "Complex interactions between APIs",
                  "difficulty": "Easy",
                  "category": "Orchestration"
                }
              ]
            }
            """
        }
    }
    with patch("ollama.Client.chat", return_value=mock_fc_response):
        res = AssistantOrchestrator.generate_flashcards(student, doc.id, 1)
        print("Flashcard result:", res)
        assert "cards" in res
        assert len(res["cards"]) == 1

    # 4. Test generate_viva
    print("\nTesting viva prep orchestration...")
    mock_viva_response = {
        "message": {
            "content": """
            {
              "questions": [
                {
                  "question": "Explain how service orchestration operates.",
                  "ideal_answer": "Coordinates APIs sequentially to fulfill tasks.",
                  "follow_up_questions": ["What is a service?", "How is state maintained?"]
                }
              ]
            }
            """
        }
    }
    with patch("ollama.Client.chat", return_value=mock_viva_response):
        res = AssistantOrchestrator.generate_viva(student, course.id, [doc.id], "basic", 1)
        print("Viva result:", res)
        assert "questions" in res
        assert res["level"] == "basic"

    # 5. Test generate_glossary
    print("\nTesting glossary orchestration...")
    mock_glossary_response = {
        "message": {
            "content": """
            {
              "glossary": [
                {
                  "term": "Orchestration",
                  "definition": "Interaction coordination of components.",
                  "example": "An orchestrator coordinating LLM features.",
                  "page": 1
                }
              ]
            }
            """
        }
    }
    with patch("ollama.Client.chat", return_value=mock_glossary_response):
        res = AssistantOrchestrator.generate_glossary(student, doc.id)
        print("Glossary result:", res)
        assert "glossary" in res
        assert len(res["glossary"]) == 1

    # 6. Test extract_concepts
    print("\nTesting concept extraction orchestration...")
    mock_concept_response = {
        "message": {
            "content": """
            {
              "important_topics": ["Service Orchestration"],
              "definitions": [{"term": "Orchestration", "definition": "Interaction coordination."}],
              "formula_references": [],
              "keywords": ["Orchestration", "APIs"],
              "page_references": [{"topic_or_term": "Orchestration", "page_numbers": [1]}]
            }
            """
        }
    }
    with patch("ollama.Client.chat", return_value=mock_concept_response):
        res = AssistantOrchestrator.extract_concepts(student, doc.id)
        print("Concept extraction result:", res)
        assert "important_topics" in res
        assert "definitions" in res
        assert "page_references" in res

    print("\nAll orchestrator service layer checks passed successfully!")


if __name__ == "__main__":
    student, course, doc = setup_test_data()
    run_orchestrator_tests(student, course, doc)
