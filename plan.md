# ASADO.MAKER — Build Plan

Argentine & Uruguayan BBQ assistant. 3 steps: meat selection → fire prep → cooking.
Fine-tuned lightweight open-weight VLM, mobile-first PWA, retro-computing × neo-brutalist design.

---

## Locked decisions

| Area | Choice |
|---|---|
| Model | **Qwen3-VL-4B-Instruct** (Apache-2.0), QLoRA via **Unsloth** → merge → GGUF **Q4_K_M + mmproj** |
| Serving | **llama.cpp `llama-server`** (OpenAI-compatible, multimodal `image_url`, JSON-schema output) |
| Training | DO GPU Droplet `gpu-rtx4000x1-20gb` TOR1, **$0.76/hr**, spin up per run |
| Backend | **Rust + axum**, CPU Droplet in TOR1, private VPC to GPU box |
| Frontend | **Vite + Preact + TypeScript**, hand-rolled CSS (no Tailwind), PWA |
| Language | English (structure allows ES later) |
| V1 scope | 3 steps + pixel-map landing + **anonymous community feed** (DO Spaces) |

**Core principle:** numbers come from code, judgment comes from the model. Quantities, temps,
and timelines are deterministic Rust/domain logic (testable, offline, free). The model only
does the hard-to-code parts: photo interpretation, prose, situational advice. That keeps the
fine-tune small and the app reliable.

---

## Architecture

```
Preact SPA (App Platform free tier, static)
   │  fetch, multipart image (canvas-downscaled ~1024px JPEG)
   ▼
Rust axum API — Droplet 2vCPU/4GB TOR1 ($24/mo)
   ├─ deterministic: /plan  /fire  /cuts  /cook/timing   (pure functions, unit-tested)
   ├─ model:        /cook/analyze  /advise               (proxy + JSON schema + timeout + cache)
   ├─ feed:         /feed  (Spaces S3: photos, captions, handles, reports)
   ▼
llama-server — GPU Droplet RTX 4000 Ada 20GB TOR1 ($0.76/hr)
   Qwen3-VL-4B Q4_K_M.gguf + mmproj-f16.gguf, --jinja, api-key, firewall = API IP only
```

Dev fallback: `llama-server` also runs on the CPU Droplet or a laptop (4B Q4 = 2.5 GB) so the
app is fully wired before any GPU is rented.

---

## Repo layout

```
asado-maker/
├── app/                 # Vite + Preact + TS (the PWA)
│   └── src/{screens,components,styles,lib,stores}
├── api/                 # Rust workspace crate (axum)
│   └── src/{routes,domain,model_client,feed,ratelimit}
├── ml/
│   ├── notebooks/       # unsloth train.ipynb, merge+quantize.sh
│   ├── eval/            # golden questions + scoring script
│   └── scripts/         # pdf_extract.py, chunk.py, synth_pairs.py, caption.py
├── docs/
│   ├── DATASET.md       # the PDF→dataset guide
│   ├── DEPLOY.md        # DO droplets, firewall, systemd
│   └── DESIGN.md        # design tokens + component rules
└── data/ (gitignored)   # raw pdfs, extractions, jsonl
```

---

## Phases

### Phase 1 — Scaffold + design system
- Monorepo, `cargo` + `pnpm`, CI (clippy/fmt, tsc, vitest), `.env.example`.
- `docs/DESIGN.md`: tokens — ember `#FF6B1A`, yolk `#FFC93C`, carne `#C1463F`,
  flame-red `#E8483B`, ink `#14100C`, bone `#FFF4E2`.
- Components per brief: **0px radius, 3px ink borders, hard 6px offset shadows, no blur**;
  oversized condensed headings (Archivo Black); monospace labels+nav (JetBrains Mono);
  buttons invert on `:active` (press = shadow collapses to 0).
- Mobile-first: 360px base, `clamp()` type scale, thumb-reach bottom nav, safe-area insets.

### Phase 2 — App shell: pixel map + 3-step wizard
- **Landing:** 8-bit South America map (`image-rendering: pixelated`), colorful square
  markers = regional grill styles (Quebracho/Córdoba, Patagonian cordero, Uruguayan
  parrilla, Chivito, Asado a la estaca) → tap = style card → "Start" enters wizard.
- **Step 1 — Meat:** steppers for people, appetite (light/normal/heavy), achuras on/off,
  kids count, cut preferences, lb/kg toggle. Output: shopping list w/ per-cut lbs, cook
  order, budget note. Offline-capable.
- **Step 2 — Fire:** fuel selector (wood / charcoal / gas). Backwards timeline from serving
  time (fire build ~35 min, coal ready ~45 min), ember-readiness checklist, heat-zone
  diagram (pixel grid), fuel calculator (quebracho kg/hour).
- **Step 3 — Cook:** per-cut cards — prep, target internal temps, doneness signals (juice
  color, press test, fat rendering), rotate/take-out rules, rest + carving.
  **`Take a photo`** → `<input capture="environment">` → canvas resize → analyze.
  Live timers with per-cut state (raw → searing → flip → rest).
