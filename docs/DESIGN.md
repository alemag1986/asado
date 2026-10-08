# DESIGN — ASADO.MAKER

Retro-computing × playful neo-brutalism. An indie technology festival poster brought to the
web: nostalgic, energetic, approachable, community-focused. Everything is built from fire,
meat, and poster paper.

## Rules (non-negotiable)

1. **0px border radius.** Rectangles only — buttons, cards, inputs, images, the map.
2. **3px ink outlines** (`--ink`) on every structural element. 2px for inner dividers.
3. **Hard offset shadows** (`6px 6px 0`, no blur, no opacity). Press = shadow collapses:
   `:active { transform: translate(6px,6px); box-shadow: 0 0 0 }`.
4. **No gradients, no blurs, no soft grays, no rounded "SaaS cards".**
5. Motion only where it answers a tap (press, step change). Respect `prefers-reduced-motion`.

## Color

| Token | Hex | Role |
|---|---|---|
| `--ink` | `#14100C` | outlines, text, terminal panels, nav bar |
| `--bone` | `#FFF4E2` | poster paper — app background |
| `--paper` | `#FFFBF3` | raised surface (cards) |
| `--ember` | `#FF6B1A` | primary orange — main actions, active step |
| `--yolk` | `#FFC93C` | yellow — keys, labels on dark, map markers |
| `--carne` | `#C1463F` | meat red — secondary accent, focus ring |
| `--flame` | `#E8483B` | light red — urgency, alerts, "pull it" |
| `--ash` | `#201811` | dark panel — terminal surfaces |
| `--coal` | `#7A2E12` | deep crust — quiet accents (units, fine print) |

One bold moment per screen; the rest stays paper and ink.

## Type

| Role | Family | Notes |
|---|---|---|
| Display / headings | **Anton** | oversized, heavy, condensed, uppercase, `line-height: 0.92` |
| Body | **Archivo** 400/700 | max line length `--max-read` (42rem, ~70ch) |
| Nav, labels, data | **JetBrains Mono** 400/700 | uppercase, `letter-spacing: .04–.06em`, terminal voice |

Scale is fluid (`clamp()`), mobile-first from 360px:
`--text-display` 3.5→6.5rem · `--text-h1` 2.25→3.75rem · `--text-h2` 1.5→2.25rem ·
`--text-body` 1→1.125rem · `--text-mono` .8125rem.

Headlines are content, not decoration: big Anton words carry the poster. Mono labels are
**functional** — steps, units, status — never decorative eyebrows.

## Structure

- Single column, `max-width: 560px`, centered; left-aligned text.
- Fixed bottom nav (`--nav-h: 64px`, safe-area aware): ink bar, bone dividers, active cell
  fills ember.
- `.panel` / `.card` = paper + 3px ink + 6px shadow. `.card--dark` = ash + bone text with
  a yolk label strip welded to the top edge (`.card__label`).
- `.term` = mono status line, the app's system voice (`system ready — fire, meat, smoke`).
- Step numbers appear only where content is a real sequence (the 3 steps).

## Components

- `Button` — mono uppercase, 48px min height, variants `primary` (ember) / `secondary`
  (yolk) / `dark` (ash) / `danger` (flame), optional `block`.
- `Card` — optional `label` strip, `tone` paper|dark.
- `Stepper` — label left, key/readout/key group right: yolk keys, boxed mono readout,
  unit in `--coal`, ±44px hit targets, clamped values, `aria-live` output.
- `Nav` — bottom step navigation (`01 MEAT · 02 FIRE · 03 COOK`).

## Accessibility

- Focus ring: 3px `--carne` (yolk inside dark panels), 2px offset — always visible.
- Hit targets ≥ 44px. Contrast pairs checked against ink/bone, ash/bone, ink/ember, ink/yolk.
- Reduced motion kills all transitions. `aria-current` on nav, `aria-live` on quantities.

## Assets

- Pixel art only: `image-rendering: pixelated`, square units, palette limited to tokens.
- The world map (Phase 2) is a grid of colored squares — early-computer graphics, 8-bit
  games — with square markers per regional grill style.
- Fonts self-hosted via `@fontsource` (no external CDN).
