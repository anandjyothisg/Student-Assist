"""
SmartStudent AI — Document Text Extraction Service

Every extractor returns [{"page": int, "text": str}]. Page numbers are shown
in citations, so they must mean something:

  PDF, PPTX  the real page / slide
  DOCX       the page as Word last laid it out (Word saves these markers),
             or ~3,000-character sections at paragraph breaks when absent
  TXT, MD    form-feed separated pages, or ~3,000-character sections
"""

import logging
import re
import unicodedata

import docx
import fitz  # PyMuPDF
import pptx

logger = logging.getLogger("apps.documents")

SECTION_CHARS = 3000
_W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"


def extract_text_by_page(file_path: str, file_type: str) -> list[dict]:
    logger.info(f"Extracting text from {file_path} of type {file_type}")
    file_type = file_type.lower()
    extractors = {"pdf": _extract_pdf, "docx": _extract_docx, "pptx": _extract_pptx, "txt": _extract_txt, "md": _extract_txt}
    if file_type not in extractors:
        logger.error(f"Unsupported file type: {file_type}")
        raise ValueError(f"Unsupported file type: {file_type}")
    pages = extractors[file_type](file_path)
    for p in pages:
        p["text"] = normalize_text(p.get("text") or "")
    return pages


def normalize_text(text: str) -> str:
    """
    NFKC folds typographic ligatures (ﬁ, ﬂ) and other compatibility characters
    that PDF typesetting introduces, so "overﬁtting" is indexed as "overfitting".
    Also trims trailing whitespace on lines.
    """
    text = unicodedata.normalize("NFKC", text)
    text = re.sub(r"[ \t]+\n", "\n", text)
    return text.strip()


def _group(blocks: list[str], joiner: str) -> list[dict]:
    """Pack consecutive blocks into ~SECTION_CHARS sections without splitting a block."""
    pages, current, size = [], [], 0
    for block in blocks:
        if current and size + len(block) > SECTION_CHARS:
            pages.append({"page": len(pages) + 1, "text": joiner.join(current)})
            current, size = [], 0
        current.append(block)
        size += len(block) + len(joiner)
    if current:
        pages.append({"page": len(pages) + 1, "text": joiner.join(current)})
    return pages


# --------------------------------------------------------------------- PDF

def _extract_pdf(file_path: str) -> list[dict]:
    try:
        with fitz.open(file_path) as doc:
            if doc.needs_pass:
                raise ValueError("This PDF is password-protected.")
            return [{"page": idx + 1, "text": page.get_text().strip()} for idx, page in enumerate(doc)]
    except ValueError:
        raise
    except Exception as e:
        logger.exception(f"Error extracting PDF: {e}")
        raise


# --------------------------------------------------------------------- DOCX

def _paragraph_breaks_page(p_el) -> bool:
    if p_el.findall(f".//{_W}lastRenderedPageBreak"):
        return True
    return any(br.get(f"{_W}type") == "page" for br in p_el.findall(f".//{_W}br"))


def _extract_docx(file_path: str) -> list[dict]:
    from docx.table import Table
    from docx.text.paragraph import Paragraph

    try:
        doc = docx.Document(file_path)
    except Exception as e:
        logger.exception(f"Error extracting DOCX: {e}")
        raise

    blocks: list[tuple[str, bool]] = []  # (text, starts a new page)
    for el in doc.element.body.iterchildren():
        tag = el.tag.split("}")[-1]
        if tag == "p":
            blocks.append((Paragraph(el, doc).text.strip(), _paragraph_breaks_page(el)))
        elif tag == "tbl":
            rows = []
            for row in Table(el, doc).rows:
                cells = [c.text.strip() for c in row.cells]
                # merged cells repeat their text; keep each value once per row
                kept = [c for i, c in enumerate(cells) if c and (i == 0 or c != cells[i - 1])]
                if kept:
                    rows.append(" | ".join(kept))
            blocks.append(("\n".join(rows), False))

    if not any(brk for _, brk in blocks):
        return _group([t for t, _ in blocks if t], "\n")

    pages, current = [], []
    for text, brk in blocks:
        if brk and current:
            pages.append({"page": len(pages) + 1, "text": "\n".join(current)})
            current = []
        if text:
            current.append(text)
    if current:
        pages.append({"page": len(pages) + 1, "text": "\n".join(current)})
    return pages


# --------------------------------------------------------------------- PPTX

def _shape_text(shape) -> list[str]:
    out = []
    if getattr(shape, "has_text_frame", False) and shape.has_text_frame:
        out += [p.text.strip() for p in shape.text_frame.paragraphs if p.text.strip()]
    if getattr(shape, "has_table", False) and shape.has_table:
        for row in shape.table.rows:
            cells = [c.text.strip() for c in row.cells if c.text.strip()]
            if cells:
                out.append(" | ".join(cells))
    for child in getattr(shape, "shapes", []) or []:  # grouped shapes
        out += _shape_text(child)
    return out


def _extract_pptx(file_path: str) -> list[dict]:
    try:
        prs = pptx.Presentation(file_path)
    except Exception as e:
        logger.exception(f"Error extracting PPTX: {e}")
        raise
    pages = []
    for idx, slide in enumerate(prs.slides):
        lines = []
        for shape in slide.shapes:
            lines += _shape_text(shape)
        if slide.has_notes_slide:
            notes = slide.notes_slide.notes_text_frame.text.strip() if slide.notes_slide.notes_text_frame else ""
            if notes:
                lines.append(f"Speaker notes: {notes}")
        pages.append({"page": idx + 1, "text": "\n".join(lines)})
    return pages


# --------------------------------------------------------------------- TXT / MD

def _decode_text(raw: bytes) -> str:
    """UTF-8 (with or without BOM), UTF-16 with BOM, else Windows-1252. Never drops bytes silently."""
    if raw.startswith((b"\xff\xfe", b"\xfe\xff")):
        return raw.decode("utf-16")
    try:
        return raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        return raw.decode("cp1252", errors="replace")


def _extract_txt(file_path: str) -> list[dict]:
    with open(file_path, "rb") as f:
        content = _decode_text(f.read()).replace("\r\n", "\n")
    if "\f" in content:
        return [{"page": i + 1, "text": part.strip()} for i, part in enumerate(content.split("\f"))]
    paragraphs = [p.strip() for p in re.split(r"\n\s*\n", content) if p.strip()]
    return _group(paragraphs, "\n\n")
