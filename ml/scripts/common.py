"""Shared helpers for the ASADO.MAKER dataset pipeline (stdlib only)."""

from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path

ML_ROOT = Path(__file__).resolve().parent.parent
REPO_ROOT = ML_ROOT.parent
DATA_DIR = ML_ROOT / "data"
CATALOG = DATA_DIR / "domain_catalog.json"
EXAMPLES = DATA_DIR / "domain_examples.json"

PAGE_MARKER = re.compile(r"^<!--\s*page:(\d+)\s*-->\s*$")


def read_json(path: Path) -> dict:
    return json.loads(Path(path).read_text(encoding="utf-8"))


def write_json(path: Path, obj) -> None:
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    Path(path).write_text(json.dumps(obj, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def read_jsonl(path: Path) -> list[dict]:
    out = []
    for line in Path(path).read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line:
            out.append(json.loads(line))
    return out


def write_jsonl(path: Path, rows) -> int:
    rows = list(rows)
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    with Path(path).open("w", encoding="utf-8") as fh:
        for row in rows:
            fh.write(json.dumps(row, ensure_ascii=False) + "\n")
    return len(rows)


def est_tokens(text: str) -> int:
    """Cheap token estimate (~4 chars/token); good enough for chunk sizing."""
    return max(1, round(len(text) / 4))


def dehyphenate(text: str) -> str:
    """Join words split across line breaks: 'que-\\nbracho' -> 'quebracho'."""
    return re.sub(r"(\w)-\n(\w)", r"\1\2", text)


def normalize_whitespace(text: str) -> str:
    """Collapse runs of spaces/tabs and 3+ blank lines; keep single newlines."""
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r" *\n *", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def strip_markdown_noise(text: str) -> str:
    """Drop control chars that leak out of PDF extraction."""
    text = text.replace("\u00ad", "")  # soft hyphen
    text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", "", text)
    return text


# --------------------------------------------------------------------------- dedup

_WORD = re.compile(r"[a-z0-9áéíóúñü]+", re.IGNORECASE)


def shingles(text: str, k: int = 5) -> set[str]:
    words = _WORD.findall(text.lower())
    if len(words) < k:
        return {" ".join(words)} if words else set()
    return {" ".join(words[i : i + k]) for i in range(len(words) - k + 1)}


def _h(seed: int, token: str) -> int:
    digest = hashlib.blake2b(f"{seed}:{token}".encode("utf-8"), digest_size=8).digest()
    return int.from_bytes(digest, "big")


def minhash(text: str, num_hashes: int = 64, k: int = 5) -> tuple[int, ...]:
    grams = shingles(text, k)
    if not grams:
        return tuple([0] * num_hashes)
    return tuple(min(_h(i, g) for g in grams) for i in range(num_hashes))


def jaccard(a: tuple[int, ...], b: tuple[int, ...]) -> float:
    same = sum(1 for x, y in zip(a, b) if x == y)
    return same / len(a) if a else 0.0


def dedup(items: list[dict], text_key: str = "text", threshold: float = 0.8) -> list[dict]:
    """Drop near-duplicates, keeping the first of each near-identical cluster."""
    kept: list[dict] = []
    sigs: list[tuple[int, ...]] = []
    for item in items:
        sig = minhash(item[text_key])
        if any(jaccard(sig, s) >= threshold for s in sigs):
            continue
        kept.append(item)
        sigs.append(sig)
    return kept