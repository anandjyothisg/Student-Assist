"""
SmartStudent AI — Assistant Views
"""

import logging

from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet, GenericViewSet
from rest_framework import mixins

from apps.assistant.models import Conversation, GeneratedContent, Message, MessageRole
from apps.assistant.serializers import (
    ConversationCreateSerializer,
    ConversationDetailSerializer,
    ConversationListSerializer,
    GeneratedContentCreateSerializer,
    GeneratedContentSerializer,
    MessageCreateSerializer,
    MessageSerializer,
)
from apps.core.pagination import SmallPagination, StandardPagination
from apps.core.permissions import IsAdminOrTeacher, IsStudent
from apps.assistant.services.rag_pipeline import run_rag_query
from apps.assistant.services.content_generator import generate_content

logger = logging.getLogger("apps.assistant")


class ConversationViewSet(
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.DestroyModelMixin,
    mixins.ListModelMixin,
    GenericViewSet,
):
    """
    Manages AI tutoring conversations for students.

    list:     GET  /api/v1/assistant/conversations/
    create:   POST /api/v1/assistant/conversations/
    retrieve: GET  /api/v1/assistant/conversations/{id}/
    destroy:  DELETE /api/v1/assistant/conversations/{id}/
    ask:      POST /api/v1/assistant/conversations/{id}/ask/
    messages: GET  /api/v1/assistant/conversations/{id}/messages/
    """

    pagination_class = StandardPagination
    permission_classes = [IsAuthenticated]
    http_method_names = ["get", "post", "delete", "head", "options"]

    def get_serializer_class(self):
        if self.action == "create":
            return ConversationCreateSerializer
        if self.action == "retrieve":
            return ConversationDetailSerializer
        return ConversationListSerializer

    def get_queryset(self):
        user = self.request.user
        qs = Conversation.objects.select_related("student", "course")

        if user.is_student:
            qs = qs.filter(student=user, is_active=True)
        elif user.is_teacher:
            # Teachers can monitor conversations in their courses
            qs = qs.filter(course__teacher=user)
        # Admins see all

        course_id = self.request.query_params.get("course")
        if course_id:
            qs = qs.filter(course_id=course_id)

        return qs.order_by("-created_at")

    def perform_create(self, serializer):
        conversation = serializer.save(student=self.request.user)
        logger.info(
            f"Conversation {conversation.id} created by {self.request.user.email} "
            f"in course {conversation.course.code}"
        )

    def destroy(self, request: Request, *args, **kwargs) -> Response:
        conversation = self.get_object()
        if not (request.user.is_admin or conversation.student == request.user):
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)
        # Soft delete
        conversation.is_active = False
        conversation.save(update_fields=["is_active"])
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["get"], pagination_class=SmallPagination)
    def messages(self, request: Request, pk=None) -> Response:
        """GET /api/v1/assistant/conversations/{id}/messages/"""
        conversation = self.get_object()
        qs = conversation.messages.prefetch_related("citations").order_by("created_at")
        page = self.paginate_queryset(qs)
        if page is not None:
            serializer = MessageSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        return Response(MessageSerializer(qs, many=True).data)

    @action(detail=True, methods=["post"])
    def ask(self, request: Request, pk=None) -> Response:
        """
        POST /api/v1/assistant/conversations/{id}/ask/

        Accepts: {"question": "What is a neural network?"}
        Returns: The assistant's message with citations.
        """
        conversation = self.get_object()

        # Only the conversation owner (student) can ask
        if conversation.student != request.user and not request.user.is_admin:
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)

        serializer = MessageCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        question = serializer.validated_data["question"]

        # Save user message
        Message.objects.create(
            conversation=conversation,
            role=MessageRole.USER,
            content=question,
        )

        # Trigger semantic retrieval & LLM inference RAG query pipeline
        assistant_message = run_rag_query(conversation, question)

        logger.info(
            f"[ask] Question processed in conversation {conversation.id}: "
            f"{question[:80]}..."
        )

        return Response(
            MessageSerializer(assistant_message).data,
            status=status.HTTP_201_CREATED,
        )

    @action(
        detail=False,
        methods=["post"],
        permission_classes=[IsAuthenticated],
        url_path="retrieve",
    )
    def retrieve_chunks(self, request: Request) -> Response:
        """
        POST /api/v1/assistant/conversations/retrieve/
        
        Accepts:
        {
          "course_id": "<uuid>",
          "question": "What is semantic search?"
        }
        Returns the top 5 most similar chunks from ChromaDB with similarity scores,
        without triggering any LLM or AI generation response.
        """
        data = request.data
        if not isinstance(data, dict):
            return Response(
                {"detail": "Request body must be a JSON object."},
                status=status.HTTP_400_BAD_REQUEST
            )
            
        course_id = data.get("course_id")
        if course_id:
            from apps.chat.services import resolve_course_ids
            resolve_course_ids(request.user, course_id)  # raises 403 if not permitted
        question = data.get("question")
        
        if not course_id or not question:
            return Response(
                {"detail": "Parameters 'course_id' and 'question' are required."},
                status=status.HTTP_400_BAD_REQUEST
            )
            
        from apps.documents.services.embedder import generate_query_embedding
        from apps.documents.services.vector_store import search_relevant_chunks
        
        try:
            # 1. Generate query embedding
            query_vector = generate_query_embedding(question)
            
            # 2. Query ChromaDB for top 5 chunks
            results = search_relevant_chunks(
                course_id=str(course_id),
                query_embedding=query_vector,
                top_k=5
            )
            
            return Response(results, status=status.HTTP_200_OK)
        except Exception as e:
            logger.exception(f"Semantic retrieval failed: {e}")
            return Response(
                {"detail": f"Failed to perform semantic retrieval: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(
        detail=False,
        methods=["post"],
        permission_classes=[IsAuthenticated],
        url_path="prompt",
    )
    def construct_prompt(self, request: Request) -> Response:
        """
        POST /api/v1/assistant/conversations/prompt/
        
        Accepts:
        {
          "chunks": ["context chunk 1", "context chunk 2"],
          "question": "What is the capital of France?"
        }
        Returns the context-constrained RAG prompt text.
        """
        data = request.data
        if not isinstance(data, dict):
            return Response(
                {"detail": "Request body must be a JSON object."},
                status=status.HTTP_400_BAD_REQUEST
            )
            
        chunks = data.get("chunks", [])
        question = data.get("question")
        
        if not isinstance(chunks, list):
            return Response(
                {"detail": "Parameter 'chunks' must be a JSON list of strings."},
                status=status.HTTP_400_BAD_REQUEST
            )
            
        if not question:
            return Response(
                {"detail": "Parameter 'question' is required."},
                status=status.HTTP_400_BAD_REQUEST
            )
            
        from apps.assistant.services.rag_pipeline import build_rag_prompt
        try:
            prompt_text = build_rag_prompt(chunks, question)
            return Response({"prompt": prompt_text}, status=status.HTTP_200_OK)
        except Exception as e:
            logger.exception(f"Prompt construction failed: {e}")
            return Response(
                {"detail": f"Failed to build prompt: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(
        detail=False,
        methods=["post"],
        permission_classes=[IsAuthenticated],
        url_path="citations",
    )
    def generate_citations(self, request: Request) -> Response:
        """
        POST /api/v1/assistant/conversations/citations/
        
        Accepts:
        {
          "course_id": "<uuid>",
          "question": "student query text"
        }
        Returns a list of structured citation objects:
        [
          {
            "page_number": int,
            "chunk_id": str,
            "document_title": str,
            "confidence_score": float
          }
        ]
        """
        data = request.data
        if not isinstance(data, dict):
            return Response(
                {"detail": "Request body must be a JSON object."},
                status=status.HTTP_400_BAD_REQUEST
            )
            
        course_id = data.get("course_id")
        if course_id:
            from apps.chat.services import resolve_course_ids
            resolve_course_ids(request.user, course_id)  # raises 403 if not permitted
        question = data.get("question")
        
        if not course_id or not question:
            return Response(
                {"detail": "Parameters 'course_id' and 'question' are required."},
                status=status.HTTP_400_BAD_REQUEST
            )
            
        from apps.documents.services.embedder import generate_query_embedding
        from apps.documents.services.vector_store import search_relevant_chunks
        from apps.documents.models import Document
        
        try:
            # 1. Generate query embedding
            query_vector = generate_query_embedding(question)
            
            # 2. Retrieve top chunks (up to 5)
            raw_chunks = search_relevant_chunks(
                course_id=str(course_id),
                query_embedding=query_vector,
                top_k=5
            )
            
            # 3. Formulate citation structures
            doc_ids = {c["metadata"]["document_id"] for c in raw_chunks}
            docs_map = {str(d.id): d for d in Document.objects.filter(id__in=doc_ids)}
            
            citations = []
            for c in raw_chunks:
                doc_id = c["metadata"]["document_id"]
                page_num = c["metadata"].get("page_number", 1)
                doc_obj = docs_map.get(doc_id)
                doc_title = doc_obj.title if doc_obj else "Unknown Document"
                
                # Similarity/Confidence calculation: 1 - cosine_distance
                confidence = max(0.0, min(1.0, 1.0 - c["distance"]))
                
                citations.append({
                    "page_number": int(page_num),
                    "chunk_id": str(c["id"]),
                    "document_title": str(doc_title),
                    "confidence_score": round(float(confidence), 4)
                })
                
            return Response(citations, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.exception(f"Citation generation failed: {e}")
            return Response(
                {"detail": f"Failed to generate citations: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(
        detail=False,
        methods=["post"],
        permission_classes=[IsAuthenticated],
        url_path="rag",
    )
    def query_rag_pipeline(self, request: Request) -> Response:
        """
        POST /api/v1/assistant/conversations/rag/
        
        Stateless RAG query pipeline:
        1. Question input
        2. Generate embedding (SentenceTransformer)
        3. Search ChromaDB (top 5 chunks)
        4. Construct prompt (with context guidelines & fallback rule)
        5. Ollama LLM chat inference
        6. Citation formatting (page, chunk ID, title, score)
        7. Returns final response JSON with answer and citations.
        """
        data = request.data
        if not isinstance(data, dict):
            return Response(
                {"detail": "Request body must be a JSON object."},
                status=status.HTTP_400_BAD_REQUEST
            )
            
        course_id = data.get("course_id")
        if course_id:
            from apps.chat.services import resolve_course_ids
            resolve_course_ids(request.user, course_id)  # raises 403 if not permitted
        question = data.get("question")
        
        if not course_id or not question:
            return Response(
                {"detail": "Parameters 'course_id' and 'question' are required."},
                status=status.HTTP_400_BAD_REQUEST
            )
            
        from apps.documents.services.embedder import generate_query_embedding
        from apps.documents.services.vector_store import search_relevant_chunks
        from apps.assistant.services.rag_pipeline import build_rag_prompt
        from apps.documents.models import Document
        import ollama
        from django.conf import settings
        
        try:
            # 1. Generate embedding
            query_vector = generate_query_embedding(question)
            
            # 2. Search ChromaDB
            raw_chunks = search_relevant_chunks(
                course_id=str(course_id),
                query_embedding=query_vector,
                top_k=5
            )
            
            # Calculate distance threshold
            max_distance_threshold = 0.85
            filtered_chunks = [c for c in raw_chunks if c["distance"] <= max_distance_threshold]
            
            # 3. Citation generation
            doc_ids = {c["metadata"]["document_id"] for c in filtered_chunks}
            docs_map = {str(d.id): d for d in Document.objects.filter(id__in=doc_ids)}
            
            citations = []
            context_texts = []
            for c in filtered_chunks:
                doc_id = c["metadata"]["document_id"]
                page_num = c["metadata"].get("page_number", 1)
                doc_obj = docs_map.get(doc_id)
                doc_title = doc_obj.title if doc_obj else "Unknown Document"
                
                confidence = max(0.0, min(1.0, 1.0 - c["distance"]))
                
                citations.append({
                    "page_number": int(page_num),
                    "chunk_id": str(c["id"]),
                    "document_title": str(doc_title),
                    "confidence_score": round(float(confidence), 4)
                })
                
                context_texts.append(c["content"])
                
            # 4. Prompt builder
            prompt = build_rag_prompt(context_texts, question)
            
            # 5. Ollama query
            fallback_answer = "I couldn't find this information in the uploaded study material."
            
            if not context_texts:
                answer = fallback_answer
            else:
                llm_model = settings.OLLAMA_LLM_MODEL
                client = ollama.Client(host=settings.OLLAMA_BASE_URL)
                
                response = client.chat(
                    model=llm_model,
                    messages=[
                        {"role": "user", "content": prompt}
                    ]
                )
                answer = response["message"]["content"]
                
                if not answer or len(answer.strip()) == 0:
                    answer = fallback_answer
                    
            # 6. Response JSON
            return Response(
                {
                    "answer": answer,
                    "citations": citations
                },
                status=status.HTTP_200_OK
            )
        except Exception as e:
            logger.exception(f"RAG query pipeline execution failed: {e}")
            return Response(
                {"detail": f"Failed to execute RAG query pipeline: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )





class GeneratedContentViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.DestroyModelMixin,
    GenericViewSet,
):
    """
    Manages AI-generated study content (summaries, quizzes, flashcards, viva).

    list:     GET  /api/v1/assistant/generated/
    retrieve: GET  /api/v1/assistant/generated/{id}/
    destroy:  DELETE /api/v1/assistant/generated/{id}/
    generate: POST /api/v1/assistant/generated/generate/
    """

    pagination_class = StandardPagination
    permission_classes = [IsAuthenticated]
    http_method_names = ["get", "post", "delete", "head", "options"]

    def get_serializer_class(self):
        return GeneratedContentSerializer

    def get_queryset(self):
        user = self.request.user
        qs = GeneratedContent.objects.select_related(
            "course", "created_by"
        ).prefetch_related("source_documents")

        if user.is_student:
            enrolled = user.enrollments.filter(is_active=True).values_list("course_id", flat=True)
            # Students only see what they generated themselves.
            qs = qs.filter(course_id__in=enrolled, created_by=user)
        elif user.is_teacher:
            qs = qs.filter(course__teacher=user)

        content_type = self.request.query_params.get("type")
        if content_type:
            qs = qs.filter(content_type=content_type)

        content_type = self.request.query_params.get("content_type")
        if content_type:
            qs = qs.filter(content_type=content_type)
        if self.request.query_params.get("mine") == "true":
            qs = qs.filter(created_by=user)
        course_id = self.request.query_params.get("course")
        if course_id:
            qs = qs.filter(course_id=course_id)

        return qs.order_by("-created_at")

    @action(detail=False, methods=["post"], permission_classes=[IsAuthenticated])
    def generate(self, request: Request) -> Response:
        """
        POST /api/v1/assistant/generated/generate/

        Request body:
            {
                "content_type": "quiz" | "summary" | "flashcard" | "viva",
                "course_id": "<uuid>",
                "document_ids": ["<uuid>", ...],  // optional
                "title": "...",                     // optional
                "instructions": "..."               // optional
            }
        """
        serializer = GeneratedContentCreateSerializer(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        from apps.chat.services import resolve_course_ids
        gen_course = serializer.validated_data.get("course_id") or serializer.validated_data.get("course")
        if gen_course is None:
            return Response({"detail": "course_id is required."}, status=status.HTTP_400_BAD_REQUEST)
        resolve_course_ids(request.user, getattr(gen_course, "id", gen_course))

        try:
            result = generate_content(serializer.validated_data, request.user)
            return Response(
                GeneratedContentSerializer(result).data, 
                status=status.HTTP_201_CREATED
            )
        except ValueError as ve:
            return Response(
                {"detail": str(ve)}, 
                status=status.HTTP_400_BAD_REQUEST
            )


import time
import json
import ollama
from django.conf import settings
from django.db import transaction
from rest_framework.views import APIView
from apps.documents.models import Document, DocumentChunk
from apps.academic.models import Enrollment
from apps.assistant.models import GeneratedContent, GeneratedContentType
from apps.assistant.serializers import (
    DocumentSummarizeInputSerializer,
    QuizGenerateInputSerializer,
    FlashcardGenerateInputSerializer,
    VivaGenerateInputSerializer,
    ConceptExtractInputSerializer,
    GlossaryGenerateInputSerializer,
)


class DocumentSummarizeView(APIView):
    """
    POST /api/assistant/summarize/
    Provides summary generation for course documents.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        serializer = DocumentSummarizeInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        document_id = serializer.validated_data["document_id"]
        mode = serializer.validated_data["mode"]

        # 1. Fetch document
        try:
            document = Document.objects.select_related("course").get(id=document_id)
        except Document.DoesNotExist:
            return Response(
                {"detail": "Document not found."},
                status=status.HTTP_404_NOT_FOUND
            )

        # 2. Check permissions
        user = request.user
        if user.is_student:
            if not Enrollment.objects.filter(student=user, course=document.course, is_active=True).exists():
                return Response(
                    {"detail": "You do not have permission to access this document's course."},
                    status=status.HTTP_403_FORBIDDEN
                )
        elif user.is_teacher:
            if document.course.teacher != user:
                return Response(
                    {"detail": "You do not teach the course associated with this document."},
                    status=status.HTTP_403_FORBIDDEN
                )
        elif not user.is_admin:
            return Response(
                {"detail": "Forbidden."},
                status=status.HTTP_403_FORBIDDEN
            )

        # 3. Retrieve chunks
        chunks = DocumentChunk.objects.filter(document=document).order_by("chunk_index")
        if not chunks.exists():
            return Response(
                {"detail": "No content is available for this document to summarize."},
                status=status.HTTP_400_BAD_REQUEST
            )

        context_text = "\n\n".join([c.content for c in chunks])

        # Word limits
        word_limits = {
            "short": 100,
            "medium": 300,
            "detailed": 1000
        }
        word_limit = word_limits[mode]

        # 4. Prompt & LLM Execution
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
        logger.info(f"Generating {mode} summary for document {document.id} using model {llm_model}")
        
        start_time = time.perf_counter()
        try:
            client = ollama.Client(host=settings.OLLAMA_BASE_URL)
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
        except Exception as e:
            logger.exception(f"Ollama summarization call failed: {e}")
            summary_text = "⚠️ The AI Summarization tool is temporarily unavailable. Please verify the local Ollama service."

        response_time = time.perf_counter() - start_time
        word_count = len(summary_text.split())

        return Response({
            "summary": summary_text,
            "word_count": word_count,
            "response_time": round(float(response_time), 4)
        }, status=status.HTTP_200_OK)


class QuizGenerateView(APIView):
    """
    POST /api/assistant/quiz/generate/
    Generates structured MCQs from course document context.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        serializer = QuizGenerateInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        course_id = serializer.validated_data["course_id"]
        document_ids = serializer.validated_data.get("document_ids", [])
        difficulty = serializer.validated_data["difficulty"]
        question_count = serializer.validated_data["question_count"]

        # 1. Permission checks
        user = request.user
        if user.is_student:
            if not Enrollment.objects.filter(student=user, course_id=course_id, is_active=True).exists():
                return Response(
                    {"detail": "You do not have permission to generate quizzes for this course."},
                    status=status.HTTP_403_FORBIDDEN
                )
        elif user.is_teacher:
            from apps.academic.models import Course
            if not Course.objects.filter(id=course_id, teacher=user).exists():
                return Response(
                    {"detail": "You do not teach this course."},
                    status=status.HTTP_403_FORBIDDEN
                )
        elif not user.is_admin:
            return Response(
                {"detail": "Forbidden."},
                status=status.HTTP_403_FORBIDDEN
            )

        # 2. Retrieve completed documents
        docs_qs = Document.objects.filter(course_id=course_id, processing_status="completed")
        if document_ids:
            docs_qs = docs_qs.filter(id__in=document_ids)
        docs = list(docs_qs)
        if not docs:
            return Response(
                {"detail": "No processed course documents found to generate content from."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 3. Retrieve chunks up to limit
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

        # 4. Prompt Assembly & Ollama Call
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

        llm_model = settings.OLLAMA_LLM_MODEL
        logger.info(f"Generating {question_count} {difficulty} MCQs for course {course_id} using model {llm_model}")
        
        start_time = time.perf_counter()
        try:
            client = ollama.Client(host=settings.OLLAMA_BASE_URL)
            response = client.chat(
                model=llm_model,
                messages=[
                    {"role": "system", "content": system_instruction},
                    {"role": "user", "content": prompt}
                ],
                options={"temperature": 0.3},
                format="json",
            )
            content_str = response["message"]["content"].strip()

            if content_str.startswith("```"):
                lines = content_str.split("\n")
                if lines[0].startswith("```"):
                    lines = lines[1:]
                if lines and lines[-1].strip().startswith("```"):
                    lines = lines[:-1]
                content_str = "\n".join(lines).strip()

            from apps.core.ai import parse_llm_json
            parsed_json = parse_llm_json(content_str)
        except json.JSONDecodeError as je:
            logger.error(f"Failed to parse MCQ JSON: {je}. Raw: {content_str}")
            return Response(
                {"detail": "The AI model generated an invalid format. Please try again."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        except Exception as e:
            logger.exception(f"Ollama MCQ generation call failed: {e}")
            return Response(
                {"detail": "The AI service is currently unavailable. Please verify the local Ollama service."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        response_time = time.perf_counter() - start_time

        # 5. Save to database
        with transaction.atomic():
            content_obj = GeneratedContent.objects.create(
                course_id=course_id,
                created_by=request.user,
                content_type=GeneratedContentType.QUIZ,
                title=f"AI Generated {difficulty.capitalize()} Quiz ({question_count} Qs)",
                content=parsed_json
            )
            content_obj.source_documents.set(docs)

        # 6. Response
        return Response({
            "questions": parsed_json.get("questions", []),
            "difficulty": difficulty,
            "question_count": question_count,
            "response_time": round(float(response_time), 4)
        }, status=status.HTTP_200_OK)


class FlashcardGenerateView(APIView):
    """
    POST /api/assistant/flashcard/generate/
    Generates structured flashcards from document context.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        serializer = FlashcardGenerateInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        document_id = serializer.validated_data["document_id"]
        count = serializer.validated_data["count"]

        # 1. Fetch document
        try:
            document = Document.objects.select_related("course").get(id=document_id)
        except Document.DoesNotExist:
            return Response(
                {"detail": "Document not found."},
                status=status.HTTP_404_NOT_FOUND
            )

        # 2. Check permissions
        user = request.user
        if user.is_student:
            if not Enrollment.objects.filter(student=user, course=document.course, is_active=True).exists():
                return Response(
                    {"detail": "You do not have permission to access this document's course."},
                    status=status.HTTP_403_FORBIDDEN
                )
        elif user.is_teacher:
            if document.course.teacher != user:
                return Response(
                    {"detail": "You do not teach the course associated with this document."},
                    status=status.HTTP_403_FORBIDDEN
                )
        elif not user.is_admin:
            return Response(
                {"detail": "Forbidden."},
                status=status.HTTP_403_FORBIDDEN
            )

        # 3. Retrieve chunks
        chunks = DocumentChunk.objects.filter(document=document).order_by("chunk_index")
        if not chunks.exists():
            return Response(
                {"detail": "No content is available for this document to generate flashcards from."},
                status=status.HTTP_400_BAD_REQUEST
            )

        context_text = "\n\n".join([c.content for c in chunks])

        # 4. Prompt Assembly & Ollama Call
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

        llm_model = settings.OLLAMA_LLM_MODEL
        logger.info(f"Generating {count} flashcards for document {document.id} using model {llm_model}")
        
        start_time = time.perf_counter()
        try:
            client = ollama.Client(host=settings.OLLAMA_BASE_URL)
            response = client.chat(
                model=llm_model,
                messages=[
                    {"role": "system", "content": system_instruction},
                    {"role": "user", "content": prompt}
                ],
                options={"temperature": 0.3},
                format="json",
            )
            content_str = response["message"]["content"].strip()

            if content_str.startswith("```"):
                lines = content_str.split("\n")
                if lines[0].startswith("```"):
                    lines = lines[1:]
                if lines and lines[-1].strip().startswith("```"):
                    lines = lines[:-1]
                content_str = "\n".join(lines).strip()

            from apps.core.ai import parse_llm_json
            parsed_json = parse_llm_json(content_str)
        except json.JSONDecodeError as je:
            logger.error(f"Failed to parse Flashcard JSON: {je}. Raw: {content_str}")
            return Response(
                {"detail": "The AI model generated an invalid format. Please try again."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        except Exception as e:
            logger.exception(f"Ollama Flashcard generation call failed: {e}")
            return Response(
                {"detail": "The AI service is currently unavailable. Please verify the local Ollama service."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        response_time = time.perf_counter() - start_time

        # 5. Save to database
        with transaction.atomic():
            content_obj = GeneratedContent.objects.create(
                course_id=document.course_id,
                created_by=request.user,
                content_type=GeneratedContentType.FLASHCARD,
                title=f"AI Generated Flashcards for {document.title}",
                content=parsed_json
            )
            content_obj.source_documents.set([document])

        # 6. Response
        return Response({
            "cards": parsed_json.get("cards", []),
            "response_time": round(float(response_time), 4)
        }, status=status.HTTP_200_OK)


class VivaGenerateView(APIView):
    """
    POST /api/assistant/viva/generate/
    Generates structured viva prep questions from course documents context.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        serializer = VivaGenerateInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        course_id = serializer.validated_data["course_id"]
        document_ids = serializer.validated_data.get("document_ids", [])
        level = serializer.validated_data["level"]
        count = serializer.validated_data["count"]

        # 1. Permission checks
        user = request.user
        if user.is_student:
            if not Enrollment.objects.filter(student=user, course_id=course_id, is_active=True).exists():
                return Response(
                    {"detail": "You do not have permission to generate viva questions for this course."},
                    status=status.HTTP_403_FORBIDDEN
                )
        elif user.is_teacher:
            from apps.academic.models import Course
            if not Course.objects.filter(id=course_id, teacher=user).exists():
                return Response(
                    {"detail": "You do not teach this course."},
                    status=status.HTTP_403_FORBIDDEN
                )
        elif not user.is_admin:
            return Response(
                {"detail": "Forbidden."},
                status=status.HTTP_403_FORBIDDEN
            )

        # 2. Retrieve completed documents
        docs_qs = Document.objects.filter(course_id=course_id, processing_status="completed")
        if document_ids:
            docs_qs = docs_qs.filter(id__in=document_ids)
        docs = list(docs_qs)
        if not docs:
            return Response(
                {"detail": "No processed course documents found to generate content from."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 3. Retrieve chunks up to limit
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

        # 4. Prompt Assembly & Ollama Call
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

        llm_model = settings.OLLAMA_LLM_MODEL
        logger.info(f"Generating {count} {level} viva questions for course {course_id} using model {llm_model}")
        
        start_time = time.perf_counter()
        try:
            client = ollama.Client(host=settings.OLLAMA_BASE_URL)
            response = client.chat(
                model=llm_model,
                messages=[
                    {"role": "system", "content": system_instruction},
                    {"role": "user", "content": prompt}
                ],
                options={"temperature": 0.3},
                format="json",
            )
            content_str = response["message"]["content"].strip()

            if content_str.startswith("```"):
                lines = content_str.split("\n")
                if lines[0].startswith("```"):
                    lines = lines[1:]
                if lines and lines[-1].strip().startswith("```"):
                    lines = lines[:-1]
                content_str = "\n".join(lines).strip()

            from apps.core.ai import parse_llm_json
            parsed_json = parse_llm_json(content_str)
        except json.JSONDecodeError as je:
            logger.error(f"Failed to parse Viva JSON: {je}. Raw: {content_str}")
            return Response(
                {"detail": "The AI model generated an invalid format. Please try again."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        except Exception as e:
            logger.exception(f"Ollama Viva generation call failed: {e}")
            return Response(
                {"detail": "The AI service is currently unavailable. Please verify the local Ollama service."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        response_time = time.perf_counter() - start_time

        # 5. Save to database
        with transaction.atomic():
            content_obj = GeneratedContent.objects.create(
                course_id=course_id,
                created_by=request.user,
                content_type=GeneratedContentType.VIVA,
                title=f"AI Generated {level.capitalize()} Viva Prep",
                content=parsed_json
            )
            content_obj.source_documents.set(docs)

        # 6. Response
        return Response({
            "questions": parsed_json.get("questions", []),
            "level": level,
            "response_time": round(float(response_time), 4)
        }, status=status.HTTP_200_OK)


class ConceptExtractView(APIView):
    """
    POST /api/assistant/concept/extract/
    Extracts key concepts, definitions, formula references, keywords, and page references from a document.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        serializer = ConceptExtractInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        document_id = serializer.validated_data["document_id"]

        # 1. Fetch document
        try:
            document = Document.objects.select_related("course").get(id=document_id)
        except Document.DoesNotExist:
            return Response(
                {"detail": "Document not found."},
                status=status.HTTP_404_NOT_FOUND
            )

        # 2. Check permissions
        user = request.user
        if user.is_student:
            if not Enrollment.objects.filter(student=user, course=document.course, is_active=True).exists():
                return Response(
                    {"detail": "You do not have permission to access this document's course."},
                    status=status.HTTP_403_FORBIDDEN
                )
        elif user.is_teacher:
            if document.course.teacher != user:
                return Response(
                    {"detail": "You do not teach the course associated with this document."},
                    status=status.HTTP_403_FORBIDDEN
                )
        elif not user.is_admin:
            return Response(
                {"detail": "Forbidden."},
                status=status.HTTP_403_FORBIDDEN
            )

        # 3. Retrieve chunks
        chunks = DocumentChunk.objects.filter(document=document).order_by("chunk_index")
        if not chunks.exists():
            return Response(
                {"detail": "No content is available for this document to extract concepts from."},
                status=status.HTTP_400_BAD_REQUEST
            )

        context_text = "\n\n".join([f"[Page {c.page_number}] {c.content}" for c in chunks])

        # 4. Prompt Assembly & Ollama Call
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

        llm_model = settings.OLLAMA_LLM_MODEL
        logger.info(f"Extracting key concepts for document {document.id} using model {llm_model}")
        
        start_time = time.perf_counter()
        try:
            client = ollama.Client(host=settings.OLLAMA_BASE_URL)
            response = client.chat(
                model=llm_model,
                messages=[
                    {"role": "system", "content": system_instruction},
                    {"role": "user", "content": prompt}
                ],
                options={"temperature": 0.2},
                format="json",
            )
            content_str = response["message"]["content"].strip()

            if content_str.startswith("```"):
                lines = content_str.split("\n")
                if lines[0].startswith("```"):
                    lines = lines[1:]
                if lines and lines[-1].strip().startswith("```"):
                    lines = lines[:-1]
                content_str = "\n".join(lines).strip()

            from apps.core.ai import parse_llm_json
            parsed_json = parse_llm_json(content_str)
        except json.JSONDecodeError as je:
            logger.error(f"Failed to parse Concept JSON: {je}. Raw: {content_str}")
            return Response(
                {"detail": "The AI model generated an invalid format. Please try again."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        except Exception as e:
            logger.exception(f"Ollama Concept extraction call failed: {e}")
            return Response(
                {"detail": "The AI service is currently unavailable. Please verify the local Ollama service."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        response_time = time.perf_counter() - start_time

        # 5. Save to database under SUMMARY type
        with transaction.atomic():
            content_obj = GeneratedContent.objects.create(
                course_id=document.course_id,
                created_by=request.user,
                content_type=GeneratedContentType.SUMMARY,
                title=f"Key Concepts: {document.title}",
                content=parsed_json
            )
            content_obj.source_documents.set([document])

        # 6. Response
        return Response({
            "important_topics": parsed_json.get("important_topics", []),
            "definitions": parsed_json.get("definitions", []),
            "formula_references": parsed_json.get("formula_references", []),
            "keywords": parsed_json.get("keywords", []),
            "page_references": parsed_json.get("page_references", []),
            "response_time": round(float(response_time), 4)
        }, status=status.HTTP_200_OK)


class GlossaryGenerateView(APIView):
    """
    POST /api/assistant/glossary/generate/
    Generates a structured glossary (term, definition, example, page) from a document.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        serializer = GlossaryGenerateInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        document_id = serializer.validated_data["document_id"]

        # 1. Fetch document
        try:
            document = Document.objects.select_related("course").get(id=document_id)
        except Document.DoesNotExist:
            return Response(
                {"detail": "Document not found."},
                status=status.HTTP_404_NOT_FOUND
            )

        # 2. Check permissions
        user = request.user
        if user.is_student:
            if not Enrollment.objects.filter(student=user, course=document.course, is_active=True).exists():
                return Response(
                    {"detail": "You do not have permission to access this document's course."},
                    status=status.HTTP_403_FORBIDDEN
                )
        elif user.is_teacher:
            if document.course.teacher != user:
                return Response(
                    {"detail": "You do not teach the course associated with this document."},
                    status=status.HTTP_403_FORBIDDEN
                )
        elif not user.is_admin:
            return Response(
                {"detail": "Forbidden."},
                status=status.HTTP_403_FORBIDDEN
            )

        # 3. Retrieve chunks
        chunks = DocumentChunk.objects.filter(document=document).order_by("chunk_index")
        if not chunks.exists():
            return Response(
                {"detail": "No content is available for this document to generate a glossary from."},
                status=status.HTTP_400_BAD_REQUEST
            )

        context_text = "\n\n".join([f"[Page {c.page_number}] {c.content}" for c in chunks])

        # 4. Prompt Assembly & Ollama Call
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

        llm_model = settings.OLLAMA_LLM_MODEL
        logger.info(f"Generating glossary for document {document.id} using model {llm_model}")
        
        start_time = time.perf_counter()
        try:
            client = ollama.Client(host=settings.OLLAMA_BASE_URL)
            response = client.chat(
                model=llm_model,
                messages=[
                    {"role": "system", "content": system_instruction},
                    {"role": "user", "content": prompt}
                ],
                options={"temperature": 0.2},
                format="json",
            )
            content_str = response["message"]["content"].strip()

            if content_str.startswith("```"):
                lines = content_str.split("\n")
                if lines[0].startswith("```"):
                    lines = lines[1:]
                if lines and lines[-1].strip().startswith("```"):
                    lines = lines[:-1]
                content_str = "\n".join(lines).strip()

            from apps.core.ai import parse_llm_json
            parsed_json = parse_llm_json(content_str)
        except json.JSONDecodeError as je:
            logger.error(f"Failed to parse Glossary JSON: {je}. Raw: {content_str}")
            return Response(
                {"detail": "The AI model generated an invalid format. Please try again."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        except Exception as e:
            logger.exception(f"Ollama Glossary generation call failed: {e}")
            return Response(
                {"detail": "The AI service is currently unavailable. Please verify the local Ollama service."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        response_time = time.perf_counter() - start_time

        # 5. Save to database under SUMMARY type
        with transaction.atomic():
            content_obj = GeneratedContent.objects.create(
                course_id=document.course_id,
                created_by=request.user,
                content_type=GeneratedContentType.SUMMARY,
                title=f"Glossary: {document.title}",
                content=parsed_json
            )
            content_obj.source_documents.set([document])

        # 6. Response
        # 6. Response
        return Response({
            "glossary": parsed_json.get("glossary", []),
            "response_time": round(float(response_time), 4)
        }, status=status.HTTP_200_OK)


from django.db.models import Sum
from collections import Counter
import re


class LearningAnalyticsView(APIView):
    """
    GET /api/assistant/analytics/
    Retrieves learning analytics for a student.
    Can be filtered by course_id.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        user = request.user
        student = user
        student_id = request.query_params.get("student_id")
        course_id = request.query_params.get("course_id")

        # 1. Target student lookup with permission checks
        if student_id:
            if user.is_teacher or user.is_admin:
                from apps.accounts.models import User as AccountUser
                try:
                    student = AccountUser.objects.get(id=student_id, role="student")
                except (AccountUser.DoesNotExist, ValueError, DjangoValidationError):
                    return Response({"detail": "Student not found."}, status=status.HTTP_404_NOT_FOUND)
                if user.is_teacher and not Enrollment.objects.filter(
                    student=student, course__teacher=user, is_active=True
                ).exists():
                    return Response(
                        {"detail": "You can only view analytics for students in your courses."},
                        status=status.HTTP_403_FORBIDDEN,
                    )
            else:
                return Response(
                    {"detail": "You do not have permission to view other students' analytics."},
                    status=status.HTTP_403_FORBIDDEN
                )

        # 2. Scope filters for Chat messages
        from apps.chat.models import ChatMessage, ChatSession
        
        chat_sessions_qs = ChatSession.objects.filter(student=student)
        if course_id:
            chat_sessions_qs = chat_sessions_qs.filter(course_id=course_id)
        
        chat_sessions_ids = chat_sessions_qs.values_list("id", flat=True)

        # Questions asked:
        questions_asked = ChatMessage.objects.filter(session_id__in=chat_sessions_ids, role="user").count()

        # Time spent:
        # Sum response times from chat messages (role="assistant")
        chat_time = ChatMessage.objects.filter(session_id__in=chat_sessions_ids, role="assistant").aggregate(total=Sum("response_time"))["total"] or 0.0
        
        # Also sum response times from generated content if possible
        generated_qs = GeneratedContent.objects.filter(created_by=student)
        if course_id:
            generated_qs = generated_qs.filter(course_id=course_id)
        
        generated_time = 0.0
        for gc in generated_qs:
            if isinstance(gc.content, dict) and "response_time" in gc.content:
                try:
                    generated_time += float(gc.content["response_time"])
                except (ValueError, TypeError):
                    pass
        
        time_spent = round(chat_time + generated_time, 4)

        # Frequently asked topics:
        # Extract keywords/terms from user queries:
        user_queries = ChatMessage.objects.filter(session_id__in=chat_sessions_ids, role="user").values_list("content", flat=True)
        stopwords = {
            "what", "how", "why", "who", "when", "where", "which", "does", "this", "that", "with", "from",
            "then", "them", "their", "they", "your", "yours", "about", "there", "their", "would", "could", "should",
            "than", "then", "into", "some", "other", "under", "over", "after", "before", "each", "both"
        }
        
        word_counter = Counter()
        for query in user_queries:
            words = re.findall(r"\b\w{4,}\b", query.lower())
            filtered = [w for w in words if w not in stopwords]
            word_counter.update(filtered)
            
        frequently_asked_topics = [{"topic": topic, "count": count} for topic, count in word_counter.most_common(5)]

        # Most viewed documents:
        # Count occurrences of document titles/IDs cited in assistant chat responses
        assistant_messages = ChatMessage.objects.filter(session_id__in=chat_sessions_ids, role="assistant")
        doc_views = Counter()
        doc_titles = {}

        for msg in assistant_messages:
            citations = msg.citations or []
            if isinstance(citations, list):
                for cit in citations:
                    if isinstance(cit, dict):
                        doc_id = cit.get("document_id") or cit.get("id")
                        doc_title = cit.get("document_title") or cit.get("title")
                        if doc_id:
                            doc_views[str(doc_id)] += 1
                            if doc_title:
                                doc_titles[str(doc_id)] = doc_title

        # Also count source documents used in generated contents
        for gc in generated_qs:
            for doc in gc.source_documents.all():
                doc_id = str(doc.id)
                doc_views[doc_id] += 1
                doc_titles[doc_id] = doc.title

        most_viewed_documents = []
        for doc_id, views_count in doc_views.most_common(5):
            most_viewed_documents.append({
                "document_id": doc_id,
                "title": doc_titles.get(doc_id, "Unknown Document"),
                "views_count": views_count
            })

        # Most difficult concepts:
        # Profile keywords/topics from queries where confidence_score was low (< 0.6)
        low_conf_user_queries = []
        assistant_msgs_low_conf = ChatMessage.objects.filter(
            session_id__in=chat_sessions_ids,
            role="assistant",
            confidence_score__lt=0.6
        )
        for msg in assistant_msgs_low_conf:
            prev_user_msg = ChatMessage.objects.filter(
                session=msg.session,
                role="user",
                created_at__lt=msg.created_at
            ).order_by("-created_at").first()
            if prev_user_msg:
                low_conf_user_queries.append(prev_user_msg.content)

        diff_word_counter = Counter()
        for query in low_conf_user_queries:
            words = re.findall(r"\b\w{4,}\b", query.lower())
            filtered = [w for w in words if w not in stopwords]
            diff_word_counter.update(filtered)

        most_difficult_concepts = [{"concept": concept, "frequency": count} for concept, count in diff_word_counter.most_common(5)]

        return Response({
            "questions_asked": questions_asked,
            "time_spent": time_spent,
            "frequently_asked_topics": frequently_asked_topics,
            "most_viewed_documents": most_viewed_documents,
            "most_difficult_concepts": most_difficult_concepts
        }, status=status.HTTP_200_OK)


class AiAskView(APIView):
    """
    POST /api/v1/ai/ask/ — legacy single-question endpoint.

    Delegates to the grounded chat service (same access rules, citations and
    persistence as /api/chat/ask/). Body: {query|question, course_id?, session_id?}.
    """

    permission_classes = [IsAuthenticated]
    throttle_scope = "ai"

    def get_throttles(self):
        from rest_framework.throttling import ScopedRateThrottle

        return [ScopedRateThrottle()]

    def post(self, request, *args, **kwargs):
        from apps.chat.services import ask, serialize_answer

        question = (request.data.get("query") or request.data.get("question") or "").strip()
        if not question:
            return Response({"detail": "Query string is required."}, status=status.HTTP_400_BAD_REQUEST)
        session, msg = ask(
            request.user,
            question,
            course_id=request.data.get("course_id") or None,
            session_id=request.data.get("session_id") or None,
        )
        return Response(serialize_answer(session, msg))
