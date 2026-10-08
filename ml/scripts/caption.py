"""Caption book figures with the base Qwen3-VL model into doneness pairs.

    pip install -e 'ml[caption]'
    python3 ml/scripts/caption.py --images ml/data/images --out ml/data/caption_pairs.jsonl

~10% of captions must be hand-checked (plan.md Phase 4 step 6). The self-shot
grill photos with a known doneness stage are the critical capability — write
them directly with `manual_pair()` and skip this script.
"""

from __future__ import annotations

import argparse
from pathlib import Path

from common import DATA_DIR, write_jsonl
from synth_pairs import SYSTEM

IMAGE_USER = (
    "Here's my grill right now. How does it look — sear, fat rendering — "
    "and should I flip, hold, move to low, or pull?"
)


def caption_row(image_path: str, answer: str, rel_image: str | None = None) -> dict:
    stem = Path(image_path).stem
    return {
        "task": "image_doneness",
        "source": f"img:{stem}",
        "system": SYSTEM,
        "user": IMAGE_USER,
        "assistant": answer,
        "image": rel_image or image_path,
    }


def manual_pair(image_path: str, stage: str, action: str, tip: str, rel_image: str | None = None) -> dict:
    answer = f"Doneness stage: {stage}. Recommended action: {action}. {tip}"
    return caption_row(image_path, answer, rel_image)


def _load_model(model_id: str, device: str):
    import torch
    from transformers import AutoProcessor, Qwen2_5_VLForConditionalGeneration

    processor = AutoProcessor.from_pretrained(model_id)
    model = Qwen2_5_VLForConditionalGeneration.from_pretrained(
        model_id, torch_dtype=torch.bfloat16, device_map=device
    )
    return processor, model


def _caption(image_path: str, processor, model) -> str:
    from PIL import Image

    messages = [
        {"role": "system", "content": SYSTEM},
        {
            "role": "user",
            "content": [
                {"type": "image"},
                {"type": "text", "text": IMAGE_USER},
            ],
        },
    ]
    text = processor.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
    inputs = processor(text=[text], images=[Image.open(image_path)], return_tensors="pt").to(model.device)
    out = model.generate(**inputs, max_new_tokens=160, do_sample=False)
    generated = out[:, inputs.input_ids.shape[1] :]
    return processor.batch_decode(generated, skip_special_tokens=True)[0].strip()


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--images", default=str(DATA_DIR / "images"))
    ap.add_argument("--out", default=str(DATA_DIR / "caption_pairs.jsonl"))
    ap.add_argument("--model", default="Qwen/Qwen3-VL-4B-Instruct")
    ap.add_argument("--model-class", default="Qwen2_5_VLForConditionalGeneration")
    ap.add_argument("--device", default="auto")
    ap.add_argument("--limit", type=int, default=0)
    args = ap.parse_args()

    images = sorted(
        p for p in Path(args.images).glob("*") if p.suffix.lower() in {".png", ".jpg", ".jpeg", ".webp"}
    )
    if args.limit:
        images = images[: args.limit]
    if not images:
        raise SystemExit(f"no images under {args.images}")

    processor, model = _load_model(args.model, args.device)
    rows = []
    for img in images:
        rows.append(caption_row(str(img), _caption(str(img), processor, model), str(img)))
    n = write_jsonl(args.out, rows)
    print(f"wrote {n} caption pairs -> {args.out}")


if __name__ == "__main__":
    main()