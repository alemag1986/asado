"""Assemble ShareGPT JSONL for Unsloth: merge pair sources, 95/5 split, golden holdout.

Input files are JSONL rows in the internal shape produced by `synth_pairs.py`
and `caption.py`:

    {"task": ..., "source": ..., "system": ..., "user": ..., "assistant": ..., "image": path?}

    python3 ml/scripts/format_dataset.py \
        --in ml/data/synth_pairs.jsonl --in ml/data/caption_pairs.jsonl \
        --golden ml/eval/golden.jsonl --out-dir ml/data
"""

from __future__ import annotations

import argparse
import random

from common import DATA_DIR, read_jsonl, write_jsonl

VAL_FRACTION = 0.05
SEED = 42


def to_sharegpt(row: dict) -> dict:
    user_parts: list[dict] = [{"type": "text", "text": row["user"]}]
    out: dict = {
        "messages": [
            {"role": "system", "content": row.get("system", "")},
            {"role": "user", "content": user_parts},
            {"role": "assistant", "content": [{"type": "text", "text": row["assistant"]}]},
        ]
    }
    if row.get("image"):
        user_parts.append({"type": "image", "image": row["image"]})
        out["images"] = [row["image"]]
    return out


def golden_sources(path: str | None) -> set[str]:
    if not path:
        return set()
    return {row["source"] for row in read_jsonl(path) if row.get("source")}


def format_dataset(rows: list[dict], holdout: set[str]) -> tuple[list[dict], list[dict]]:
    kept = [r for r in rows if r.get("source") not in holdout]
    order = list(range(len(kept)))
    random.Random(SEED).shuffle(order)
    n_val = max(1, int(len(kept) * VAL_FRACTION)) if len(kept) > 1 else 0
    val_idx = set(order[:n_val])
    train = [to_sharegpt(kept[i]) for i in range(len(kept)) if i not in val_idx]
    val = [to_sharegpt(kept[i]) for i in range(len(kept)) if i in val_idx]
    return train, val


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--in", dest="inputs", action="append", required=True, help="rows file (repeatable)")
    ap.add_argument("--golden", default=None, help="golden.jsonl whose sources are held out")
    ap.add_argument("--out-dir", default=str(DATA_DIR))
    ap.add_argument("--check", action="store_true", help="validate only, write nothing")
    args = ap.parse_args()

    rows: list[dict] = []
    for path in args.inputs:
        rows.extend(read_jsonl(path))

    holdout = golden_sources(args.golden)
    overlap = sum(1 for r in rows if r.get("source") in holdout)
    train, val = format_dataset(rows, holdout)

    if args.check:
        print(f"rows={len(rows)} holdout_sources={len(holdout)} dropped={overlap} train={len(train)} val={len(val)}")
        return

    from pathlib import Path

    out = Path(args.out_dir)
    write_jsonl(out / "train.jsonl", train)
    write_jsonl(out / "val.jsonl", val)
    print(f"held out {overlap} golden rows; wrote {len(train)} train / {len(val)} val -> {out}")


if __name__ == "__main__":
    main()