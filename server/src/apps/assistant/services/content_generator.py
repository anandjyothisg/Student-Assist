"""
SmartStudent AI — AI Study Aid Content Generator Service
"""

import json
import logging
import ollama

from apps.core.ai import get_ollama_client
from django.conf import settings
from django.db import transaction

from apps.assistant.models import GeneratedContent, GeneratedContentType
from apps.documents.models import Document, DocumentChunk

logger = logging.getLogger("apps.assistant")


def generate_content(validated_data: dict, user) -> GeneratedContent:
    """
    Generates AI-powered study aids: summary, quiz, flashcards, or viva questions.
    
    1. Collects text context from specified or all course documents.
    2. Constructs a structured JSON schema instruction prompt.
    3. Triggers Ollama LLM execution.
    4. Parses the JSON payload and saves the GeneratedContent object in PostgreSQL.
    """
    course_id = validated_data["course_id"]
    content_type = validated_data["content_type"]
    document_ids = validated_data.get("document_ids", [])
    title = validated_data.get("title", "")
    instructions = validated_data.get("instructions", "")

    # Retrieve documents to use as context
    docs_qs = Document.objects.filter(course_id=course_id, processing_status="completed", is_latest=True)
    if document_ids:
        docs_qs = docs_qs.filter(id__in=document_ids)
        
    docs = list(docs_qs)
    if not docs:
        raise ValueError("No processed course documents found to generate content from.")

    # Aggregate text content (limiting to avoid exceeding context window, e.g. ~25000 characters)
    chunks_qs = DocumentChunk.objects.filter(document__in=docs).order_by("document", "chunk_index")
    
    context_text_list = []
    current_char_count = 0
    max_char_limit = 25000
    
    for chunk in chunks_qs:
        if current_char_count + len(chunk.content) > max_char_limit:
            break
        context_text_list.append(chunk.content)
        current_char_count += len(chunk.content)
        
    context_text = "\n\n".join(context_text_list)

    # Prepare formatting rules based on type
    if content_type == GeneratedContentType.SUMMARY:
        schema_instruction = (
            "Generate a structured summary of the materials.\n"
            "Return EXACTLY this JSON format:\n"
            "{\n"
            "  \"text\": \"A comprehensive paragraph summarizing the main concepts.\",\n"
            "  \"key_points\": [\n"
            "    \"Key point 1\",\n"
            "    \"Key point 2\"\n"
            "  ]\n"
            "}"
        )
    elif content_type == GeneratedContentType.QUIZ:
        schema_instruction = (
            "Generate a multiple-choice quiz of 5 questions based on the materials.\n"
            "Return EXACTLY this JSON format:\n"
            "{\n"
            "  \"questions\": [\n"
            "    {\n"
            "      \"question\": \"The question text?\",\n"
            "      \"options\": [\"Option A\", \"Option B\", \"Option C\", \"Option D\"],\n"
            "      \"answer\": \"Option A\" \n"
            "    }\n"
            "  ]\n"
            "}"
        )
    elif content_type == GeneratedContentType.FLASHCARD:
        schema_instruction = (
            "Generate 5 flashcards for study review based on the materials.\n"
            "Return EXACTLY this JSON format:\n"
            "{\n"
            "  \"cards\": [\n"
            "    {\n"
            "      \"front\": \"Term or question on front of card\",\n"
            "      \"back\": \"Definition or answer on back of card\"\n"
            "    }\n"
            "  ]\n"
            "}"
        )
    elif content_type == GeneratedContentType.VIVA:
        schema_instruction = (
            "Generate 5 oral examination (viva) questions with model answers based on the materials.\n"
            "Return EXACTLY this JSON format:\n"
            "{\n"
            "  \"questions\": [\n"
            "    {\n"
            "      \"question\": \"Viva question?\",\n"
            "      \"expected_answer\": \"Model short oral answer expected from the student.\"\n"
            "    }\n"
            "  ]\n"
            "}"
        )
    else:
        raise ValueError(f"Unknown content type: {content_type}")

    # Build system prompt
    system_prompt = (
        "You are an expert academic curriculum assistant.\n"
        "Your task is to generate study aids based ONLY on the provided document context.\n"
        f"You MUST output valid raw JSON adhering exactly to the schema requested below. Do NOT wrap the JSON inside markdown code blocks (like ```json), do NOT include any surrounding introductory or explanatory text, and do NOT include any comments inside the JSON.\n\n"
        f"SCHEMA INSTRUCTION:\n{schema_instruction}"
    )

    prompt_content = f"CONTEXT:\n{context_text}\n"
    if instructions:
        prompt_content += f"\nEXTRA INSTRUCTIONS FOR GENERATION:\n{instructions}\n"

    logger.info(f"Triggering Ollama LLM to generate {content_type} content.")
    
    try:
        client = get_ollama_client()
        response = client.chat(
            model=settings.OLLAMA_LLM_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt_content}
            ],
            options={"temperature": 0.3} # Keep generation focused
        )
        content_str = response["message"]["content"].strip()
        
        # Clean markdown code blocks if the LLM ignored formatting rules
        if content_str.startswith("```"):
            lines = content_str.split("\n")
            if lines[0].startswith("```"):
                lines = lines[1:]
            if lines and lines[-1].strip().startswith("```"):
                lines = lines[:-1]
            content_str = "\n".join(lines).strip()
            
        parsed_json = json.loads(content_str)
        
    except json.JSONDecodeError as je:
        logger.error(f"Failed to parse JSON response from Ollama: {je}")
        logger.error(f"Raw model response: {content_str}")
        raise ValueError("The AI model generated an invalid format. Please try again.")
    except Exception as e:
        logger.error(f"Error generating content via Ollama: {e}")
        raise ValueError("The AI service is currently unavailable. Please verify that Ollama is running.")

    # Save to PostgreSQL
    with transaction.atomic():
        content_obj = GeneratedContent.objects.create(
            course_id=course_id,
            created_by=user,
            content_type=content_type,
            title=title or f"AI Generated {content_type.capitalize()}",
            content=parsed_json
        )
        content_obj.source_documents.set(docs)

    logger.info(f"AI Content Generated successfully: {content_obj.id}")
    return content_obj
