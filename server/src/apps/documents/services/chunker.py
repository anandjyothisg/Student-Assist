"""
SmartStudent AI — Document Text Chunking Service (LangChain)
"""

import logging
from langchain_text_splitters import RecursiveCharacterTextSplitter

logger = logging.getLogger("apps.documents")


def split_into_chunks(
    pages: list[dict], 
    chunk_size: int = 800, 
    chunk_overlap: int = 150,
    document_id: str = None
) -> list[dict]:
    """
    Splits page-indexed text into smaller overlapping chunks using LangChain's
    RecursiveCharacterTextSplitter.
    
    Args:
        pages: list of dict [{"page": int, "text": str}]
        chunk_size: Target size of each chunk in characters.
        chunk_overlap: Overlap between consecutive chunks in characters.
        document_id: Optional UUID string of the document.
        
    Returns:
        list of dict: [
          {
            "chunk_index": int, 
            "content": str, 
            "page_number": int, 
            "document_id": str or None
          }
        ]
    """
    logger.info(f"Chunking with LangChain: size={chunk_size}, overlap={chunk_overlap}, document_id={document_id}")
    
    # Initialize the RecursiveCharacterTextSplitter from LangChain
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        length_function=len,
        separators=["\n\n", "\n", " ", ""]
    )
    
    chunks = []
    chunk_index = 0
    
    for page_data in pages:
        page_num = page_data.get("page", 1)
        text = page_data.get("text", "").strip()
        
        if not text:
            continue
            
        # Use LangChain to split the page text
        split_texts = splitter.split_text(text)
        
        for content in split_texts:
            chunks.append({
                "chunk_index": chunk_index,
                "content": content.strip(),
                "page_number": page_num,
                "document_id": document_id
            })
            chunk_index += 1
            
    logger.info(f"LangChain split text into {len(chunks)} chunks.")
    return chunks


# Alias for compatibility with previous import names if any
split_text_into_chunks = split_into_chunks
