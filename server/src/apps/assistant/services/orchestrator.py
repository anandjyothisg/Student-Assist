import time
import json
import logging
import ollama

from apps.core.ai import get_ollama_client
from django.conf import settings
from django.db import transaction
from apps.documents.models import Document, DocumentChunk
from apps.assistant.models import GeneratedContent, GeneratedContentType

logger = logging.getLogger("apps.assistant")


def get_context_text(document_ids, max_char_limit=25000, page_tagging=False):
    """
    Compiles text context from a list of document IDs.
    """
    chunks = DocumentChunk.objects.filter(document_id__in=document_ids).order_by("document", "chunk_index")
    context_text_list = []
    current_char_count = 0
    for chunk in chunks:
        content = f"[Page {chunk.page_number}] {chunk.content}" if page_tagging else chunk.content
        if current_char_count + len(content) > max_char_limit:
            break
        context_text_list.append(content)
        current_char_count += len(content)
    return "\n\n".join(context_text_list)


def query_ollama_json(system_instruction, prompt, temperature=0.3):
    """
    Performs LLM call expecting JSON output.
    """
    client = get_ollama_client()
    response = client.chat(
        model=settings.OLLAMA_LLM_MODEL,
        messages=[
            {"role": "system", "content": system_instruction},
            {"role": "user", "content": prompt}
        ],
        options={"temperature": temperature}
    )
    content_str = response["message"]["content"].strip()
    
    if content_str.startswith("```"):
        lines = content_str.split("\n")
        if lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip().startswith("```"):
            lines = lines[:-1]
        content_str = "\n".join(lines).strip()
        
    return json.loads(content_str)


