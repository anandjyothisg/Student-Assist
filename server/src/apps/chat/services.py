import time
import logging
import ollama
from django.conf import settings
from django.db import transaction

from apps.documents.models import Document
from apps.documents.services.embedder import generate_query_embedding
from apps.documents.services.vector_store import search_relevant_chunks
from .models import ChatSession, ChatMessage

logger = logging.getLogger("apps.chat")


def run_chat_rag_query(session: ChatSession, question: str) -> ChatMessage:
    """
    Executes the conversational RAG pipeline specifically for ChatSession:
    1. Embeds user's question.
    2. Searches ChromaDB for course study material.
    3. Prompts Ollama local LLM with conversation history.
    4. Saves user and assistant messages to database.
    5. Returns the generated assistant ChatMessage instance.
    """
    logger.info(f"Running RAG chat query for session {session.id}")
    start_time = time.perf_counter()

    # 1. Embed query
    query_vector = generate_query_embedding(question)

    # 2. Retrieve semantic context from vector store
    top_k = settings.RAG_TOP_K_RESULTS
    raw_chunks = search_relevant_chunks(
        course_id=str(session.course_id),
        query_embedding=query_vector,
        top_k=top_k
    )

    # Filter chunks based on distance threshold
    max_distance_threshold = 0.85
    filtered_chunks = [c for c in raw_chunks if c["distance"] <= max_distance_threshold]

    context_blocks = []
    citations = []
    confidence_scores = []

    # Fetch document objects to get titles
    doc_ids = {c["metadata"]["document_id"] for c in filtered_chunks}
    docs_map = {str(d.id): d for d in Document.objects.filter(id__in=doc_ids)}

    for c in filtered_chunks:
        doc_id = c["metadata"]["document_id"]
        page_num = c["metadata"].get("page_number", 1)
        doc_obj = docs_map.get(doc_id)
        doc_title = doc_obj.title if doc_obj else "Unknown Document"

        context_blocks.append(
            f"--- SOURCE: \"{doc_title}\", Page: {page_num} ---\n"
            f"{c['content']}"
        )
        sim = max(0.0, min(1.0, 1.0 - c["distance"]))
        confidence_scores.append(sim)

        citations.append({
            "page_number": int(page_num),
            "chunk_id": str(c["id"]),
            "document_title": str(doc_title),
            "confidence_score": round(float(sim), 4),
            "excerpt": c["content"][:400]
        })

    context_text = "\n\n".join(context_blocks)
    overall_confidence = max(confidence_scores) if confidence_scores else 0.0
    no_context = len(filtered_chunks) == 0

    # 3. Assemble Prompt & Conversational History
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

    # Include chat history (last 6 messages)
    history_messages = session.messages.order_by("-created_at")[:6]
    history_messages = list(reversed(history_messages))

    for hist in history_messages:
        messages_payload.append({
            "role": "user" if hist.role == "user" else "assistant",
            "content": hist.content
        })

    # Add the current query with context
    prompt_content = f"CONTEXT:\n{context_text}\n\nSTUDENT QUESTION: {question}"
    messages_payload.append({
        "role": "user",
        "content": prompt_content
    })

    # 4. Invoke LLM via Ollama
    llm_model = settings.OLLAMA_LLM_MODEL
    logger.info(f"Sending prompt to Ollama model {llm_model} for session {session.id}")

    try:
        if no_context:
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

            if not assistant_response or len(assistant_response.strip()) == 0:
                assistant_response = (
                    "I'm sorry, but I couldn't find the answer to your question in the uploaded course materials."
                )
    except Exception as e:
        logger.exception(f"Ollama RAG execution failed: {e}")
        assistant_response = (
            "⚠️ The AI Assistant is temporarily unavailable. "
            "Please check that local Ollama service is running on the host."
        )

    end_time = time.perf_counter()
    response_time = end_time - start_time

    # 5. Database Save Turn
    with transaction.atomic():
        # Save user message
        ChatMessage.objects.create(
            session=session,
            role="user",
            content=question,
        )

        # Save assistant message
        assistant_msg = ChatMessage.objects.create(
            session=session,
            role="assistant",
            content=assistant_response,
            confidence_score=round(float(overall_confidence), 4),
            response_time=round(float(response_time), 4),
            citations=citations
        )

    return assistant_msg
