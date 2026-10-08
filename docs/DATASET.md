# DATASET — ASADO.MAKER

How the fine-tuning corpus is built, from bought books to a Qwen3-VL-4B QLoRA adapter.

The rule that shapes this pipeline: **numbers come from code, judgment comes from the model.**
Quantity, fire and timing facts are generated from the shipped Rust API (via `snapshot_domain.py`),
so a training pair can never teach the model a number the app doesn't already produce. The model
is only asked to learn the hard parts: reading a grill photo, prose, situational advice.

```
data/pdfs ──pdf_extract──▶ extracted/*.md ──clean──▶ chunk ──▶ synth_pairs ─┐
                                │                                          ├─format_dataset─▶ train/val.jsonl
                                └─ images ──caption──▶ caption_pairs ──────┘
domain snapshots (API) ──synth_pairs──┘                    golden.jsonl ──▶ eval/score.py
```

## Layout

| Path | What |
|---|---|
| `scripts/snapshot_domain.py` | Pull deterministic answers from the running API → `data/domain_{catalog,examples}.json` |
| `scripts/pdf_extract.py` | PDF → Markdown with `<!-- page:N -->` markers + figures |
| `scripts/clean.py` | Dehyphenate, strip running headers/footers, MinHash near-dup removal |
| `scripts/chunk.py` | Section-aware chunks (512–2048 tok) with heading path + source id |
| `scripts/synth_pairs.py` | 8 instruction task types, grounded in the snapshots |
| `scripts/caption.py` | Caption book figures with base Qwen3-VL → doneness pairs |
| `scripts/format_dataset.py` | Merge sources → ShareGPT JSONL, 95/5 split, golden holdout |
| `scripts/merge_quantize.sh` | Merge adapter → Q4_K_M GGUF + mmproj |
| `eval/golden.jsonl` | Frozen golden set (values copied from the API) |
| `eval/score.py` | JSON-validity / numeric / substring scoring |

## Environment

```bash
cd ml
uv sync --extra dev          # pure pipeline + pytest (no torch)
uv sync --extra extract      # + pymupdf4llm, ocrmypdf (needs tesseract, ghostscript)
uv sync --extra caption      # + torch, transformers, pillow
uv run pytest                # 20 tests, stdlib only
```

## The eight task types

`quantity_for_n`, `fire_setup_by_fuel`, `doneness_judgment`, `rotate_troubleshoot`, `timing`,
`cut_glossary`, `shopping_list`, `tips`.

The first two and `shopping_list` are numeric and come straight from `/api/plan` and `/api/fire`.
The rest are prose assembled from the cut catalog (`prep`, `signals`, `rotate_rule`, `pull_rule`,
`carve`, `target_temp_c`). Adding a cut to `api/src/domain/cuts.rs` and re-snapshotting grows the
corpus — no Python edits.

## Steps

1. **Acquire.** Buy/scan books. Keep them private; never redistribute raw PDFs. Drop them in
   `data/pdfs/` (gitignored).

2. **Extract.**
   ```bash
   uv run python scripts/pdf_extract.py --in data/pdfs --out data/extracted --images data/images --ocr
   ```
   `--ocr` runs `ocrmypdf --skip-text` automatically on pages with almost no text.

3. **Clean.** `clean.clean_document()` removes running headers/footers (lines on >50% of pages),
   page numbers, soft hyphens, and joins hyphen-split words. `common.dedup()` drops near-duplicate
   5-gram shingles (MinHash Jaccard ≥ 0.8).

4. **Chunk.** `chunk.chunk_document(md, source)` cuts at headings, merges short sections toward
   ~1500 tok, splits long ones at paragraph boundaries. Every chunk keeps `source` + `heading`.

5. **Synthesize pairs.**
   ```bash
   cd ../api && BIND=127.0.0.1:4000 cargo run &     # mock mode is fine
   cd ../ml && uv run python scripts/snapshot_domain.py
   uv run python scripts/synth_pairs.py             # -> data/synth_pairs.jsonl (~860 rows)
   ```

6. **Images — the critical path.** The 1–2k self-shot grill photos with a known doneness stage and
   flip/no-flip label are the real work; no off-the-shelf dataset exists. Caption book figures with
   the base model, then hand-check ~10%:
   ```bash
   uv run python scripts/caption.py --images data/images --out data/caption_pairs.jsonl
   ```
   For known photographs prefer `caption.manual_pair(path, stage, action, tip)` — it writes the
   ground truth directly instead of asking the base model.

7. **Format.**
   ```bash
   uv run python scripts/format_dataset.py \
       --in data/synth_pairs.jsonl --in data/caption_pairs.jsonl \
       --golden eval/golden.jsonl --out-dir data
   ```
   Rows whose `source` appears in the golden set are held out of training; the rest split 95/5
   with a fixed seed. Emits Unsloth multimodal ShareGPT (`messages` + `images`).

8. **Train.** Unsloth QLoRA on a `gpu-rtx4000x1-20gb` droplet (~6 GB VRAM, 1–3 h). Merge and
   quantize:
   ```bash
   ADAPTER=ml/out/v0 NAME=asado-v0 ./ml/scripts/merge_quantize.sh
   ```

9. **Evaluate.**
   ```bash
   uv run python eval/score.py --mock                                  # checks the harness
   uv run python eval/score.py --base-url http://127.0.0.1:8080/v1 \
       --model asado-v0 --api-key "$KEY"
   ```
   Gate: ship only if the tuned model beats base on the golden set. Golden expectations are copied
   from the API snapshot, so "passed" means the model agrees with the shipped code.

10. **Iterate.** Every failing golden item becomes new training rows; version adapters `v0, v1…`.

## Notes

- `data/domain_catalog.json` and `data/domain_examples.json` are committed (small, reproducible):
  they let `synth_pairs` and the tests run offline in CI. Regenerate with `snapshot_domain.py`
  whenever the domain tables change.
- Raw PDFs, extracted text, images and generated JSONL stay gitignored.
- Safety: the app shows a food-safety disclaimer on temps; keep it wherever the model speaks.
