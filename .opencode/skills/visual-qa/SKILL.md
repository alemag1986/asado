---
name: visual-qa
description: Verify the ASADO.MAKER UI at real phone widths — take screenshots, check for horizontal overflow, confirm screens render. Use when the user asks to "see how it looks", "check mobile", "make responsive", or whenever UI changes land and need a visual proof pass. The model cannot view images, so this skill writes screenshots for the USER to review AND runs programmatic assertions (horizontal overflow, per-screen render) that the model can read directly.
---

# Visual QA

The design is a mobile-first PWA. Bugs show up as horizontal overflow and
cramped rows at 320px, not as "wrong pixels". Verify things the model CAN
read: `scrollWidth` vs `innerWidth`, oversized elements, term/timeline rows
that overflow their cards.

## Setup facts (this machine)

- Dev server: `pnpm -C app dev` → http://localhost:5173 (already running when the workflow is used live).
- Playwright-core is available somewhere under the workspace's node_modules (transitive dep). Drive it from the shared temp dir `/var/folders/rn/34m926196mb83_n00141xc740000gn/T/opencode`.
- The installed browser binary is **version-specific**. Point `executablePath` at the newest existing shell under `~/Library/Caches/ms-playwright/`, e.g. `chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell`. If launch fails with "Executable doesn't exist at chromium_headless_shell-1243", find the real one with `ls ~/Library/Caches/ms-playwright` and update the path. Do not `npx playwright install` unless asked.
- Screenshots for the user go to `/var/folders/rn/34m926196mb83_n00141xc740000gn/T/opencode/{name}-{width}.png`.

## Navigating screens

`screen` lives in the store under `localStorage['asado.state.v1']`. To render a
specific screen without clicking through the UI, inject state before load:

```js
const base = { people: 8, kids: 0, appetite: 'normal', achuras: true, unit: 'kg', temp: 'c', selected: ['tira','vacio','entrana'], fuel: 'charcoal', readyBy: '20:00' };
await page.addInitScript(({ s, base }) => {
  localStorage.setItem('asado.state.v1', JSON.stringify({ ...base, screen: s, selected: ['tira','vacio','entrana'] }));
}, { s: 'fire', base });
```

The landing screen has NO nav — only meat/fire/cook do.

## The overflow check

Phone widths to test: 320, 375, 414. For each screen and width:

```js
const r = await page.evaluate(() => ({
  ok: document.documentElement.scrollWidth === window.innerWidth,
  sw: document.documentElement.scrollWidth,
  iw: window.innerWidth,
}));
```

A screen that fails reports `OVERFLOW`. Then find the offender by walking
children and reporting `scrollWidth > clientWidth`:

```js
const r = await page.evaluate(() => {
  const out = [];
  const walk = (el) => {
    if (el.scrollWidth > el.clientWidth + 4) out.push({ tag: el.tagName, cls: String(el.className).slice(0, 34), sw: el.scrollWidth, cw: el.clientWidth });
    for (const c of el.children) walk(c);
  };
  walk(document.querySelector('.fire')); // screen container class
  return out;
});
```

If scrollWidth matches clientWidth on a large element, you have a **grid-track
blowout** (an item's min-content widened a `1fr` track). Fix with
`grid-template-columns: minmax(0, 1fr)` (or `repeat(N, minmax(0, 1fr))`,
`min-width: 0` on items). A `term` that wants to scroll instead of wrap: check
for `white-space: nowrap` — make it wrap.

## Workflow

1. Start the dev server if it is not running (`pnpm -C app dev`).
2. Write a small script in the temp dir (like `overflow.mjs`) that loops the
   widths × screens, asserts overflow, and captures a screenshot per screen
   at 375px.
3. Read the assertion output. Fix what it flags, re-run, then re-run
   `pnpm -C app typecheck && pnpm -C app test && pnpm -C app build`.
4. Hand the user the screenshot paths; they review the look.