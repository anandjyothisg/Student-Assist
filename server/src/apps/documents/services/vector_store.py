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


class IndexMismatchError(RuntimeError):
    """The collection was built with a different embedding model than the one configured."""


def index_signature() -> dict:
    """What every vector in a course collection was produced with."""
    return {"embedding_model": settings.EMBEDDING_MODEL_NAME}


def check_signature(collection) -> None:
    """
    Refuse to mix embeddings from different models: a model change would
    otherwise make every search silently return nonsense or nothing.
    Collections created before signatures were recorded are accepted (and
    reported by `index_compatibility`); `index_documents --rebuild` re-signs them.
    """
    meta = collection.metadata or {}
    built_with = meta.get("embedding_model")
    if built_with and built_with != settings.EMBEDDING_MODEL_NAME:
        raise IndexMismatchError(
            f"Collection {collection.name} was built with {built_with}, but EMBEDDING_MODEL_NAME is "
            f"{settings.EMBEDDING_MODEL_NAME}. Run `manage.py index_documents --rebuild`."
        )


def get_course_collection(course_id: str) -> chromadb.Collection:
    """Retrieves or creates a course-specific collection (for writing)."""
    client = get_chroma_client()
    collection = client.get_or_create_collection(
        name=_get_collection_name(course_id),
        metadata={"hnsw:space": "cosine", **index_signature()},  # cosine distance for similarity scoring
    )
    check_signature(collection)
    return collection


def find_course_collection(course_id: str):
    """The course's collection if it exists (searching must not create empty ones)."""
    try:
        collection = get_chroma_client().get_collection(_get_collection_name(course_id))
    except Exception:
        return None
    check_signature(collection)
    return collection


def index_compatibility() -> dict:
    """Signature status of every course collection, for the health endpoint."""
    client = get_chroma_client()
    prefix = f"{settings.CHROMA_COLLECTION_PREFIX}_course_"
    out = {"matching": 0, "unsigned": 0, "mismatched": []}
    for col in client.list_collections():
        name = getattr(col, "name", str(col))
        if not name.startswith(prefix):
            continue
        meta = client.get_collection(name).metadata or {}
        built_with = meta.get("embedding_model")
        if not built_with:
            out["unsigned"] += 1
        elif built_with == settings.EMBEDDING_MODEL_NAME:
            out["matching"] += 1
        else:
            out["mismatched"].append({"collection": name, "embedding_model": built_with})
    return out


def upsert_document_chunks(
    course_id: str, 
    document_id: str, 
    chunks: list[dict], 
    embeddings: list[list[float]],
    extra_metadata: dict | None = None,
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
            **(extra_metadata or {}),
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
    """
    Deletes every vector of a document. Raises on failure: callers must know
    when stale content could still be retrieved.
    """
    collection = find_course_collection(course_id)
    if collection is None:
        return
    logger.info(f"Deleting all vector store chunks for document {document_id} inside course {course_id}")
    collection.delete(where={"document_id": str(document_id)})


def delete_course_collection(course_id: str) -> None:
    """Drop a course's whole collection (used when the course is deleted)."""
    try:
        get_chroma_client().delete_collection(_get_collection_name(course_id))
    except Exception as exc:
        if "does not exist" not in str(exc).lower():
            raise


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
    collection = find_course_collection(course_id)
    if collection is None:
        return []
    count = collection.count()
    if count == 0:
        return []

    try:
        results = collection.query(query_embeddings=[query_embedding], n_results=min(top_k, count))
    except Exception as exc:
        # Chroma 1.x can fail to open an HNSW segment that another process wrote but
        # hasn't flushed yet ("Nothing found on disk"). Course collections are small,
        # so fall back to an exact cosine search over the stored embeddings.
        logger.warning(f"HNSW query failed for course {course_id} ({exc}); using exact search.")
        return _exact_search(collection, query_embedding, top_k)

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


def _exact_search(collection, query_embedding: list[float], top_k: int) -> list[dict]:
    import numpy as np

    data = collection.get(include=["embeddings", "documents", "metadatas"])
    if not data["ids"]:
        return []
    matrix = np.asarray(data["embeddings"], dtype=np.float32)
    q = np.asarray(query_embedding, dtype=np.float32)
    norms = np.linalg.norm(matrix, axis=1) * (np.linalg.norm(q) or 1.0)
    sims = matrix @ q / np.where(norms == 0, 1.0, norms)
    order = np.argsort(-sims)[:top_k]
    return [
        {
            "id": data["ids"][i],
            "content": data["documents"][i],
            "metadata": data["metadatas"][i],
            "distance": float(1.0 - sims[i]),
        }
        for i in order
    ]


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



def search_courses(course_ids: list[str], query_embedding: list[float], top_k: int = 6) -> list[dict]:
    """Search several course collections and merge the results by similarity."""
    merged: list[dict] = []
    for cid in course_ids:
        for attempt in (1, 2):
            try:
                merged.extend(search_relevant_chunks(str(cid), query_embedding, top_k=top_k))
                break
            except IndexMismatchError as exc:
                logger.error(str(exc))
                break
            except Exception as exc:
                logger.warning(f"Vector search failed for course {cid} (attempt {attempt}): {exc}")
    merged.sort(key=lambda c: c["distance"])
    return merged


def collection_stats() -> dict:
    """Totals across every course collection (used by the health endpoint)."""
    client = get_chroma_client()
    prefix = f"{settings.CHROMA_COLLECTION_PREFIX}_course_"
    names = [getattr(c, "name", str(c)) for c in client.list_collections()]
    names = [n for n in names if n.startswith(prefix)]
    total = 0
    for n in names:
        try:
            total += client.get_collection(n).count()
        except Exception:
            pass
    return {"collections": len(names), "vectors": total}
