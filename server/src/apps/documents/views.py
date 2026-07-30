"""
SmartStudent AI — Document Views
"""

import logging

from django.db import models, transaction
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet
from rest_framework.exceptions import PermissionDenied

from apps.core.pagination import StandardPagination
from apps.core.permissions import IsAdminOrTeacher
from apps.documents.models import Document, DocumentChunk, DocumentStatus
from apps.documents.permissions import IsDocumentAccessAllowed
from apps.documents.serializers import (
    DocumentChunkSerializer,
    DocumentDetailSerializer,
    DocumentListSerializer,
    DocumentUploadSerializer,
    DocumentVersionHistorySerializer,
)

logger = logging.getLogger("apps.documents")


class DocumentViewSet(ModelViewSet):
    """
    Document management endpoints.

    - List / Retrieve: authenticated users (students see only their enrolled courses' docs)
    - Upload (create): teachers and admins
    - Delete: uploader or course teacher or admin
    - reprocess: admin action to retry failed documents
    - history: view version history of a document
    """

    pagination_class = StandardPagination
    permission_classes = [IsAuthenticated, IsDocumentAccessAllowed]
    http_method_names = ["get", "post", "delete", "head", "options"]

    def get_permissions(self):
        if self.action in ("create",):
            return [IsAuthenticated(), IsAdminOrTeacher()]
        return [IsAuthenticated(), IsDocumentAccessAllowed()]

    def get_serializer_class(self):
        if self.action == "create":
            return DocumentUploadSerializer
        if self.action == "list":
            return DocumentListSerializer
        return DocumentDetailSerializer

    def get_queryset(self):
        user = self.request.user
        qs = Document.objects.select_related(
            "course", "course__subject", "uploaded_by", "processing_job"
        )

        # Filtering based on role permissions
        if user.is_student:
            # Students see only documents from courses they are enrolled in
            enrolled_course_ids = user.enrollments.filter(is_active=True).values_list(
                "course_id", flat=True
            )
            qs = qs.filter(course_id__in=enrolled_course_ids, processing_status=DocumentStatus.COMPLETED)
        elif user.is_teacher:
            # Teachers see documents from their own courses
            qs = qs.filter(course__teacher=user)

        # Versioning: default to showing only latest versions
        all_versions = self.request.query_params.get("all_versions")
        if not all_versions or all_versions.lower() != "true":
            qs = qs.filter(is_latest=True)

        # Filter by course
        course_id = self.request.query_params.get("course")
        if course_id:
            qs = qs.filter(course_id=course_id)

        # Filter by processing status
        proc_status = self.request.query_params.get("status")
        if proc_status:
            qs = qs.filter(processing_status=proc_status)

        return qs.order_by("-created_at")

    def perform_create(self, serializer: DocumentUploadSerializer) -> None:
        course = serializer.validated_data.get("course")
        user = self.request.user

        # Ensure teacher can only upload to their own courses
        if not user.is_admin and course.teacher != user:
            raise PermissionDenied("You can only upload documents to courses you teach.")

        document = serializer.save(uploaded_by=self.request.user)
        logger.info(
            f"Document «{document.title}» uploaded by {self.request.user.email} "
            f"for course {document.course.code}"
        )
        # Dispatch the Celery processing task
        from apps.documents.tasks import process_document
        task = process_document.delay(str(document.id))
        logger.info(f"Processing task dispatched: task_id={task.id}")

    def destroy(self, request: Request, *args, **kwargs) -> Response:
        document = self.get_object()
        doc_id = document.id
        course_id = document.course.id

        # Delete from ChromaDB
        from apps.documents.services.vector_store import delete_document_chunks
        try:
            delete_document_chunks(str(course_id), str(doc_id))
        except Exception as e:
            logger.error(f"Failed to delete ChromaDB vectors for document {doc_id}: {e}")

        with transaction.atomic():
            was_latest = document.is_latest
            parent = document.parent

            self.perform_destroy(document)

            # If the deleted document was the latest version, promote the next highest version
            if was_latest:
                if parent:
                    # Find other versions that point to this parent
                    remaining = Document.objects.filter(parent=parent).order_by("-version")
                    if remaining.exists():
                        latest_rem = remaining.first()
                        latest_rem.is_latest = True
                        latest_rem.save(update_fields=["is_latest"])
                    else:
                        # Only root parent remains. Promote root parent.
                        parent.is_latest = True
                        parent.save(update_fields=["is_latest"])
                else:
                    # The deleted document was the root parent.
                    # Find all children pointing to it and promote the oldest one to be the new root parent.
                    remaining = Document.objects.filter(parent_id=doc_id).order_by("version")
                    if remaining.exists():
                        new_root = remaining.first()
                        new_root.parent = None
                        new_root.save(update_fields=["parent"])

                        # Re-parent all other children to the new root
                        Document.objects.filter(parent_id=doc_id).update(parent=new_root)

                        # Find the highest version among all remaining, make it latest
                        all_rem = Document.objects.filter(parent=new_root)
                        if all_rem.exists():
                            latest_rem = all_rem.order_by("-version").first()
                            latest_rem.is_latest = True
                            latest_rem.save(update_fields=["is_latest"])
                        else:
                            new_root.is_latest = True
                            new_root.save(update_fields=["is_latest"])

        logger.info(f"Document {doc_id} deleted by {request.user.email}")
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(
        detail=True,
        methods=["post"],
        permission_classes=[IsAuthenticated, IsDocumentAccessAllowed],
        url_path="reprocess",
    )
    def reprocess(self, request: Request, pk=None) -> Response:
        """POST /api/v1/documents/{id}/reprocess/ — retry failed documents."""
        document = self.get_object()
        if document.processing_status == DocumentStatus.PROCESSING:
            return Response(
                {"detail": "Document is currently being processed."},
                status=status.HTTP_409_CONFLICT,
            )

        document.processing_status = DocumentStatus.PENDING
        document.error_message = ""
        document.save(update_fields=["processing_status", "error_message", "updated_at"])

        from apps.documents.tasks import process_document
        task = process_document.delay(str(document.id))
        logger.info(f"Reprocessing task dispatched for {document.id}: task_id={task.id}")

        return Response(
            {"detail": "Reprocessing started.", "task_id": task.id},
            status=status.HTTP_202_ACCEPTED,
        )

    @action(
        detail=True,
        methods=["get"],
        permission_classes=[IsAuthenticated, IsDocumentAccessAllowed],
        url_path="chunks",
    )
    def chunks(self, request: Request, pk=None) -> Response:
        """GET /api/v1/documents/{id}/chunks/ — inspect extracted chunks."""
        document = self.get_object()
        qs = DocumentChunk.objects.filter(document=document).order_by("chunk_index")
        page = self.paginate_queryset(qs)
        if page is not None:
            serializer = DocumentChunkSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = DocumentChunkSerializer(qs, many=True)
        return Response(serializer.data)

    @action(
        detail=True,
        methods=["get"],
        permission_classes=[IsAuthenticated, IsDocumentAccessAllowed],
        url_path="history",
    )
    def history(self, request: Request, pk=None) -> Response:
        """GET /api/v1/documents/{id}/history/ — get version history."""
        document = self.get_object()
        root = document.parent if document.parent else document

        # Fetch all versions in this document family
        qs = Document.objects.filter(
            models.Q(id=root.id) | models.Q(parent=root)
        ).order_by("-version")

        page = self.paginate_queryset(qs)
        if page is not None:
            serializer = DocumentVersionHistorySerializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = DocumentVersionHistorySerializer(qs, many=True)
        return Response(serializer.data)

    @action(
        detail=False,
        methods=["post"],
        permission_classes=[IsAuthenticated, IsAdminOrTeacher],
        url_path="extract",
    )
    def extract_pdf(self, request: Request) -> Response:
        """
        POST /api/v1/documents/extract/
        
        Accepts a PDF file upload in form-data ('file') and extracts raw text
        page-by-page using PyMuPDF, returning structured JSON directly.
        Does not clean, chunk, generate embeddings, or persist to database.
        """
        uploaded_file = request.FILES.get("file")
        if not uploaded_file:
            return Response(
                {"detail": "No file uploaded. Please send a PDF file under the key 'file'."},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not uploaded_file.name.lower().endswith(".pdf"):
            return Response(
                {"detail": "Only PDF files are supported for raw text extraction."},
                status=status.HTTP_400_BAD_REQUEST
            )

        import os
        import tempfile
        import fitz
        from django.conf import settings

        # Ensure tmp dir exists in workspace
        tmp_dir = settings.BASE_DIR / "tmp"
        tmp_dir.mkdir(exist_ok=True)

        temp_pdf_path = None
        try:
            # Write stream to NamedTemporaryFile
            with tempfile.NamedTemporaryFile(dir=tmp_dir, suffix=".pdf", delete=False) as temp_pdf:
                for chunk in uploaded_file.chunks():
                    temp_pdf.write(chunk)
                temp_pdf_path = temp_pdf.name

            # Open with PyMuPDF and extract page-indexed text
            pages_data = []
            with fitz.open(temp_pdf_path) as doc:
                for idx, page in enumerate(doc):
                    pages_data.append({
                        "page": idx + 1,
                        "text": page.get_text()  # Raw text extraction, no cleaning/chunking
                    })

            return Response(pages_data, status=status.HTTP_200_OK)

        except Exception as e:
            logger.exception(f"Direct text extraction failed: {e}")
            return Response(
                {"detail": f"Failed to extract text from PDF: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        finally:
            # Clean up temp file safely
            if temp_pdf_path and os.path.exists(temp_pdf_path):
                try:
                    os.remove(temp_pdf_path)
                except Exception:
                    pass

    @action(
        detail=False,
        methods=["post"],
        permission_classes=[IsAuthenticated, IsAdminOrTeacher],
        url_path="clean",
    )
    def clean_text(self, request: Request) -> Response:
        """
        POST /api/v1/documents/clean/
        
        Accepts a JSON payload containing raw pages:
        [
          {"page": 1, "text": "Raw text..."},
          ...
        ]
        Cleans the pages (removes headers, footers, page numbers, normalize spacing, reassemble paragraphs)
        and returns the structured cleaned paragraphs JSON list.
        """
        pages_data = request.data
        if not isinstance(pages_data, list):
            return Response(
                {"detail": "Request body must be a JSON list of pages: [{'page': int, 'text': str}]."},
                status=status.HTTP_400_BAD_REQUEST
            )
            
        # Verify schema
        for item in pages_data:
            if not isinstance(item, dict) or "page" not in item or "text" not in item:
                return Response(
                    {"detail": "Each item in the list must contain 'page' (int) and 'text' (str) keys."},
                    status=status.HTTP_400_BAD_REQUEST
                )
                
        from apps.documents.services.cleaner import clean_pages
        try:
            cleaned = clean_pages(pages_data)
            return Response(cleaned, status=status.HTTP_200_OK)
        except Exception as e:
            return Response(
                {"detail": f"Failed to clean text: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(
        detail=False,
        methods=["post"],
        permission_classes=[IsAuthenticated, IsAdminOrTeacher],
        url_path="chunk",
    )
    def chunk_text(self, request: Request) -> Response:
        """
        POST /api/v1/documents/chunk/
        
        Accepts a JSON payload:
        {
          "document_id": "<uuid>",
          "pages": [
            {"page": 1, "text": "Page content..."}
          ],
          "chunk_size": 800,
          "chunk_overlap": 150
        }
        Splits the text pages using LangChain's RecursiveCharacterTextSplitter and returns the chunks.
        """
        data = request.data
        if not isinstance(data, dict):
            return Response(
                {"detail": "Request body must be a JSON object."},
                status=status.HTTP_400_BAD_REQUEST
            )
            
        pages_data = data.get("pages")
        if not isinstance(pages_data, list):
            return Response(
                {"detail": "Parameter 'pages' must be a JSON list of pages: [{'page': int, 'text': str}]."},
                status=status.HTTP_400_BAD_REQUEST
            )
            
        # Verify schema
        for item in pages_data:
            if not isinstance(item, dict) or "page" not in item or "text" not in item:
                return Response(
                    {"detail": "Each page item in the list must contain 'page' (int) and 'text' (str) keys."},
                    status=status.HTTP_400_BAD_REQUEST
                )
                
        document_id = data.get("document_id")
        chunk_size = data.get("chunk_size", 800)
        chunk_overlap = data.get("chunk_overlap", 150)
        
        try:
            chunk_size = int(chunk_size)
            chunk_overlap = int(chunk_overlap)
        except (ValueError, TypeError):
            return Response(
                {"detail": "Parameters 'chunk_size' and 'chunk_overlap' must be integers."},
                status=status.HTTP_400_BAD_REQUEST
            )
            
        from apps.documents.services.chunker import split_into_chunks
        try:
            chunks = split_into_chunks(
                pages=pages_data,
                chunk_size=chunk_size,
                chunk_overlap=chunk_overlap,
                document_id=document_id
            )
            return Response(chunks, status=status.HTTP_200_OK)
        except Exception as e:
            return Response(
                {"detail": f"Failed to split text: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(
        detail=True,
        methods=["post"],
        permission_classes=[IsAuthenticated, IsAdminOrTeacher],
        url_path="reindex",
    )
    def reindex_vectors(self, request: Request, pk=None) -> Response:
        """
        POST /api/v1/documents/{id}/reindex/
        
        Manually re-indexes a document:
        - Extracts text chunks from PostgreSQL.
        - Generates embeddings via sentence-transformers.
        - Re-indexes (deletes old vectors and updates new vectors) in ChromaDB.
        """
        document = self.get_object()
        
        # Get chunks from database
        chunks_qs = DocumentChunk.objects.filter(document=document).order_by("chunk_index")
        if not chunks_qs.exists():
            return Response(
                {"detail": "No chunks found in PostgreSQL for this document. Process it first."},
                status=status.HTTP_400_BAD_REQUEST
            )
            
        chunks_data = []
        texts = []
        for chunk in chunks_qs:
            chunks_data.append({
                "chunk_index": chunk.chunk_index,
                "content": chunk.content,
                "page_number": chunk.page_number
            })
            texts.append(chunk.content)
            
        from apps.documents.services.embedder import generate_embeddings
        from apps.documents.services.vector_store import reindex_document_chunks
        
        try:
            embeddings = generate_embeddings(texts)
            reindex_document_chunks(
                course_id=str(document.course_id),
                document_id=str(document.id),
                chunks=chunks_data,
                embeddings=embeddings
            )
            return Response({"detail": "Document successfully re-indexed in ChromaDB."}, status=status.HTTP_200_OK)
        except Exception as e:
            logger.exception(f"Re-indexing failed: {e}")
            return Response(
                {"detail": f"Failed to re-index document: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )




