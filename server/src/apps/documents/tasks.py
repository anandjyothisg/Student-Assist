"""
SmartStudent AI — Document Processing Celery Task
"""

import logging
from celery import shared_task
from django.utils import timezone
from django.conf import settings
from django.db import transaction

logger = logging.getLogger("apps.documents")


@shared_task(
    bind=True,
    max_retries=3,
    default_retry_delay=60,
    name="documents.process_document",
)
def process_document(self, document_id: str) -> dict:
    """
    Celery task: processes an uploaded document through the RAG pipeline.
    
    1. Extract page-indexed text blocks (PyMuPDF / python-docx / python-pptx / txt)
    2. Segment text into overlapping chunks
    3. Generate vector embeddings using sentence-transformers
    4. Upsert chunks + embeddings into ChromaDB course collection
    5. Save DocumentChunk records to PostgreSQL
    6. Update Document and Job processing status to COMPLETED
    """
    from apps.documents.models import Document, DocumentChunk, DocumentStatus, ProcessingJob
    from apps.documents.services.extractor import extract_text_by_page
    from apps.documents.services.chunker import split_text_into_chunks as split_into_chunks
    from apps.documents.services.embedder import generate_embeddings
    from apps.documents.services.vector_store import upsert_document_chunks, delete_document_chunks

    try:
        document = Document.objects.select_related("course", "topic__unit").get(id=document_id)
    except Document.DoesNotExist:
        logger.error(f"[process_document] Document {document_id} not found.")
        return {"status": "error", "detail": "Document not found."}

    # Create or fetch the processing job
    job, _ = ProcessingJob.objects.get_or_create(document=document)

    try:
        # --- Mark as processing ---
        document.processing_status = DocumentStatus.PROCESSING
        document.save(update_fields=["processing_status", "updated_at"])

        job.status = DocumentStatus.PROCESSING
        job.celery_task_id = self.request.id or ""
        job.started_at = timezone.now()
        job.save(update_fields=["status", "celery_task_id", "started_at"])

        logger.info(
            f"[process_document] Started processing document «{document.title}» "
            f"(id={document_id}, type={document.file_type})"
        )

        # Step 1: Text extraction
        pages = extract_text_by_page(document.file.path, document.file_type)
        page_count = len(pages)
        if not any((p.get("text") or "").strip() for p in pages):
            raise ValueError(
                "No readable text was found in this file. Scanned PDFs need OCR before they can be indexed."
            )

        # Step 2: Chunking
        chunks = split_into_chunks(
            pages=pages,
            chunk_size=settings.RAG_CHUNK_SIZE,
            chunk_overlap=settings.RAG_CHUNK_OVERLAP
        )
        chunk_count = len(chunks)

        # Step 3: Embeddings Generation
        chunk_contents = [c["content"] for c in chunks]
        embeddings = generate_embeddings(chunk_contents)

        with transaction.atomic():
            # Step 4: Clear any stale chunks (in case of reprocessing) in PostgreSQL and Chroma
            DocumentChunk.objects.filter(document=document).delete()
            delete_document_chunks(document.course_id, document.id)

            # Step 5: Save chunks to PostgreSQL
            db_chunks = []
            for chunk in chunks:
                idx = chunk["chunk_index"]
                chroma_id = f"chunk_{document.id}_{idx}"
                
                db_chunks.append(DocumentChunk(
                    document=document,
                    chunk_index=idx,
                    content=chunk["content"],
                    page_number=chunk["page_number"],
                    chroma_id=chroma_id,
                    metadata={
                        "document_id": str(document.id),
                        "page_number": int(chunk["page_number"]),
                        "chunk_index": int(idx)
                    }
                ))
            DocumentChunk.objects.bulk_create(db_chunks)

            # Step 6: Upsert to ChromaDB
            topic = document.topic
            upsert_document_chunks(
                course_id=str(document.course_id),
                document_id=str(document.id),
                chunks=chunks,
                embeddings=embeddings,
                extra_metadata={
                    "course_code": document.course.code,
                    "subject_id": str(document.course.subject_id),
                    "document_title": document.title,
                    "topic": topic.title if topic else "",
                    "unit": topic.unit.title if topic else "",
                },
            )

            # --- Update status to completed ---
            document.page_count = page_count
            document.chunk_count = chunk_count
            document.processing_status = DocumentStatus.COMPLETED
            document.error_message = ""
            document.save(update_fields=[
                "page_count", 
                "chunk_count", 
                "processing_status", 
                "error_message", 
                "updated_at"
            ])

            job.status = DocumentStatus.COMPLETED
            job.completed_at = timezone.now()
            job.error_details = ""
            job.save(update_fields=["status", "completed_at", "error_details"])

        logger.info(
            f"[process_document] Document «{document.title}» processed successfully: "
            f"{page_count} pages, {chunk_count} chunks stored."
        )
        return {
            "status": "completed", 
            "document_id": document_id, 
            "pages": page_count, 
            "chunks": chunk_count
        }

    except Exception as exc:
        logger.exception(
            f"[process_document] Failed processing document {document_id}: {exc}"
        )

        # Update status to FAILED
        try:
            document.processing_status = DocumentStatus.FAILED
            document.error_message = str(exc)
            document.save(update_fields=["processing_status", "error_message", "updated_at"])

            job.status = DocumentStatus.FAILED
            job.error_details = str(exc)
            job.completed_at = timezone.now()
            job.save(update_fields=["status", "error_details", "completed_at"])
        except Exception as inner_exc:
            logger.error(f"[process_document] Could not update failure status: {inner_exc}")

        # In-process (eager) runs report the failure instead of blocking on retries.
        if self.request.is_eager:
            return {"status": "failed", "document_id": document_id, "error": str(exc)}
        # Retry with exponential back-off
        raise self.retry(exc=exc, countdown=60 * (self.request.retries + 1))