class AssistantOrchestrator:
    @staticmethod
    def run_chat(student, course_id, question, session_id=None):
        # Coordinates chat session RAG querying
        from apps.chat.services import run_chat_rag_query
        return run_chat_rag_query(student, course_id, question, session_id)

    @staticmethod
    def generate_summary(user, document_id, mode):
        # 1. Fetch document
        document = Document.objects.select_related("course").get(id=document_id)
        # 2. Get context
        context_text = get_context_text([document_id], page_tagging=False)
        if not context_text:
            raise ValueError("No content is available for this document to summarize.")
            
        word_limits = {"short": 100, "medium": 300, "detailed": 1000}
        word_limit = word_limits[mode]
        
        system_instruction = (
            "You are a precise academic assistant. Your task is to summarize the provided document context.\n"
            "Rules:\n"
            "1. Output ONLY the summary text. Do NOT add preamble, conversational filler, or side remarks.\n"
            "2. Refer ONLY to the provided context. Do NOT use outside facts, outside knowledge, or assume facts.\n"
            "3. Keep the summary comprehensive, precise, and academic."
        )
        prompt = (
            f"Please write a {mode} summary of the document context below. "
            f"The summary must be approximately {word_limit} words long.\n\n"
            f"CONTEXT:\n{context_text}"
        )
        
        llm_model = settings.OLLAMA_LLM_MODEL
        client = get_ollama_client()
        start_time = time.perf_counter()
        response = client.chat(
            model=llm_model,
            messages=[
                {"role": "system", "content": system_instruction},
                {"role": "user", "content": prompt}
            ]
        )
        summary_text = response["message"]["content"]
        if not summary_text or len(summary_text.strip()) == 0:
            summary_text = "Failed to generate summary text."
            
        response_time = time.perf_counter() - start_time
        word_count = len(summary_text.split())
        
        return {
            "summary": summary_text,
            "word_count": word_count,
            "response_time": round(float(response_time), 4)
        }

    @staticmethod
    def generate_quiz(user, course_id, document_ids, difficulty, question_count):
        docs_qs = Document.objects.filter(course_id=course_id, processing_status="completed", is_latest=True)
        if document_ids:
            docs_qs = docs_qs.filter(id__in=document_ids)
        docs = list(docs_qs)
        if not docs:
            raise ValueError("No processed course documents found to generate content from.")
            
        doc_ids = [d.id for d in docs]
        context_text = get_context_text(doc_ids, page_tagging=False)
        
        system_instruction = (
            "You are an expert academic curriculum assistant. Your task is to generate a multiple-choice quiz (MCQ) "
            "based ONLY on the provided document context.\n\n"
            "Rules:\n"
            "1. Generate exactly the requested number of questions.\n"
            "2. The questions must match the specified difficulty level.\n"
            "3. Every question must have exactly 4 options.\n"
            "4. One option must match the 'answer' field exactly.\n"
            "5. Provide a clear, detailed academic explanation of why that correct option is correct based on the context.\n"
            "6. Do NOT use outside knowledge or assume facts. Refer ONLY to the provided context.\n"
            "7. Output valid raw JSON in the exact schema format requested below. Do NOT wrap the JSON inside markdown code blocks, do NOT add introductory/explanatory text, and do NOT include any comments inside the JSON.\n\n"
            "Return EXACTLY this JSON format:\n"
            "{\n"
            "  \"questions\": [\n"
            "    {\n"
            "      \"question\": \"Question text?\",\n"
            "      \"options\": [\"Option A\", \"Option B\", \"Option C\", \"Option D\"],\n"
            "      \"answer\": \"Option A\",\n"
            "      \"explanation\": \"Detailed explanation here.\"\n"
            "    }\n"
            "  ]\n"
            "}"
        )
        prompt = (
            f"Generate {question_count} {difficulty} difficulty multiple-choice questions from the context below.\n\n"
            f"CONTEXT:\n{context_text}"
        )
        
        start_time = time.perf_counter()
        parsed_json = query_ollama_json(system_instruction, prompt)
        response_time = time.perf_counter() - start_time
        
        with transaction.atomic():
            content_obj = GeneratedContent.objects.create(
                course_id=course_id,
                created_by=user,
                content_type=GeneratedContentType.QUIZ,
                title=f"AI Generated {difficulty.capitalize()} Quiz ({question_count} Qs)",
                content=parsed_json
            )
            content_obj.source_documents.set(docs)
            
        return {
            "questions": parsed_json.get("questions", []),
            "difficulty": difficulty,
            "question_count": question_count,
            "response_time": round(float(response_time), 4)
        }

    @staticmethod
    def generate_flashcards(user, document_id, count):
        document = Document.objects.select_related("course").get(id=document_id)
        context_text = get_context_text([document_id], page_tagging=False)
        if not context_text:
            raise ValueError("No content is available for this document to generate flashcards from.")
            
        system_instruction = (
            "You are an expert academic tutoring assistant. Your task is to generate study flashcards "
            "based ONLY on the provided document context.\n\n"
            "Rules:\n"
            "1. Generate exactly the requested number of flashcards.\n"
            "2. Each flashcard must consist of a Question, Answer, Difficulty level, and Category.\n"
            "3. The Difficulty level must be one of: 'Easy', 'Medium', 'Hard'.\n"
            "4. The Category must represent the main topic/concept covered by the card (e.g. 'Definition', 'Core Concept', 'Formula').\n"
            "5. Do NOT use outside knowledge or assume facts. Refer ONLY to the provided context.\n"
            "6. Output valid raw JSON in the exact schema format requested below. Do NOT wrap the JSON inside markdown code blocks, do NOT add introductory/explanatory text, and do NOT include any comments inside the JSON.\n\n"
            "Return EXACTLY this JSON format:\n"
            "{\n"
            "  \"cards\": [\n"
            "    {\n"
            "      \"question\": \"Question text?\",\n"
            "      \"answer\": \"Answer text.\",\n"
            "      \"difficulty\": \"Easy\",\n"
            "      \"category\": \"Category name\"\n"
            "    }\n"
            "  ]\n"
            "}"
        )
        prompt = (
            f"Generate {count} flashcards from the context below.\n\n"
            f"CONTEXT:\n{context_text}"
        )
        
        start_time = time.perf_counter()
        parsed_json = query_ollama_json(system_instruction, prompt)
        response_time = time.perf_counter() - start_time
        
        with transaction.atomic():
            content_obj = GeneratedContent.objects.create(
                course_id=document.course_id,
                created_by=user,
                content_type=GeneratedContentType.FLASHCARD,
                title=f"AI Generated Flashcards for {document.title}",
                content=parsed_json
            )
            content_obj.source_documents.set([document])
            
        return {
            "cards": parsed_json.get("cards", []),
            "response_time": round(float(response_time), 4)
        }

    @staticmethod
    def generate_viva(user, course_id, document_ids, level, count):
        docs_qs = Document.objects.filter(course_id=course_id, processing_status="completed", is_latest=True)
        if document_ids:
            docs_qs = docs_qs.filter(id__in=document_ids)
        docs = list(docs_qs)
        if not docs:
            raise ValueError("No processed course documents found to generate content from.")
            
        doc_ids = [d.id for d in docs]
        context_text = get_context_text(doc_ids, page_tagging=False)
        
        system_instruction = (
            "You are an expert academic tutor. Your task is to generate oral examination (viva) preparation questions "
            "based ONLY on the provided document context.\n\n"
            "Rules:\n"
            "1. Generate exactly the requested number of questions.\n"
            "2. The questions must match the specified level (Basic, Intermediate, Advanced).\n"
            "3. Each viva question must include:\n"
            "   - question: The main oral question to ask the student.\n"
            "   - ideal_answer: A concise, accurate, and comprehensive ideal response expected from the student.\n"
            "   - follow_up_questions: A list of 2 or 3 logical follow-up questions to probe the student's depth of understanding.\n"
            "4. Do NOT use outside knowledge or assume facts. Refer ONLY to the provided context.\n"
            "5. Output valid raw JSON in the exact schema format requested below. Do NOT wrap the JSON inside markdown code blocks, do NOT add introductory/explanatory text, and do NOT include any comments inside the JSON.\n\n"
            "Return EXACTLY this JSON format:\n"
            "{\n"
            "  \"questions\": [\n"
            "    {\n"
            "      \"question\": \"Question text?\",\n"
            "      \"ideal_answer\": \"Ideal response text.\",\n"
            "      \"follow_up_questions\": [\n"
            "        \"Follow-up question 1?\",\n"
            "        \"Follow-up question 2?\"\n"
            "      ]\n"
            "    }\n"
            "  ]\n"
            "}"
        )
        prompt = (
            f"Generate {count} {level} difficulty viva questions from the context below.\n\n"
            f"CONTEXT:\n{context_text}"
        )
        
        start_time = time.perf_counter()
        parsed_json = query_ollama_json(system_instruction, prompt)
        response_time = time.perf_counter() - start_time
        
        with transaction.atomic():
            content_obj = GeneratedContent.objects.create(
                course_id=course_id,
                created_by=user,
                content_type=GeneratedContentType.VIVA,
                title=f"AI Generated {level.capitalize()} Viva Prep",
                content=parsed_json
            )
            content_obj.source_documents.set(docs)
            
        return {
            "questions": parsed_json.get("questions", []),
            "level": level,
            "response_time": round(float(response_time), 4)
        }

    @staticmethod
    def generate_glossary(user, document_id):
        document = Document.objects.select_related("course").get(id=document_id)
        context_text = get_context_text([document_id], page_tagging=True)
        if not context_text:
            raise ValueError("No content is available for this document to generate a glossary from.")
            
        system_instruction = (
            "You are an expert academic tutoring assistant. Your task is to generate a comprehensive glossary "
            "based ONLY on the provided document context. You must resolve the page numbers using the [Page X] tags in the context.\n\n"
            "Rules:\n"
            "1. Extract all technical terms and academic vocabulary from the context.\n"
            "2. Provide a clear, precise definition for each term.\n"
            "3. Provide a contextual or concrete example demonstrating the term's usage (ideally based on details in the context).\n"
            "4. Specify the document page number where the term is discussed.\n"
            "5. Do NOT use outside knowledge or assume facts. Refer ONLY to the provided context.\n"
            "6. Output valid raw JSON in the exact schema format requested below. Do NOT wrap the JSON inside markdown code blocks, do NOT add introductory/explanatory text, and do NOT include any comments inside the JSON.\n\n"
            "Return EXACTLY this JSON format:\n"
            "{\n"
            "  \"glossary\": [\n"
            "    {\n"
            "      \"term\": \"Technical term name\",\n"
            "      \"definition\": \"Definition text\",\n"
            "      \"example\": \"Example usage or application text\",\n"
            "      \"page\": 1\n"
            "    }\n"
            "  ]\n"
            "}"
        )
        prompt = (
            f"Generate a glossary from the document context below.\n\n"
            f"CONTEXT:\n{context_text}"
        )
        
        start_time = time.perf_counter()
        parsed_json = query_ollama_json(system_instruction, prompt)
        response_time = time.perf_counter() - start_time
        
        with transaction.atomic():
            content_obj = GeneratedContent.objects.create(
                course_id=document.course_id,
                created_by=user,
                content_type=GeneratedContentType.SUMMARY,
                title=f"Glossary: {document.title}",
                content=parsed_json
            )
            content_obj.source_documents.set([document])
            
        return {
            "glossary": parsed_json.get("glossary", []),
            "response_time": round(float(response_time), 4)
        }

    @staticmethod
    def extract_concepts(user, document_id):
        document = Document.objects.select_related("course").get(id=document_id)
        context_text = get_context_text([document_id], page_tagging=True)
        if not context_text:
            raise ValueError("No content is available for this document to extract concepts from.")
            
        system_instruction = (
            "You are an expert academic tutoring assistant. Your task is to extract key concepts "
            "based ONLY on the provided document context. You must resolve page references using the [Page X] tags in the context.\n\n"
            "Rules:\n"
            "1. Extract important topics discussed in the context.\n"
            "2. Extract terms and their corresponding definitions.\n"
            "3. Extract any mathematical or scientific formulas mentioned, along with their description. If none exist, return an empty list.\n"
            "4. Extract key keywords/phrases from the text.\n"
            "5. Extract page references for the key topics/terms identified, referencing the pages they occur on.\n"
            "6. Do NOT use outside knowledge or assume facts. Refer ONLY to the provided context.\n"
            "7. Output valid raw JSON in the exact schema format requested below. Do NOT wrap the JSON inside markdown code blocks, do NOT add introductory/explanatory text, and do NOT include any comments inside the JSON.\n\n"
            "Return EXACTLY this JSON format:\n"
            "{\n"
            "  \"important_topics\": [\"Topic Name 1\", \"Topic Name 2\"],\n"
            "  \"definitions\": [\n"
            "    {\n"
            "      \"term\": \"Term\",\n"
            "      \"definition\": \"Definition text\"\n"
            "    }\n"
            "  ],\n"
            "  \"formula_references\": [\n"
            "    {\n"
            "      \"formula\": \"Formula or Equation\",\n"
            "      \"description\": \"What the formula calculates or defines\"\n"
            "    }\n"
            "  ],\n"
            "  \"keywords\": [\"Keyword1\", \"Keyword2\"],\n"
            "  \"page_references\": [\n"
            "    {\n"
            "      \"topic_or_term\": \"Topic or Term Name\",\n"
            "      \"page_numbers\": [1, 2]\n"
            "    }\n"
            "  ]\n"
            "}"
        )
        prompt = (
            f"Extract key concepts from the document context below.\n\n"
            f"CONTEXT:\n{context_text}"
        )
        
        start_time = time.perf_counter()
        parsed_json = query_ollama_json(system_instruction, prompt)
        response_time = time.perf_counter() - start_time
        
        with transaction.atomic():
            content_obj = GeneratedContent.objects.create(
                course_id=document.course_id,
                created_by=user,
                content_type=GeneratedContentType.SUMMARY,
                title=f"Key Concepts: {document.title}",
                content=parsed_json
            )
            content_obj.source_documents.set([document])
            
        return {
            "important_topics": parsed_json.get("important_topics", []),
            "definitions": parsed_json.get("definitions", []),
            "formula_references": parsed_json.get("formula_references", []),
            "keywords": parsed_json.get("keywords", []),
            "page_references": parsed_json.get("page_references", []),
            "response_time": round(float(response_time), 4)
        }
