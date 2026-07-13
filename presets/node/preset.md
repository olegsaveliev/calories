# Preset: node

A Node / TypeScript app or library. ESLint + Vitest, tests grow per feature.

## Files this preset installs (when `/setup` applies it)
- `.github/workflows/ci.yml` → the `ci.yml` in this folder (install → lint → test on push/PR)
- `package.json` scripts: `"lint": "eslint ."`, `"test": "vitest run"`
- `tests/` → a starter `*.test.js`/`*.test.ts`
- dev deps: `eslint`, `vitest` (+ `typescript` if TS)

## Engineering-skill rules for this stack
- Small, single-purpose modules; type hints / TS types on public functions.
- Every feature adds its test(s) under `tests/` (Vitest).
- No new *runtime* dependency without an ADR; dev deps (test/lint) are fine.
- Keep the public API stable — a breaking change needs an ADR.

## Local commands
```
npm install
npm run lint
npm test
```
