"""Clean extracted Markdown: dehyphenate, strip running headers/footers, dedup.

Pure functions, stdlib only. Page boundaries come from `<!-- page:N -->`
markers written by `pdf_extract.py`.
"""

from __future__ import annotations

import re
from collections import Counter

from common import PAGE_MARKER, dehyphenate, normalize_whitespace, strip_markdown_noise

_FOOTER_NOISE = re.compile(r"^\s*(page\s*)?\d{1,4}(\s*/\s*\d{1,4})?\s*$", re.IGNORECASE)
_HEADING = re.compile(r"^#{1,6}\s")


def split_pages(text: str) -> list[list[str]]:
    """Split into per-page line lists, dropping the marker lines themselves."""
    pages: list[list[str]] = [[]]
    for line in text.splitlines():
        if PAGE_MARKER.match(line):
            pages.append([])
        else:
            pages[-1].append(line)
    return [p for p in pages if any(l.strip() for l in p)]


def running_headers(pages: list[list[str]], ratio: float = 0.5, max_len: int = 90) -> set[str]:
    """Lines that recur on most pages are running headers/footers, not content."""
    if len(pages) < 3:
        return set()
    counts: Counter[str] = Counter()
    for page in pages:
        seen = {l.strip() for l in page[:2] + page[-2:] if l.strip() and len(l.strip()) <= max_len}
        counts.update(seen)
    threshold = max(2, int(len(pages) * ratio))
    return {line for line, n in counts.items() if n >= threshold}


def clean_document(text: str) -> str:
    text = strip_markdown_noise(text)
    pages = split_pages(text)
    headers = running_headers(pages)

    kept: list[str] = []
    for page in pages:
        for raw in page:
            line = raw.rstrip()
            stripped = line.strip()
            if stripped in headers or _FOOTER_NOISE.match(stripped):
                continue
            kept.append(line)
        kept.append("")

    text = "\n".join(kept)
    text = dehyphenate(text)
    text = normalize_whitespace(text)
    # headings should keep their blank line before them
    return re.sub(r"(?<!\n)\n(#{1,6}\s)", r"\n\n\1", text)


def clean_paragraphs(text: str) -> list[str]:
    """Paragraph blocks, headings kept attached to the text that follows them."""
    blocks = [b.strip() for b in re.split(r"\n\s*\n", text) if b.strip()]
    return [b for b in blocks if not _HEADING.match(b) or len(b) > 1]