- State in a Preact signal store + `localStorage`; PWA manifest + SW (steps 1–2 offline).

### Phase 3 — Rust API with mocked model
- axum routes implementing the contract below; deterministic domain module with
  table-driven tests (e.g. 8 adults heavy + achuras → expected lbs).
- `model_client`: `reqwest` → OpenAI endpoint, **JSON-schema response_format**,
  25s timeout, 1 retry, per-IP rate limit, in-memory response cache.
- Mock mode (`MODEL_URL` unset) returning canned structured JSON → UI testable with zero model.
- Community feed: `POST /feed` (multipart: auto handle `ember-fox-42`, photo, cut tag,
  caption) → Spaces; `GET /feed?cursor=`; `POST /feed/:id/report`. Client-side compression
  + EXIF strip. Manual moderation via Spaces.

### Phase 4 — Dataset pipeline (`docs/DATASET.md` + `ml/scripts`)
1. **Acquire** — buy/scan/OCR books; keep private, never redistribute.
2. **Extract** — `pymupdf4llm` → Markdown; `ocrmypdf` for scans; embedded figures →
   `data/images/` with page provenance.
3. **Clean** — dehyphenate, strip headers/footers, language filter, MinHash dedup.
4. **Chunk** — by recipe/section (512–2048 tok), keep source page id.
5. **Synthesize instruction pairs** — 8 task types: quantity-for-N, fire setup by fuel,
   doneness judgment, rotate/troubleshoot, timing, cut glossary, shopping list, tips.
   Target **~8–15k pairs**.
6. **Images** — book photos captioned by base Qwen3-VL + 10% human check; plus
   **~1–2k self-shot grill photos** labeled with doneness stage + flip/no-flip
   (the critical capability; bootstrap with base model, verify by hand).
7. **Format** — Unsloth/LLaMA-Factory multimodal ShareGPT JSONL, 95/5 split, golden set.
8. **Train** — Unsloth QLoRA (4B ≈ 6 GB VRAM, 1–3 h on the $0.76/hr droplet),
   `merge → llama-quantize Q4_K_M → convert mmproj`.
9. **Evaluate** — `ml/eval`: 100 golden prompts scored on JSON validity, temp correctness
   vs code tables, flip-advice sanity; base vs tuned diff. Gate: ship only if it beats base.
10. **Iterate** — failures become new pairs; version adapters `v0, v1…`.

### Phase 5 — Model integration + deploy
- systemd unit for `llama-server` on GPU droplet, `--api-key`, firewall restricted to API
  droplet IP; **destroy (don't power off)** the GPU box when idle — power-off still bills.
- Wire `/cook/analyze`: image → base64 `image_url` → schema
  `{sear, fat_render, doneness_est, action: flip|hold|move_to_low|pull, minutes, confidence, tip}`.
- `docs/DEPLOY.md`: `doctl`/terraform scripts for droplets, VPC, Spaces, DNS, TLS.
- Cost ladder: **dev $24/mo** (API droplet + CPU llama-server) → **prod +$0.76/hr GPU only
  while active** → later DOKS GPU pool scale-to-zero if traffic grows.

### Phase 6 — Polish + eval pass
- Accessibility (contrast on fire palette, focus rings, reduced-motion), Lighthouse ≥ 95
  mobile, real-device camera test (iOS Safari `capture` quirks).
- Food-safety disclaimer on temps; AI-disclosure note where the model speaks.

---

## API contract (frozen in Phase 3)

```jsonc
POST /api/plan        {people, appetite, achuras, kids, cuts[], unit} → {items:[{cut, qty, note}], order[], total_lb}
POST /api/fire        {fuel, servings, cuts[], ready_by}              → {steps[], timeline[], fuel_kg, checklist[]}
POST /api/cook/timing {cut, thickness_mm, style}                      → {prep, temps[], rotate_rule, signals[], rest_min}
POST /api/cook/analyze multipart {image, cut, elapsed_min, fuel}      → {sear, doneness_est, action, minutes, confidence, tip}
GET  /api/styles      → regional grill styles (map markers)
GET/POST /api/feed    → community posts
```

---

## Risks / open calls
- **Photo doneness is the hard problem** — no off-the-shelf dataset; the 1–2k labeled-photo
  effort (DATASET.md step 6) is the real critical path.
- **Vision GGUF**: mmproj stays FP16/Q8 — fine, expect a few hundred ms image prefill.
- **Feed abuse**: anonymous + rate limit + report + manual review; revisit auth if it grows.
- **GPU billing footgun**: destroy, never power off.

## Cost ladder
| Stage | Cost |
|---|---|
| Dev (CPU droplet + static) | ~$24/mo |
| Training run | $0.76/hr × 1–3 h |
| Prod with GPU active | +$0.76/hr while serving |
| Later: DOKS scale-to-zero GPU | pay only while warm |
