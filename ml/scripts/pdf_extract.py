"""Extract text + figures from PDFs to Markdown with page provenance.

Heavy deps are imported lazily: `pip install -e 'ml[extract]'` (pymupdf4llm,
ocrmypdf) and the system `tesseract`/`ghostscript` for OCR.

    python3 ml/scripts/pdf_extract.py --in data/pdfs --out data/extracted \
        --images data/images --ocr

Writes `<name>.md` with `<!-- page:N -->` markers (consumed by clean.py) and
saves figures as `<name>_p<page>_<n>.<ext>` so captions keep provenance.
"""

from __future__ import annotations

import argparse
from pathlib import Path


def needs_ocr(pdf_path: Path) -> bool:
    """True when a page yields almost no text (scanned book)."""
    import fitz

    with fitz.open(pdf_path) as doc:
        sample = doc[0].get_text().strip() if doc.page_count else ""
    return len(sample) < 20


def run_ocr(pdf_path: Path) -> Path:
    import subprocess
    import tempfile

    out = Path(tempfile.mkdtemp()) / f"{pdf_path.stem}_ocr.pdf"
    subprocess.run(["ocrmypdf", "--skip-text", str(pdf_path), str(out)], check=True)
    return out


def save_figures(doc, stem: str, page_no: int, images_dir: Path) -> list[Path]:
    images_dir.mkdir(parents=True, exist_ok=True)
    saved: list[Path] = []
    page = doc[page_no - 1]
    for idx, info in enumerate(page.get_images(full=True), start=1):
        xref = info[0]
        try:
            img = doc.extract_image(xref)
        except Exception:
            continue
        if len(img["image"]) < 8 * 1024:  # skip icons/rules
            continue
        path = images_dir / f"{stem}_p{page_no}_{idx}.{img['ext']}"
        path.write_bytes(img["image"])
        saved.append(path)
    return saved


def extract_pdf(pdf_path: Path, out_dir: Path, images_dir: Path, ocr: bool = False) -> tuple[Path, list[Path]]:
    import pymupdf4llm

    source = pdf_path
    if ocr and needs_ocr(pdf_path):
        source = run_ocr(pdf_path)

    import fitz

    figures: list[Path] = []
    parts: list[str] = []
    with fitz.open(source) as doc:
        for page_no in range(1, doc.page_count + 1):
            md = pymupdf4llm.to_markdown(doc, pages=[page_no - 1]).strip()
            parts.append(f"<!-- page:{page_no} -->\n\n{md}")
            figures += save_figures(doc, pdf_path.stem, page_no, images_dir)

    out_dir.mkdir(parents=True, exist_ok=True)
    out_md = out_dir / f"{pdf_path.stem}.md"
    out_md.write_text("\n\n".join(parts) + "\n", encoding="utf-8")
    return out_md, figures


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--in", dest="src", required=True, help="PDF file or directory")
    ap.add_argument("--out", default="ml/data/extracted")
    ap.add_argument("--images", default="ml/data/images")
    ap.add_argument("--ocr", action="store_true", help="OCR scanned PDFs with ocrmypdf")
    args = ap.parse_args()

    src = Path(args.src)
    pdfs = sorted(src.glob("*.pdf")) if src.is_dir() else [src]
    if not pdfs:
        raise SystemExit(f"no PDFs under {src}")

    out_dir, images_dir = Path(args.out), Path(args.images)
    for pdf in pdfs:
        md, figures = extract_pdf(pdf, out_dir, images_dir, ocr=args.ocr)
        print(f"{pdf.name}: -> {md} ({len(figures)} figures)")


if __name__ == "__main__":
    main()