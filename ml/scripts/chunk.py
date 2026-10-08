"""Chunk cleaned Markdown by section (512–2048 tok) keeping source + heading path."""

from __future__ import annotations

import re

from common import est_tokens

_HEADING = re.compile(r"^(#{1,6})\s+(.*)$")
MAX_TOKENS = 2048
MIN_TOKENS = 200
TARGET_TOKENS = 1500


def _headings(md: str) -> list[tuple[int, str]]:
    return [(len(m.group(1)), m.group(2).strip()) for m in map(_HEADING.match, md.splitlines()) if m]


def split_sections(md: str) -> list[dict]:
    """Cut at heading boundaries; each section carries its heading path."""
    stack: list[str] = []
    sections: list[dict] = []
    buf: list[str] = []
    path: list[str] = []

    def flush():
        if buf:
            body = "\n".join(buf).strip()
            if body:
                sections.append({"heading": " › ".join(path), "text": body})

    for line in md.splitlines():
        m = _HEADING.match(line)
        if not m:
            buf.append(line)
            continue
        flush()
        buf = [line]
        level = len(m.group(1))
        stack = stack[: level - 1] + [m.group(2).strip()]
        path = list(stack)
    flush()
    return sections


def _split_long(text: str, max_tokens: int) -> list[str]:
    paras = [p for p in re.split(r"\n\s*\n", text) if p.strip()]
    chunks, cur, cur_tok = [], [], 0
    for para in paras:
        tok = est_tokens(para)
        if cur and cur_tok + tok > max_tokens:
            chunks.append("\n\n".join(cur))
            cur, cur_tok = [], 0
        cur.append(para)
        cur_tok += tok
    if cur:
        chunks.append("\n\n".join(cur))
    return chunks


def chunk_document(md: str, source: str, max_tokens: int = MAX_TOKENS, min_tokens: int = MIN_TOKENS) -> list[dict]:
    """Section-aware chunks merged to ~TARGET_TOKENS; oversized ones split by paragraph."""
    out: list[dict] = []
    pending_text: list[str] = []
    pending_head = ""
    pending_tok = 0

    def emit(heading: str, body: str):
        idx = sum(1 for c in out if c["source"] == source)  # running index per source
        out.append({
            "id": f"{source}#{idx:04d}",
            "source": source,
            "heading": heading,
            "text": body.strip(),
            "tokens": est_tokens(body),
        })

    def flush_pending():
        nonlocal pending_text, pending_head, pending_tok
        if pending_text:
            emit(pending_head, "\n\n".join(pending_text))
            pending_text, pending_head, pending_tok = [], "", 0

    for section in split_sections(md):
        body = section["text"]
        tok = est_tokens(body)
        if tok > max_tokens:
            flush_pending()
            for part in _split_long(body, max_tokens):
                emit(section["heading"], part)
            continue
        if pending_text and pending_tok + tok > TARGET_TOKENS:
            flush_pending()
        if not pending_text:
            pending_head = section["heading"]
        pending_text.append(body)
        pending_tok += tok
    flush_pending()

    for i, c in enumerate(out):
        c["id"] = f"{source}#{i:04d}"
    return out
