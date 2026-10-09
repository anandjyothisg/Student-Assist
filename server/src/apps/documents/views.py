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

from apps.core.utils import parse_uuid_param
from apps.core.pagination import StandardPagination
from apps.core.permissions import IsAdminOrTeacher
from apps.documents.models import Document, DocumentChunk, DocumentStatus
from apps.core.access import can_manage_course, readable_courses
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

    # Uploads and these actions run parsers / the embedder on the server.
    INDEXING_ACTIONS = {"create", "upload", "reprocess", "extract_pdf", "clean_text", "chunk_text", "reindex_vectors"}

    def get_throttles(self):
        self.throttle_scope = "indexing" if self.action in self.INDEXING_ACTIONS else None
        return super().get_throttles()
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

    def list(self, request: Request, *args, **kwargs) -> Response:
        # Teachers watch their uploads here: release jobs a restart interrupted.
        if request.user.is_admin or request.user.is_teacher:
            from apps.documents.tasks import sweep_stale_documents

            sweep_stale_documents(self.get_queryset())
        return super().list(request, *args, **kwargs)

    def get_queryset(self):
        user = self.request.user
        qs = Document.objects.select_related(
            "course", "course__subject", "uploaded_by", "processing_job", "topic", "topic__unit"
        )

        # Filtering based on role permissions
        if user.is_student:
            # Students: published courses they're enrolled in, current indexed version only.
            qs = qs.filter(
                course__in=readable_courses(user),
                processing_status=DocumentStatus.COMPLETED,
                is_latest=True,
            )
        elif user.is_teacher:
            # Teachers see documents from their own courses
            qs = qs.filter(course__teacher=user)
        elif not user.is_admin:
            qs = qs.none()

        # Versioning: managers may ask for superseded versions; everyone else sees the latest.
        manager = user.is_admin or user.is_teacher
        all_versions = self.request.query_params.get("all_versions", "").lower() == "true"
        if not (all_versions and manager):
            if manager:
                # Also show a new version that is still being indexed (or failed);
                # it replaces the live one only once indexing succeeds.
                qs = qs.filter(
                    models.Q(is_latest=True)
                    | models.Q(processing_status__in=[DocumentStatus.PENDING, DocumentStatus.PROCESSING, DocumentStatus.FAILED])
                )
            else:
                qs = qs.filter(is_latest=True)

        # Filter by course
        course_id = parse_uuid_param(self.request.query_params.get("course"), "course")
        if course_id:
            qs = qs.filter(course_id=course_id)

        topic_id = parse_uuid_param(self.request.query_params.get("topic"), "topic")
        if topic_id:
            qs = qs.filter(topic_id=topic_id)

        search = self.request.query_params.get("search")
        if search:
            qs = qs.filter(models.Q(title__icontains=search) | models.Q(description__icontains=search))

        # Filter by processing status
        proc_status = self.request.query_params.get("status")
        if proc_status:
            qs = qs.filter(processing_status=proc_status)

        return qs.order_by("-created_at")

    def create(self, request: Request, *args, **kwargs) -> Response:
        """Override create to return DocumentListSerializer after upload for frontend compatibility."""
        upload_serializer = DocumentUploadSerializer(
            data=request.data, context={"request": request}
        )
        upload_serializer.is_valid(raise_exception=True)
        self.perform_create(upload_serializer)
        document = upload_serializer.instance
        response_serializer = DocumentListSerializer(document, context={"request": request})
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)

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
        # Dispatch the Celery processing task. The document itself is already
        # saved at this point — a broker outage (e.g. Redis unreachable)
        # must not crash the upload response; the document simply stays in
        # its default PENDING status until reprocessed once the broker is
        # back (see the `reprocess` action below).
        from apps.documents.services.dispatch import dispatch_processing

        mode = dispatch_processing(document.id)
        logger.info(f"Processing for document {document.id} started via {mode}")

    def destroy(self, request: Request, *args, **kwargs) -> Response:
        from apps.documents.services.lifecycle import IndexCleanupError, delete_document

        document = self.get_object()
        doc_id = document.id
        try:
            delete_document(document)
        except IndexCleanupError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        logger.info(f"Document {doc_id} deleted by user {request.user.pk}")
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(
        detail=True,
        methods=["post"],
        permission_classes=[IsAuthenticated, IsDocumentAccessAllowed],
        url_path="reprocess",
    )
    def reprocess(self, request: Request, pk=None) -> Response:
        """POST /api/v1/documents/{id}/reprocess/ — retry failed documents."""
        from apps.documents.tasks import sweep_stale_documents

        document = self.get_object()
        if not can_manage_course(request.user, document.course):
            return Response({"detail": "Only the course's teacher can re-index it."}, status=status.HTTP_403_FORBIDDEN)
        # A job interrupted by a restart is stuck in PROCESSING; release it first.
        if sweep_stale_documents(Document.objects.filter(id=document.id)):
            document.refresh_from_db()
        if document.processing_status == DocumentStatus.PROCESSING:
            return Response(
                {"detail": "Document is currently being processed."},
                status=status.HTTP_409_CONFLICT,
            )

        document.processing_status = DocumentStatus.PENDING
        document.error_message = ""
        document.save(update_fields=["processing_status", "error_message", "updated_at"])

        from apps.documents.services.dispatch import dispatch_processing

        mode = dispatch_processing(document.id)
        return Response(
            {"detail": "Reprocessing started.", "mode": mode},
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
        if request.query_params.get("all") == "true":
            # The reader needs the whole document; cap defensively.
            return Response(DocumentChunkSerializer(qs[:5000], many=True).data)
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
        url_path="download",
    )
    def download(self, request: Request, pk=None):
        """GET /api/v1/documents/{id}/download/ — the original file, permission-checked."""
        import mimetypes
        import os

        from django.http import FileResponse, Http404

        document = self.get_object()
        if not document.file or not os.path.exists(document.file.path):
            raise Http404("The original file is missing from storage.")
        ext = os.path.splitext(document.file.name)[1]
        safe_title = "".join(ch for ch in document.title if ch.isalnum() or ch in " -_.").strip() or "document"
        content_type = mimetypes.guess_type(document.file.name)[0] or "application/octet-stream"
        inline = request.query_params.get("inline") == "true" and content_type == "application/pdf"
        return FileResponse(
            open(document.file.path, "rb"),
            as_attachment=not inline,
            filename=f"{safe_title}{ext}",
            content_type=content_type,
        )

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
                {"detail": f"Failed to extract text from PDF. The details were logged; please try again."},
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
                {"detail": f"Failed to clean text. The details were logged; please try again."},
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
                {"detail": f"Failed to split text. The details were logged; please try again."},
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
                {"detail": f"Failed to re-index document. The details were logged; please try again."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )




