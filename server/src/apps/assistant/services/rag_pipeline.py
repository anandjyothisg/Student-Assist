"""
SmartStudent AI — RAG Search & Inference Service
"""

import logging
import ollama
from django.conf import settings
from django.db import transaction

from apps.assistant.models import Conversation, Message, MessageRole, Citation
from apps.documents.models import DocumentChunk, Document
from apps.documents.services.embedder import generate_query_embedding
from apps.documents.services.vector_store import search_relevant_chunks

logger = logging.getLogger("apps.assistant")


def run_rag_query(conversation: Conversation, question: str) -> Message:
    """
    Executes the full RAG pipeline:
    1. Embeds user's question
    2. Searches ChromaDB for course context
    3. Prompts Ollama local model using strict context-only constraints
    4. Saves user and assistant messages to PostgreSQL
    5. Saves Citations to database for transparency
    """
    logger.info(f"Running RAG query for conversation {conversation.id}")
    
    # 1. Embed query
    query_vector = generate_query_embedding(question)
    
    # 2. Retrieve semantic context from vector store
    top_k = settings.RAG_TOP_K_RESULTS
    raw_chunks = search_relevant_chunks(
        course_id=str(conversation.course_id),
        query_embedding=query_vector,
        top_k=top_k
    )
    
    # Define a distance threshold to avoid parsing completely unrelated chunks
    # (In cosine space, distance 0.0 = perfect match, 1.0 = orthogonal.
    # We ignore matches with distance > 0.85, i.e., similarity < 0.15)
    max_distance_threshold = 0.85
    filtered_chunks = [c for c in raw_chunks if c["distance"] <= max_distance_threshold]
    
    context_blocks = []
    citations_data = []
    
    # Pre-fetch Document details for titles in context
    doc_ids = {c["metadata"]["document_id"] for c in filtered_chunks}
    # Only current, fully indexed versions may be used as context.
    docs_map = {
        str(d.id): d
        for d in Document.objects.filter(id__in=doc_ids, is_latest=True, processing_status="completed")
    }
    filtered_chunks = [c for c in filtered_chunks if c["metadata"]["document_id"] in docs_map]
    
    for c in filtered_chunks:
        doc_id = c["metadata"]["document_id"]
        page_num = c["metadata"].get("page_number", 1)
        doc_obj = docs_map.get(doc_id)
        doc_title = doc_obj.title if doc_obj else "Unknown Document"
        
        context_blocks.append(
            f"--- SOURCE: \"{doc_title}\", Page: {page_num} ---\n"
            f"{c['content']}"
        )
        citations_data.append({
            "document_id": doc_id,
            "chroma_id": c["id"],
            "relevance_score": max(0.0, min(1.0, 1.0 - c["distance"])), # Cosine similarity
            "excerpt": c["content"],
            "page_number": page_num
        })
        
    context_text = "\n\n".join(context_blocks)
    
    # Fallback answer flag
    no_context = len(filtered_chunks) == 0
    
    # 3. Assemble Ollama payload
    system_instruction = (
        "You are 'SmartStudent AI', a helpful, precise academic tutoring assistant.\n"
        "Your goal is to answer the student's question using ONLY the provided course context.\n\n"
        "Rules:\n"
        "1. Answer the question comprehensively and clearly.\n"
        "2. Refer ONLY to the provided context. Do NOT use any general knowledge, outside facts, "
        "or assume facts not explicitly mentioned in the context.\n"
        "3. If the context does not contain enough information to answer the question, or if no context is provided, "
        "you MUST reply exactly with: \"I'm sorry, but I couldn't find the answer to your question in the uploaded course materials.\"\n"
        "4. Keep your answer professional, academic, and well-structured. Output clear paragraphs or bullet points."
    )
    
    messages_payload = [
        {"role": "system", "content": system_instruction}
    ]
    
    # Include conversational history (last 6 messages)
    history_messages = conversation.messages.order_by("-created_at")[:6]
    history_messages = list(reversed(history_messages))
    
    for hist in history_messages:
        messages_payload.append({
            "role": "user" if hist.role == MessageRole.USER else "assistant",
            "content": hist.content
        })
        
    # Append the context + current question
    prompt_content = f"CONTEXT:\n{context_text}\n\nSTUDENT QUESTION: {question}"
    messages_payload.append({
        "role": "user",
        "content": prompt_content
    })
    
    # 4. Invoke Ollama model
    llm_model = settings.OLLAMA_LLM_MODEL
    logger.info(f"Sending prompt to Ollama LLM model: {llm_model}")
    
    try:
        if no_context:
            # Short-circuit if no relevant context was found
            assistant_response = (
                "I'm sorry, but I couldn't find the answer to your question in the uploaded course materials."
            )
        else:
            client = ollama.Client(host=settings.OLLAMA_BASE_URL)
            response = client.chat(
                model=llm_model,
                messages=messages_payload
            )
            assistant_response = response["message"]["content"]
            
            # Post-process model output if it hallucinated when it shouldn't have
            if not assistant_response or len(assistant_response.strip()) == 0:
                assistant_response = (
                    "I'm sorry, but I couldn't find the answer to your question in the uploaded course materials."
                )
    except Exception as e:
        logger.error(f"Error calling Ollama service: {e}")
        # Standard user-friendly error response so the server doesn't crash
        assistant_response = (
            "⚠️ The AI Assistant is temporarily unavailable. "
            "Please check that local Ollama service is running on the host."
        )
        
    # 5. Save user & assistant messages and citations to DB in a transaction
    with transaction.atomic():
        # Create assistant response message
        assistant_msg = Message.objects.create(
            conversation=conversation,
            role=MessageRole.ASSISTANT,
            content=assistant_response,
            model_used=llm_model if not no_context else ""
        )
        
        # Save citations
        if not no_context and assistant_response.strip() != "I'm sorry, but I couldn't find the answer to your question in the uploaded course materials.":
            # Map chroma_ids to actual DocumentChunk objects
            chroma_ids = [c["chroma_id"] for c in citations_data]
            chunks_map = {
                chunk.chroma_id: chunk 
                for chunk in DocumentChunk.objects.filter(chroma_id__in=chroma_ids)
            }
            
            db_citations = []
            for citation in citations_data:
                chunk_obj = chunks_map.get(citation["chroma_id"])
                
                db_citations.append(Citation(
                    message=assistant_msg,
                    document_id=citation["document_id"],
                    chunk=chunk_obj,
                    relevance_score=citation["relevance_score"],
                    excerpt=citation["excerpt"][:400],
                    page_number=citation["page_number"]
                ))
            if db_citations:
                Citation.objects.bulk_create(db_citations)
                
    return assistant_msg


def build_rag_prompt(chunks: list[str], question: str) -> str:
    """
    Builds context-constrained RAG prompt from retrieved chunks and user question.
    Strictly answers from context or falls back to 'I couldn't find this information in the uploaded study material.'
    """
    if not chunks:
        return (
            "Context: No study materials are available.\n\n"
            "Question: " + question + "\n\n"
            "Answer: I couldn't find this information in the uploaded study material."
        )

    context_text = "\n\n".join([f"--- Context Block ---\n{chunk}" for chunk in chunks])

    prompt = (
        "You are 'SmartStudent AI', a helpful tutoring assistant. Answer the student's question "
        "using ONLY the provided contexts below. Do not use outside facts or make assumptions.\n"
        "If the answer cannot be found in the provided contexts, respond EXACTLY with: "
        "\"I couldn't find this information in the uploaded study material.\"\n\n"
        "Contexts:\n"
        f"{context_text}\n\n"
        f"Question: {question}\n\n"
        "Answer:"
    )
    return prompt

