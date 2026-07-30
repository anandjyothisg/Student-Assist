"""
SmartStudent AI — Document Text Cleaner Service
"""

import re
import logging
from collections import Counter

logger = logging.getLogger("apps.documents")


def clean_pages(pages: list[dict]) -> list[dict]:
    """
    Cleans raw page-by-page text.
    
    Tasks:
        - Removes repetitive headers/footers dynamically.
        - Removes page number patterns.
        - Normalize multi-spaces/tabs to single space.
        - Combines linebreaks inside paragraphs and returns clean paragraphs.
        
    Args:
        pages: list of dict [{"page": int, "text": str}]
        
    Returns:
        list of dict: [{"page": int, "text": str}]
    """
    if not pages:
        return []

    # Dynamic Header/Footer detection
    # Collect first and last lines of each page to check for repetitions
    first_lines = []
    last_lines = []
    
    for p in pages:
        lines = [line.strip() for line in p.get("text", "").split("\n") if line.strip()]
        if lines:
            first_lines.append(lines[0])
            if len(lines) > 1:
                last_lines.append(lines[-1])

    # Count occurrences
    header_counts = Counter(first_lines)
    footer_counts = Counter(last_lines)
    
    # Heuristics: if a line appears on >= 2 pages (or >= 25% of pages if the document is long),
    # we classify it as a header or footer.
    min_occurrence = max(2, len(pages) // 4)
    common_headers = {line for line, count in header_counts.items() if count >= min_occurrence}
    common_footers = {line for line, count in footer_counts.items() if count >= min_occurrence}

    cleaned_pages = []
    for p in pages:
        page_num = p.get("page", 1)
        text = p.get("text", "")
        
        raw_lines = text.split("\n")
        cleaned_lines = []
        
        # Regex patterns for page numbers (e.g., "Page 1", "1 of 10", "1", "[1]", "- 1 -")
        page_num_patterns = [
            r"^\d+$",                        # Just digits
            r"^page\s+\d+$",                 # Page 1
            r"^\d+\s+of\s+\d+$",             # 1 of 10
            r"^\[\d+\]$",                    # [1]
            r"^-\s*\d+\s*-$"                 # - 1 -
        ]
        
        for idx, line in enumerate(raw_lines):
            line_stripped = line.strip()
            if not line_stripped:
                continue
                
            # Remove recurring headers (only if located at the top of the page)
            if idx == 0 and line_stripped in common_headers:
                continue
                
            # Remove recurring footers (only if located at the bottom of the page)
            if idx == len(raw_lines) - 1 and line_stripped in common_footers:
                continue
                
            # Remove page numbers
            is_page_num = False
            for pat in page_num_patterns:
                if re.match(pat, line_stripped, re.IGNORECASE):
                    is_page_num = True
                    break
            if is_page_num:
                continue
                
            # Normalize spaces/tabs
            line_normalized = re.sub(r"[ \t]+", " ", line_stripped)
            cleaned_lines.append(line_normalized)
            
        # Group lines back into paragraphs
        # Mid-sentence linebreaks are combined (e.g. if the line doesn't end with a sentence terminator)
        paragraphs = []
        current_para = []
        
        for line in cleaned_lines:
            current_para.append(line)
            # Check if line ends with period, exclamation mark, or question mark indicating sentence/para boundary
            if line.endswith((".", "!", "?", ':"', '."')):
                paragraphs.append(" ".join(current_para))
                current_para = []
                
        # Flush any remaining text as a paragraph
        if current_para:
            paragraphs.append(" ".join(current_para))
            
        # Re-join paragraphs using double-newlines
        clean_text = "\n\n".join(paragraphs).strip()
        
        cleaned_pages.append({
            "page": page_num,
            "text": clean_text
        })
        
    return cleaned_pages
