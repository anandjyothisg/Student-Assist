"""
SmartStudent AI — Document Text Extraction Service
"""

import logging
import fitz  # PyMuPDF
import docx
import pptx

logger = logging.getLogger("apps.documents")


def extract_text_by_page(file_path: str, file_type: str) -> list[dict]:
    """
    Extracts text from a document page-by-page.
    
    Args:
        file_path: Absolute path to the file.
        file_type: File format (pdf, docx, pptx, txt).
        
    Returns:
        list of dict: [{"page": int, "text": str}]
    """
    logger.info(f"Extracting text from {file_path} of type {file_type}")
    
    file_type = file_type.lower()
    
    if file_type == "pdf":
        return _extract_pdf(file_path)
    elif file_type == "docx":
        return _extract_docx(file_path)
    elif file_type == "pptx":
        return _extract_pptx(file_path)
    elif file_type == "txt":
        return _extract_txt(file_path)
    else:
        logger.error(f"Unsupported file type: {file_type}")
        raise ValueError(f"Unsupported file type: {file_type}")


def _extract_pdf(file_path: str) -> list[dict]:
    pages = []
    try:
        with fitz.open(file_path) as doc:
            for idx, page in enumerate(doc):
                text = page.get_text().strip()
                pages.append({
                    "page": idx + 1,
                    "text": text
                })
    except Exception as e:
        logger.exception(f"Error extracting PDF: {e}")
        raise
    return pages


def _extract_docx(file_path: str) -> list[dict]:
    pages = []
    try:
        doc = docx.Document(file_path)
        
        # Group paragraphs to simulate pages (e.g. 10 paragraphs per page)
        paragraphs_per_page = 12
        current_page_text = []
        page_num = 1
        
        for idx, para in enumerate(doc.paragraphs):
            text = para.text.strip()
            if text:
                current_page_text.append(text)
            
            if (idx + 1) % paragraphs_per_page == 0:
                pages.append({
                    "page": page_num,
                    "text": "\n".join(current_page_text)
                })
                current_page_text = []
                page_num += 1
                
        # Append remaining paragraphs
        if current_page_text:
            pages.append({
                "page": page_num,
                "text": "\n".join(current_page_text)
            })
    except Exception as e:
        logger.exception(f"Error extracting DOCX: {e}")
        raise
    return pages


def _extract_pptx(file_path: str) -> list[dict]:
    pages = []
    try:
        prs = pptx.Presentation(file_path)
        for idx, slide in enumerate(prs.slides):
            slide_text = []
            for shape in slide.shapes:
                if hasattr(shape, "has_text_frame") and shape.has_text_frame:
                    for paragraph in shape.text_frame.paragraphs:
                        text = paragraph.text.strip()
                        if text:
                            slide_text.append(text)
            pages.append({
                "page": idx + 1,
                "text": "\n".join(slide_text)
            })
    except Exception as e:
        logger.exception(f"Error extracting PPTX: {e}")
        raise
    return pages


def _extract_txt(file_path: str) -> list[dict]:
    pages = []
    try:
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            content = f.read()
            
        # Group by character chunks to simulate pages (~2000 chars per page)
        chars_per_page = 2000
        page_num = 1
        for i in range(0, len(content), chars_per_page):
            text = content[i:i + chars_per_page].strip()
            pages.append({
                "page": page_num,
                "text": text
            })
            page_num += 1
    except Exception as e:
        logger.exception(f"Error extracting TXT: {e}")
        raise
    return pages
