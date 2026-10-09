# ASADO.MAKER

Argentine & Uruguayan BBQ assistant, served as a mobile-first PWA.

Three steps: pick your meat → build the fire → cook it. Snap a photo when it
matters and a fine-tuned 4B vision model reads the grill for you. Retro-computing
meets neo-brutalism: rectangles, hard shadows, poster-paper orange.

## How it works

The platform splits responsibility on purpose:

- **Step 1 — Meat.** Anyone, appetite, achuras on/off, cut preferences, kg or lb.
  Outputs a butcher list with quantities, a cook order, and a budget note.
- **Step 2 — Fire.** Wood / charcoal / gas. A backwards timeline from serving time
  (when to light, when the coals are ready), an ember-readiness checklist, and a
  fuel calculator.
- **Step 3 — Cook.** Per-cut cards: prep, target temps, doneness signals, rotate
  rules, rest + carve. A camera button sends the photo to the model, which judges
  sear and doneness and says **flip / hold / move to low / pull**.
- **Community feed.** Anonymous in-memory posts (photos, cut tags, captions) with
  reporting — rate-limited, holdout for moderation.

**Core principle: numbers come from code, judgment comes from the model.**
Quantities, temperatures and timelines are deterministic domain logic (tested,
offline, free). The model only does what code can't: reading a photo and writing
prose advice. It never computes a number the app doesn't already produce — the
dataset is generated from the shipped API, so the fine-tune can't drift.

```
Preact SPA (Vite, static)
   │  fetch + multipart image (canvas-downscaled ~1024px JPEG)
   ▼
Rust axum API  ──  /plan  /fire  /cook/timing  /cuts   deterministic, tested
   │            └──  /cook/analyze  ──proxy──▶  llama-server (Qwen3-VL-4B)   model
   │            └──  /feed /feed/:id/report                                community
   ▼
Qwen3-VL-4B Q4_K_M + mmproj · JSON-schema output · 25s timeout · rate limit · cache
```

## Tech stack

| Layer | Tech |
|---|---|
| App | Preact 10 · Vite 6 · TypeScript · `@preact/signals` · hand-rolled CSS (no Tailwind) · PWA |
| API | Rust · axum 0.8 · tokio · reqwest (rustls) · tower-http · tracing |
| ML | Python pipeline (snapshot → synth pairs → format) · Unsloth QLoRA on Qwen3-VL-4B-Instruct · llama.cpp `llama-server` (OpenAI-compatible, JSON-schema) |
| Infra | Vite static + axum on DigitalOcean droplets · llama-server on a GPU box · GitHub Actions CI |

## Repo layout

```
app/        Preact + Vite PWA (screens, components, styles, lib, stores)
api/        Rust axum crate — routes, domain, model_client, feed
ml/         Dataset pipeline — snapshot_domain, clean, chunk, synth_pairs, format_dataset, eval, train scripts
docs/       DESIGN.md (design system), DATASET.md (dataset guide)
data/       (gitignored) raw PDFs, extracted text, generated JSONL
```

## Requirements

- Node 26+, pnpm 10.32.1 (the repo pins it via `packageManager`, so Corepack works)
- Rust stable (edition 2024)
- For the ML side: `uv` and Python 3.11+

## Run it

### 1. API

```bash
cd api
cargo run          # listens on 0.0.0.0:4000
```

Without `MODEL_URL` the API runs in **mock mode**: `/cook/analyze` returns a canned
analysis and the app is fully testable with zero model.

```bash
# with a live model server (see below)
export MODEL_URL=http://127.0.0.1:8080/v1
export MODEL_API_KEY=change-me
```

### 2. App

```bash
pnpm install
pnpm dev           # → http://localhost:5173
```

The app works offline (steps 1–2 use inline domain logic; photo analysis falls back
to the mock advisor when the API isn't reachable). For real API calls in dev, serve
the SPA and API behind the same origin (the app calls relative `/api/...`).

### 3. Optional: dev model server

Any OpenAI-compatible multimodal endpoint works — llama.cpp's `llama-server` runs
fine on a CPU-only box or laptop (4B Q4 ≈ 2.5 GB):

```bash
llama-server -m asado-v0-Q4_K_M.gguf --mmproj mmproj-f16.gguf \
  --jinja --api-key "$MODEL_API_KEY" --host 127.0.0.1 --port 8080
```

### 4. ML pipeline (dataset + training)

```bash
cd ml
uv sync --extra dev
uv run python scripts/snapshot_domain.py   # pull facts from the API
uv run python scripts/synth_pairs.py       # 865+ grounded instruction pairs
uv run python scripts/format_dataset.py --in data/synth_pairs.jsonl \
  --golden eval/golden.jsonl --check
uv run python eval/score.py --mock         # 16/16
```

The full guide — extraction from books, captioning photos, training, evaluation
gate — is in [`docs/DATASET.md`](docs/DATASET.md).

## Environment variables

| Var | Default | Purpose |
|---|---|---|
| `MODEL_URL` | unset | llama-server OpenAI base URL; unset = mock mode |
| `MODEL_API_KEY` | — | bearer token for the model server |
| `MODEL_NAME` | `asado-4b` | model id sent to the endpoint |
| `BIND` | `0.0.0.0:4000` | API listen address |
| `RUST_LOG` | `asado_api=info,...` | tracing filter |
| `SPACES_*` | unset | DO Spaces S3 feed storage (not yet wired) |

## Tests & CI

```bash
pnpm test && pnpm typecheck && pnpm build   # app: 19 vitest tests
cargo test                                   # api: 14 unit tests (mock/paths/domain)
uv run pytest                                # ml: 20 pipeline tests
```

GitHub Actions runs all three jobs on every push to `main` (app, api, ml).

## Docs

- [`plan.md`](plan.md) — the authoritative build plan + API contract + cost ladder
- [`docs/DESIGN.md`](docs/DESIGN.md) — design tokens and component rules
- [`docs/DATASET.md`](docs/DATASET.md) — dataset + training pipeline guide

## Notes

- **Photo doneness is the hard problem.** The 1–2k labeled self-shot grill photos
  are the critical path; there is no off-the-shelf dataset for it.
- Safety: cooked temps in the app come with a food-safety disclaimer; the model's
  advice is a helper, not a thermometer.