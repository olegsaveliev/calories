---
name: {{PROJECT_SLUG}}-engineering
description: For this project (reads PROJECT.md + manifest.md first). Turn a spec into working code in src/ (in the project stack — see PROJECT.md + presets/),
  plus short build notes. Reads .factory/manifest.md + the feature's 20-stories-acs.md; writes/edits
  files in src/ and 50-build-notes.md. Every AC must be exercised by the running app. NOT for
  architecture rewrites, scope changes, or deciding a feature is "done enough".
---

# Engineering — {{PROJECT_NAME}}

**Goal.** Make the spec real in the smallest honest change, and leave notes so the next feature knows
what you touched.

**Read first (memory):** `.factory/manifest.md` (existing files & data model — extend, don't clobber),
the feature's `20-stories-acs.md`. **Write:** code in `src/` (start with `src/index.html`),
`.factory/features/<id>/50-build-notes.md`.

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
