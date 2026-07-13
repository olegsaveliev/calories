# 003 — Redesign ("Midnight Lime") — Design / Approach Note

> Step 3 (architecture). Short approach + which ADRs govern. Behaviour/visual source of truth:
> `design_handoff_calories_lime/README.md`. State/AC source of truth: `20-stories-acs.md`.
> **This is a frontend-only visual/structural rebuild of `src/index.html`. No server, contract, or
> dependency change.**

## Verdict up front
- **No `30-options.md` / no human pick needed.** There is no real fork here (see "Framework?" below).
- **No new ADR.** Every choice this step makes is reversible (single-file view toggle, inline CSS,
  neutral placeholders, font `<link>`) — none clears the two-part ADR bar (hard to reverse AND likely
  to be questioned). Declining a dependency needs no ADR (same reasoning as ADR-001/002).

## ADRs in force (reused, not re-decided)
- **ADR-001 (one Node service, vanilla, no framework/build tool).** Holds. The handoff *suggests*
  "pick a framework (React/Vue…) or choose one if none exists." **We decline.** Two screens plus a
  5-state machine (`idle → selected → estimating → done | error → idle`) driven by DOM
  show/hide is trivially done in ~1 file of vanilla JS; a framework/build tool would add a toolchain,
  a dependency, and a build step for zero structural benefit. ADR-001 stands unchanged — no new ADR is
  needed to *decline* a dependency.
- **ADR-002 (raw-binary `POST /upload`, MIME in `Content-Type`).** Holds and is preserved verbatim —
  the new CTA fires the same `fetch('/upload', { method:'POST', body:file, headers:{'Content-Type':…} })`
  the current page already uses.

## Framework? — No (why this is not a fork)
Applying the options-doc bar (≥2 viable approaches with materially different trade-offs): a framework is
not viable-competitive here — it loses on every axis (adds a dep + build tool ADR-001 forbids, more code,
slower, no benefit at this size). One sensible approach only ⇒ no `30-options.md`, no STOP. Vanilla holds.

## Decisions this step settles

### 1. Two screens in ONE `src/index.html` — single-document view toggle
Both screens are sibling sections in one document (e.g. `<section data-screen="pick">` and
`<section data-screen="result">`); a single `render()` reads one `status` variable
(`idle|selected|estimating|done|error`) and toggles which section/sub-state is visible (via the `hidden`
attribute / a `data-state` on a root wrapper + CSS). One in-memory model:
`{ status, file, previewUrl, calories }`. No router, no hash routing, no history entries — the transitions
are pure in-page state changes.
- **Why single-document, not two files:** `src/server.js` serves static content on **only** `GET /` and
  `/index.html`, both reading the one `INDEX_HTML_PATH` file — there is **no generic static-file route.**
  A second HTML/CSS/JS document would require adding a server route, i.e. touching the backend, which is
  out of scope (frontend-only rebuild) and would reopen ADR-002-adjacent server surface. One file keeps
  this feature a pure edit of one eslint-ignored frontend file.
- **State-machine mapping (from `20-stories-acs.md`):** file pick → `selected` (CTA enabled); CTA →
  `estimating` (loading, single in-flight request — guard against double-submit, AC2.2); response →
  `done`/`error`; "New photo" / back chevron / (on error) "Try again" → `idle` / re-`estimating`. Reset
  clears `file`/`previewUrl`/`calories` and revokes the preview object URL (AC5.1).

### 2. New CSS + design tokens live INLINE in `src/index.html`
A single inline `<style>` block; the Midnight-Lime tokens become CSS custom properties on `:root`
(`--bg:#0A0B0D; --accent:#C6FF3D; --accent-hover:#D6FF6B; --text:#F5F7FA; --muted:#8A9099;
--dim:#6B7280; --dim2:#7D838C; …` plus the hairline/surface/accent-tint rgba tokens and the radius scale).
- **Why inline, not a `.css` file:** same reason as (1) — no static-asset route exists to serve a separate
  file without a server change. Inline matches the current pattern and stays within ADR-001's one-service
  shape. `src/index.html` is in the ESLint `ignores` list (`eslint.config.js`), so the inline `<script>`
  is not held to the Node source lint rules — no lint friction from a larger frontend script.
