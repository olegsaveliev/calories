# 003 — Redesign ("Midnight Lime" UI rebuild) — PRD

## Summary

Calories' current frontend (`src/index.html`) is a plain single-page file picker + text result
left over from the 001/002 prototype; this feature rebuilds it — visually and structurally, not
behaviourally — into the "Midnight Lime" two-screen experience specified in
`design_handoff_calories_lime/README.md`: a **Pick** screen (logo header, "Snap it. Count it."
heading, a dashed dropzone that doubles as the file-input target with preview-on-select, a
privacy note, and an "Estimate calories" CTA disabled until a photo is chosen) that transitions
through a visible loading state into a **Result** screen (back header, the user's own photo
thumbnail, an animated-ring hero block showing the total-calorie number in large tabular Space
Grotesk numerals, two stat tiles, and a "New photo" CTA that resets back to Pick) — or, on
failure, an honest inline error state with a retry affordance instead of any number. The rebuild
wires only the one datum the backend actually produces today (`calorieResult.calories` from the
existing, unchanged `POST /upload` contract); every other field the design mock shows with demo
values (food-name pill, ± range, items-seen, confidence) is either omitted or rendered as an
explicit neutral placeholder — never faked — because that data belongs to feature 007. The
rebuild stays inside the vanilla HTML/CSS/JS stack (ADR-001, no framework or build tool) and must
not alter the raw-binary upload contract, the server-side JPEG/PNG allowlist, the server-side
metadata stripping, the fail-closed error rendering, or the privacy notice already delivered in
001/002 — all of which existing tests continue to enforce.

## Out of scope

- **Food-name pill, confidence tile, items-seen tile, ± calorie range** — the Result mock shows
  these with demo values; this feature is explicitly forbidden from faking them. They render
  neutral/empty or are omitted entirely until feature 007 ("Food ID + confidence") produces real
  data.
- **Portion adjuster UI** — feature 004.
- **Camera capture / drag-and-drop as a distinct, separately-scoped interaction** — feature 005
  covers deeper camera/drag-drop work; this feature only implements the dropzone's basic
  click-to-pick and drop-to-select behaviour already described in the handoff (single file,
  JPEG/PNG), not camera capture (`capture` attribute / getUserMedia) or advanced drag affordances.
- **Shareable result card** — feature 006.
- **Any new server route, response field, or change to the `POST /upload` request/response
  contract** — this is a frontend-only visual/structural rebuild; the backend (`src/server.js`,
  `src/vision.js`, `src/rate-limit.js`, `src/strip-metadata.js`) is unchanged.
- **A framework or build tool adoption** — stays vanilla per ADR-001; not this BA spec's call to
  reopen, and not needed for this scope.
- **Client-side EXIF/GPS stripping** — the handoff's copy loosely implies client-side stripping,
  but the existing, tested guarantee is server-side (`src/strip-metadata.js`). Duplicating it
  client-side (or moving it) is an architecture decision, not part of this spec, and is not
  required for this feature to ship.
- **New automated visual/E2E test tooling decisions** (e.g. adopting Playwright) — flagged as a
  manifest known-gap; the QA step decides test tiering, not this spec.
- **Any change to the rate-limit, plausibility-band, or model-tier decisions from 002** — untouched
  by this rebuild.
- **Contrast remediation and final tap-target sizing sign-off** — this spec's ACs flag where
  contrast/tap-target checks are needed (Story 8), but the pass/fail call and any resulting token
  tweaks belong to the dedicated ux-design pipeline step, per `00-feature.md`.
- **Accounts, history, macro breakdown** — excluded per `PROJECT.md` non-goals; unaffected by this
  visual rebuild.
