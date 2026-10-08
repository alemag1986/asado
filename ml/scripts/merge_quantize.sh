#!/usr/bin/env bash
# Merge the QLoRA adapter and quantize to Q4_K_M + mmproj for llama.cpp.
# Run on the GPU droplet after training (plan.md Phase 4 steps 8-9).
#
#   ADAPTER=ml/out/v0 BASE=Qwen/Qwen3-VL-4B-Instruct ./ml/scripts/merge_quantize.sh
#
# Produces: ml/out/gguf/<name>-Q4_K_M.gguf and mmproj-f16.gguf
set -euo pipefail

ADAPTER="${ADAPTER:-ml/out/v0}"
BASE="${BASE:-Qwen/Qwen3-VL-4B-Instruct}"
NAME="${NAME:-asado-v0}"
OUT="${OUT:-ml/out/gguf}"
LLAMA_CPP="${LLAMA_CPP:-$HOME/llama.cpp}"

mkdir -p "$OUT"

echo "==> merging adapter $ADAPTER into $BASE"
python3 - "$ADAPTER" "$BASE" "$OUT/$NAME-merged" <<'PY'
import sys
from unsloth import FastVisionModel

adapter, base, out = sys.argv[1:4]
model, tokenizer = FastVisionModel.from_pretrained(adapter, load_in_4bit=True)
model.save_pretrained_merged(out, tokenizer, save_method="merged_16bit")
print("merged ->", out)
PY

echo "==> converting to GGUF"
python3 "$LLAMA_CPP/convert_hf_to_gguf.py" "$OUT/$NAME-merged" \
    --outfile "$OUT/$NAME-f16.gguf" --outtype f16

echo "==> quantizing Q4_K_M"
"$LLAMA_CPP/build/bin/llama-quantize" "$OUT/$NAME-f16.gguf" "$OUT/$NAME-Q4_K_M.gguf" Q4_K_M

echo "==> converting vision projector (mmproj)"
python3 "$LLAMA_CPP/convert_hf_to_gguf.py" "$OUT/$NAME-merged" \
    --mmproj --outfile "$OUT/mmproj-f16.gguf"

echo "done:"
ls -lh "$OUT"/*.gguf
echo
echo "serve with:"
echo "  llama-server -m $OUT/$NAME-Q4_K_M.gguf --mmproj $OUT/mmproj-f16.gguf --jinja --api-key \$KEY"