- Keep the existing **`textContent`-only** rendering discipline for any model-derived/dynamic text (the
  hero number, error copy) — do NOT introduce `innerHTML` for response data. This preserves the 001 XSS
  posture; static chrome markup may be authored as HTML literally in the file.

### 3. Server response → Result view (NO server/API change)
The `POST /upload` contract is untouched: `{ ok, size, type, calorieResult }` with `calorieResult` one of
`{status:"estimated",calories}` / `{status:"no_food"}` / `{status:"unavailable"}`. Frontend mapping:

| Response | State | Result view |
|---|---|---|
| `200` + `calorieResult.status === "estimated"` | `done` | Hero number = `calorieResult.calories` under the "ESTIMATED" eyebrow; thumbnail = the submitted photo (AC3.1). |
| `calorieResult.status === "no_food"` | `error` | Inline "couldn't identify a meal in that photo" — **no number**, "Try again" (AC4.1). |
| `calorieResult.status === "unavailable"` / non-200 / network/timeout / unparseable | `error` | Distinct inline "couldn't estimate calories — try again" — **no number** (AC4.2). |
| `415` (type bypassed client guard) | `error` | Honest "unsupported file type" message; server 415 path from 002 stays authoritative (AC7.2). |

The hero number NEVER renders a value that didn't come from the current response's
`calorieResult.calories`; on any error the number area is cleared, so photo-B's failure can't show
photo-A's stale number (AC4.4). **Confirmed: the vision call, model tier, structured-output contract,
rate-limit, plausibility band, and every error path are backend concerns and are unchanged — this
feature edits only the frontend.**

### 4. Neutralising the not-yet-available (feature 007) fields — honest, never faked
The mock shows demo values we do NOT produce today. Concrete default (AC3.2 permits omit **or** explicit
neutral placeholder — final visual polish is the ux-design step's call):
- **Food-name pill** (mock "🥗 Grilled chicken bowl"): **OMIT** from the DOM. An empty overlaid pill reads
  as broken; there is no honest neutral value to put in it.
- **± range** (mock "calories · ± 70"): render the label as **"calories"** only — **drop the "± NN"**
  segment. We have no uncertainty range; showing one would be fabricated.
- **The two stat tiles** (mock "3 / items seen", "High / confidence"): keep the two-tile row for layout
  fidelity but render each value as a neutral em-dash **"—"** with its honest label, OR omit the row —
  either is AC-compliant. **Default: render "—".** No hardcoded or computed-looking demo value may ever
  appear. (ux-design may choose to omit the tiles instead if the dashed shell looks worse than a clean
  hero.)

### 5. EXIF / metadata reconciliation — no client-side stripping added; privacy copy stays truthful
- The handoff copy loosely implies **client-side** stripping ("strip EXIF … before sending"). The manifest
  records the real, tested guarantee is **server-side**: `src/strip-metadata.js` strips EXIF/GPS in
  `vision.js` immediately before egress to Anthropic. **This feature adds NO client-side stripping**
  (explicitly out of scope per PRD / AC7.5 — it would be a separate architecture decision, and is not
  required to ship). Server-side stripping remains the enforced guarantee.
- **The privacy-notice copy is truthful as written.** The handoff note — "Sent to Claude to estimate.
  Location & camera metadata stripped first — nothing is stored here." — asserts only that metadata is
  stripped *first* (before egress) and nothing is stored; it does not claim *where* the strip runs.
  Server-side stripping satisfies "stripped first, before it reaches the model." Engineering may adopt the
  handoff wording; the disclosure's substance (photo → Anthropic; metadata removed before egress; nothing
  stored) must not be weakened (AC7.3). Keep the existing `data-testid="privacy-notice"` hook.
