"""
SmartStudent AI — Document Text Chunking Service

A small, dependency-free port of the recursive character splitter we used from
LangChain (same separators, same merge/overlap rules, separators kept at the
start of each piece). It produces identical chunks for the demo library, which
was verified before LangChain was removed (see tests/test_chunker.py), and
drops four packages with open advisories from the dependency tree.
"""

import logging
import re

logger = logging.getLogger("apps.documents")

DEFAULT_SEPARATORS = ["\n\n", "\n", " ", ""]


def _split_keep_start(text: str, separator: str) -> list[str]:
    """Split on a literal separator, keeping it at the start of the following piece."""
    if not separator:
        return [c for c in text if c != ""]
    parts = re.split(f"({re.escape(separator)})", text)
    pieces = [parts[i] + parts[i + 1] for i in range(1, len(parts), 2)]
    if len(parts) % 2 == 0:
        pieces += parts[-1:]
    pieces = [parts[0], *pieces]
    return [p for p in pieces if p != ""]


def _merge(splits: list[str], chunk_size: int, chunk_overlap: int) -> list[str]:
    """Greedily pack pieces into chunks of at most chunk_size, carrying chunk_overlap forward."""
    docs: list[str] = []
    current: list[str] = []
    total = 0
    for piece in splits:
        size = len(piece)
        if total + size > chunk_size:
            if current:
                joined = "".join(current).strip()
                if joined:
                    docs.append(joined)
                while total > chunk_overlap or (total + size > chunk_size and total > 0):
                    total -= len(current[0])
                    current = current[1:]
        current.append(piece)
        total += size
    joined = "".join(current).strip()
    if joined:
        docs.append(joined)
    return docs


def split_text(text: str, chunk_size: int, chunk_overlap: int, separators: list[str] | None = None) -> list[str]:
    separators = separators or DEFAULT_SEPARATORS
    separator = separators[-1]
    rest: list[str] = []
    for i, sep in enumerate(separators):
        if sep == "":
            separator = sep
            break
        if sep in text:
            separator = sep
            rest = separators[i + 1:]
            break

    chunks: list[str] = []
    good: list[str] = []
    for piece in _split_keep_start(text, separator):
        if len(piece) < chunk_size:
            good.append(piece)
            continue
        if good:
            chunks.extend(_merge(good, chunk_size, chunk_overlap))
            good = []
        if rest:
            chunks.extend(split_text(piece, chunk_size, chunk_overlap, rest))
        else:
            chunks.append(piece)
    if good:
        chunks.extend(_merge(good, chunk_size, chunk_overlap))
    return chunks


def split_into_chunks(
    pages: list[dict],
    chunk_size: int = 800,
    chunk_overlap: int = 150,
    document_id: str = None,
) -> list[dict]:
    """
    Split page-indexed text into overlapping chunks that never cross a page,
    so every chunk keeps an accurate page number for citations.

    Returns: [{"chunk_index": int, "content": str, "page_number": int, "document_id": str | None}]
    """
    chunks = []
    for page_data in pages:
        page_num = page_data.get("page", 1)
        text = (page_data.get("text") or "").strip()
        if not text:
            continue
        for content in split_text(text, chunk_size, chunk_overlap):
            chunks.append({
                "chunk_index": len(chunks),
                "content": content.strip(),
                "page_number": page_num,
                "document_id": document_id,
            })
    logger.info(f"Split text into {len(chunks)} chunks (size={chunk_size}, overlap={chunk_overlap}).")
    return chunks


# Alias for compatibility with previous import names
split_text_into_chunks = split_into_chunks
