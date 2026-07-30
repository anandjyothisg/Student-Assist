"""
SmartStudent AI — ChromaDB Vector Store Wrapper Service
"""

import logging
import chromadb
from django.conf import settings

logger = logging.getLogger("apps.documents")

_chroma_client = None


def get_chroma_client() -> chromadb.PersistentClient:
    """Initialises or retrieves the persistent ChromaDB client."""
    global _chroma_client
    if _chroma_client is None:
        path = settings.CHROMA_DB_PATH
        logger.info(f"Initialising persistent ChromaDB client at: {path}")
        _chroma_client = chromadb.PersistentClient(path=path)
    return _chroma_client


def _get_collection_name(course_id: str) -> str:
    """
    Format ChromaDB collection name correctly.
    Must be 3-63 characters, start/end with alphanumeric, only contain alphanumeric, _ or -.
    """
    cleaned_id = str(course_id).replace("-", "_")
    return f"{settings.CHROMA_COLLECTION_PREFIX}_course_{cleaned_id}"


def get_course_collection(course_id: str) -> chromadb.Collection:
    """Retrieves or creates a course-specific collection."""
    client = get_chroma_client()
    collection_name = _get_collection_name(course_id)
    
    # We use cosine distance space for similarity scoring
    return client.get_or_create_collection(
        name=collection_name,
        metadata={"hnsw:space": "cosine"}
    )


def upsert_document_chunks(
    course_id: str, 
    document_id: str, 
    chunks: list[dict], 
    embeddings: list[list[float]]
) -> None:
    """
    Upserts document chunks and their embeddings into the course collection.
    
    Args:
        course_id: Course UUID
        document_id: Document UUID
        chunks: list of dict [{"chunk_index": int, "content": str, "page_number": int}]
        embeddings: list of list of float (vectors)
    """
    if not chunks:
        logger.warning("No chunks to upsert to vector store.")
        return
        
    collection = get_course_collection(course_id)
    
    ids = []
    documents = []
    metadatas = []
    
    for chunk in chunks:
        chunk_idx = chunk["chunk_index"]
        chroma_id = f"chunk_{document_id}_{chunk_idx}"
        
        ids.append(chroma_id)
        documents.append(chunk["content"])
        metadatas.append({
            "document_id": str(document_id),
            "course_id": str(course_id),
            "page_number": int(chunk["page_number"]),
            "chunk_index": int(chunk_idx)
        })
        
    logger.info(f"Upserting {len(ids)} vectors for document {document_id} inside course {course_id}")
    collection.upsert(
        ids=ids,
        embeddings=embeddings,
        documents=documents,
        metadatas=metadatas
    )


def delete_document_chunks(course_id: str, document_id: str) -> None:
    """Deletes all chunks associated with a document from the course collection."""
    try:
        collection = get_course_collection(course_id)
        logger.info(f"Deleting all vector store chunks for document {document_id} inside course {course_id}")
        collection.delete(where={"document_id": str(document_id)})
    except Exception as e:
        logger.error(f"Error deleting chunks from ChromaDB: {e}")


def search_relevant_chunks(
    course_id: str, 
    query_embedding: list[float], 
    top_k: int = 5
) -> list[dict]:
    """
    Queries vector store for the top K most similar text chunks.
    
    Args:
        course_id: Course UUID
        query_embedding: list of float (vector)
        top_k: Number of results to return
        
    Returns:
        list of dict: [{"id": str, "content": str, "metadata": dict, "distance": float}]
    """
    collection = get_course_collection(course_id)
    
    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=top_k
    )
    
    formatted = []
    if not results or not results["ids"] or not results["ids"][0]:
        return formatted
        
    ids = results["ids"][0]
    documents = results["documents"][0]
    metadatas = results["metadatas"][0]
    distances = results["distances"][0]
    
    for i in range(len(ids)):
        formatted.append({
            "id": ids[i],
            "content": documents[i],
            "metadata": metadatas[i],
            "distance": float(distances[i])
        })
        
    return formatted


def reindex_document_chunks(
    course_id: str, 
    document_id: str, 
    chunks: list[dict], 
    embeddings: list[list[float]]
) -> None:
    """
    Atomically deletes old document chunks and inserts new ones.
    
    Args:
        course_id: Course UUID
        document_id: Document UUID
        chunks: list of dict [{"chunk_index": int, "content": str, "page_number": int}]
        embeddings: list of list of float
    """
    logger.info(f"Re-indexing document {document_id} inside course {course_id}")
    delete_document_chunks(course_id, document_id)
    upsert_document_chunks(course_id, document_id, chunks, embeddings)