- **Optional future note (NOT this feature):** a *client-side* strip could later shrink the R10
  partial-closure exposure (data appended after a JPEG's EOI currently egresses unparsed) by pre-trimming
  before upload. That is a defence-in-depth improvement for a later feature / ADR, not scope here.

### 6. Fonts (Space Grotesk + Manrope) — Google Fonts `<link>`, non-gating
The handoff loads both families from Google Fonts via `<link>`. **This does not breach ADR-001** — a
CSS/font asset `<link>` is not a framework, build tool, or runtime *dependency*; it is a static asset
load. Recommendation: use the Google Fonts `<link>` now for exact fidelity, with a **system-font
fallback stack** in the `font-family` declarations so the UI degrades gracefully if the CDN is
unreachable. This is fully reversible (swap a link), so **no ADR / no options doc.**
- Trade-off noted for the record: a Google Fonts `<link>` adds a third-party origin (leaks the viewer's IP
  to Google). Self-hosting the font files would avoid that but needs a static-asset server route (a backend
  change) — out of this feature's frontend-only scope. Given the app already egresses the photo to a third
  party (Anthropic) and there is no CSP, the font link is an acceptable, reversible choice now; self-hosting
  is a clean-privacy follow-up if desired.

## Hand-forward — what ux-design + engineering must respect
- **Contrast (ux-design to verify/sign off, AC8.5).** The dim tokens are low-contrast-by-design on
  `#0A0B0D`: `#6B7280` (dim, used for "Drag in…", eyebrow, tile labels) and `#7D838C` (dim-2, privacy
  note) are near the WCAG AA 4.5:1 floor for small text (11–13px) — **flagged to measure and remediate if
  they fail.** `#8A9099` muted and `#F5F7FA` primary are safer. The lime `#C6FF3D` hero number on near-black
  is high-contrast (fine). Contrast pass/fail and any token tweak is the ux-design step's call, not decided
  here.
- **Focus visibility (AC8.1).** The current file has no focus styles. Every interactive control
  (dropzone/file trigger, CTA, back chevron, "New photo", "Try again") needs a visible focus indicator —
  do NOT ship `outline:none` without a replacement. A lime focus ring reads on this palette.
- **Tap targets (AC8.4).** Handoff back button + avatar are `34×34` (below ~44×44). Give them a ≥44×44 hit
  area via padding/hitslop while keeping the 34×34 visible glyph.
- **Dropzone must be a real keyboard-operable file trigger (AC8.2).** Use a `<label>`-wrapped
  `<input type="file" accept="image/jpeg, image/png">` (or an input + programmatic click from a focusable,
  Enter/Space-activatable element), not a click-only `<div>`. Narrow `accept` to `image/jpeg, image/png`
  (client UX guard, AC1.4) — the server 415 allowlist remains the authoritative backstop (AC7.2). This also
  closes the manifest's cosmetic `accept="image/*"` debt.
- **Disabled CTA exposed to AT (AC8.3).** Native `disabled` (or `aria-disabled="true"` + tabindex handling)
  in `idle`, not merely styled-inactive-but-clickable.
- **Card frame vs full-viewport (AC6.3/AC6.5).** The 340×720 `40px`-radius phone card is a prototype frame
  only. Real app = full-viewport screens, content centered at a `340–420px` max width; the outer card
  radius may be omitted. ux-design confirms the final framing.
- **Ring animation (AC6.4)** and **loading state (AC2.1)**: `ringPulse` on the 210px ring; during
  `estimating` keep the ring visible (pulsing/indeterminate) with the number area replaced by a
  skeleton/placeholder — no numeric value shown while estimating.
- **Regression guard (Story 7 / AC7.4).** All 001/002 Vitest suites must still pass unmodified; keep the
  `data-testid` hooks the tests/QA rely on (`privacy-notice`, plus add stable testids for the new
  Pick/Result controls). The new frontend surface is E2E-test-pending — QA's step decides test tiering
  (Playwright flagged in the manifest), not this step.

## ADR ledger for this feature
- **ADR-001:** applies, unchanged (vanilla reaffirmed).
- **ADR-002:** applies, unchanged (raw-binary upload preserved).
- **New ADR:** none — all choices above are reversible and don't clear the bar.
