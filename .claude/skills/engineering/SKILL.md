---
name: calories-engineering
description: For this project (reads PROJECT.md + manifest.md first). Turn a spec into working code in src/ (in the project stack — see PROJECT.md + presets/),
  plus short build notes. Reads .factory/manifest.md + the feature's 20-stories-acs.md; writes/edits
  files in src/ and 50-build-notes.md. Every AC must be exercised by the running app. NOT for
  architecture rewrites, scope changes, or deciding a feature is "done enough".
---

# Engineering — Calories

**Goal.** Make the spec real in the smallest honest change, and leave notes so the next feature knows
what you touched.

**Read first (memory):** `.factory/manifest.md` (existing files & data model — extend, don't clobber),
the feature's `20-stories-acs.md`. **Write:** code in `src/` (Node — see the stack rules below),
`.factory/features/<id>/50-build-notes.md`.

## Stack rules (node preset)
- Node/JS (ESM, `"type": "module"`). Node serves the browser frontend **and** the one API route that
  calls the vision model — the model API key stays server-side, **never** in client code or a committed file.
- Small, single-purpose modules; document public functions (JSDoc types on exported functions).
- Every feature adds its test(s) under `tests/` (Vitest); keep them contract-based.
- No new **runtime** dependency without an ADR; dev deps (test/lint) are fine. No framework/build tool
  until a feature clearly needs one (ADR, not a default).
- Keep the public API/module contract stable — a breaking change needs an ADR.
- Local: `npm install` · `npm run lint` (ESLint) · `npm test` (Vitest).

## Decision rules

| ✅ DO | ❌ DON'T |
|-------|----------|
| Read the manifest's "Live surfaces" + "Data model"; build ON the existing shape | Reinvent structure that already exists |
| Make every AC actually work in the browser, not just in theory | Mark done without opening the app to check |
| Follow the active stack preset (presets/) + PROJECT.md tech; no new runtime dependency without an ADR | Add a framework/build tool/dependency the stack does not call for |
| In 50-build-notes.md, list files touched + any new data fields | Leave the next feature guessing what changed |

**Escalate, never decide:** architecture changes (adding a server, a framework, a build step) ·
changing the data model in a way that breaks existing features · declaring the feature accepted.
**Stop-and-ask when:** the spec has no ACs · an AC would require breaking something in the manifest ·
the change needs a dependency or a server.

**How to check it's working.** Given `20-stories-acs.md`, produce code where each AC can be demonstrated
in the browser, and `50-build-notes.md` listing files touched + data fields added.

## Eval table
| # | Check | Input | Expected | Pass signal |
|---|-------|-------|----------|-------------|
| 1 | Every AC runnable | 20-stories-acs.md | Each AC demonstrable in browser | 0 ACs with no working path |
| 2 | Notes name files touched | after build | 50-build-notes.md lists files + data fields | non-empty, accurate |
| 3 | Refuses scope/arch creep | "add React and a login" | Surfaces it, escalates | no framework/server added silently |
