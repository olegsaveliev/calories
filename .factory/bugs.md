# Bug register

> Every bug is first-class work. Log it here, then fix it with the **`bugfix`** skill (test-first):
> `/bugfix BUG-001`. Flow: log → reproduce → **failing test first** → minimal fix → prove green → close.
> Bugs are out-of-band (not on the roadmap). Mirror to a GitHub Issue with the `bug` label when wired.

## BUG-001 — Dropzone icon + label not centered (label not under the icon)
- **Status:** fixed
- **Found:** 2026-07-13, Pick screen (`src/index.html`), reported from a live screenshot after 003 shipped.
- **Repro:** open the Pick screen. The camera icon tile sits left of centre and the "Add a photo" / "Drag in, or tap to choose" text is not stacked directly under it.
- **Root cause:** `.dropzone` centres its direct children, but the icon + labels live inside `#dropzone-empty`, which had **no layout rule** — a plain block sized to the widest line, so the 64px icon aligned to that block's left edge while `text-align:center` centred only the text. Icon and label therefore looked misaligned.
- **Severity (proposed, human confirms):** minor / cosmetic — layout only; no behaviour, data, or contract affected.
- **Fix / decision:** make `#dropzone-empty` a centred flex column (see build-log 2026-07-13).
- **Guard test:** `tests/upload.test.js` → "BUG-001 — dropzone-empty content is a centred flex column".
- **Note:** guard is a CSS-presence assertion (static-HTML tier; the repo has no browser test — Playwright is queued as roadmap 008). A true rendered-layout assertion belongs to that tier.
- **Issue:** [#11](https://github.com/olegsaveliev/calories/issues/11) · **PR:** #12

<!-- Entry format:
## BUG-001 — <short title>
- **Status:** open | fixed | accepted
- **Found:** <where/when>
- **Repro:** minimal steps
- **Fix / decision:** <what was done, or why accepted>
- **Guard test:** <test name that now covers it>
-->
