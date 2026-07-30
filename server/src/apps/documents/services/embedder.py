"""
SmartStudent AI — Sentence Embedding Service
"""

import logging
from sentence_transformers import SentenceTransformer
from django.conf import settings

logger = logging.getLogger("apps.documents")

_model_instance = None


def get_embedding_model() -> SentenceTransformer:
    """Retrieves or initialises the singleton SentenceTransformer instance."""
    global _model_instance
    if _model_instance is None:
        model_name = settings.EMBEDDING_MODEL_NAME
        logger.info(f"Loading SentenceTransformer model: {model_name}")
        _model_instance = SentenceTransformer(model_name)
        logger.info("SentenceTransformer model loaded successfully.")
    return _model_instance


def generate_embeddings(texts: list[str]) -> list[list[float]]:
    """
    Generates embeddings for a list of text strings.
    
    Args:
        texts: list of str
        
    Returns:
        list of list of float
    """
    if not texts:
        return []
    
    model = get_embedding_model()
    embeddings = model.encode(texts, show_progress_bar=False)
    
    # Convert numpy output to standard Python float lists
    if hasattr(embeddings, "tolist"):
        return embeddings.tolist()
    return [list(map(float, emb)) for emb in embeddings]


def generate_query_embedding(query: str) -> list[float]:
    """
    Generates an embedding vector for a single query string.
    
    Args:
        query: str
        
    Returns:
        list of float
    """
    model = get_embedding_model()
    embedding = model.encode(query, show_progress_bar=False)
    
    if hasattr(embedding, "tolist"):
        return embedding.tolist()
    return list(map(float, embedding))
