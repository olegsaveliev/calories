# Preset: web-vanilla (DEFAULT, active)

One `src/index.html`, plain HTML/CSS/JS, **no build step, no runtime dependency**. Dev-only test tooling.

## Files this preset owns (already active at repo root)
- `.github/workflows/ci.yml` — lint + Playwright on push/PR
- `package.json` (dev deps: `@playwright/test`), `playwright.config.js`
- `tools/lint.mjs` — dependency-free syntax + HTML-skeleton check
- `tests/regression.spec.js` — Playwright suite (grows per feature)

## Engineering-skill rules for this stack
- Ship one `index.html` (markup + CSS + JS inline); **no framework, no build, no runtime dependency.**
- Render user text with `textContent` (never `innerHTML`) — injection-safe.
- Every feature adds its test(s) to `tests/regression.spec.js`.
- Keep test hooks stable: prefer `data-testid` attributes on elements the tests target.

## Local commands
```
npm install
npm run lint        # node tools/lint.mjs
npm test            # playwright test  (npx playwright install chromium once)
```
