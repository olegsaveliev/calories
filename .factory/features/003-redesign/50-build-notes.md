# 003 — Redesign ("Midnight Lime") — Build Notes

> Engineering step. Source of truth followed: `20-stories-acs.md` (ACs/state machine) +
> `30-design.md` (approach/ADR ledger) + `design_handoff_calories_lime/README.md` (tokens/layout).

## What changed

**Files touched:**
- `src/index.html` — **full rewrite**. Two-screen "Midnight Lime" rebuild (Pick + Result) as sibling
  `<section>`s in one document, single in-page state machine, inline `<style>` (CSS custom properties
  for every design token) + inline vanilla `<script>`. No other `src/` file touched — `server.js`,
  `vision.js`, `rate-limit.js`, `strip-metadata.js` and the `POST /upload` contract are byte-for-byte
  unchanged.
- `tests/upload.test.js` — extended/updated the static-HTML shape-assertion blocks only (`GET /
  (served frontend)`, `R10(b)/AC7.3`); every server-behaviour test (upload contract, MIME allowlist,
  rate-limit, metadata-strip, vision-model paths) is untouched. No new test file, no new framework
  (Vitest only, per instructions — Playwright explicitly out of scope this run).
- `.factory/features/003-redesign/50-build-notes.md` — this file.

**No data-model change.** `POST /upload` request/response shapes are identical to 002.

## State machine (implemented exactly as `20-stories-acs.md` specifies)

`idle` (Pick, no file, CTA disabled) → `selected` (Pick, file chosen, CTA enabled) → `estimating`
(Result screen, rings pulsing, skeleton in place of the number, back/New-photo hidden per AC5.4) →
`done` (hero number shown) | `error` (inline message + Try again, no number) → `idle` via "New photo"
or the Result back-chevron; `error → estimating` via "Try again" (re-submits the same in-memory file,
no re-pick required).

One in-memory model (`state`, `currentFile`, `previewUrl`, `calories`, `errorReason`); no router, no
history entries — matches `30-design.md` §1.

## Wiring — only total calories, nothing fabricated

- `calorieResult.status === "estimated"` → `done`, hero number = `calorieResult.calories` exactly
  (rendered via `textContent`, never `innerHTML` — same XSS posture as 001/002).
- `calorieResult.status === "no_food"` → `error`, message "Couldn't identify a meal in that photo."
- `calorieResult.status === "unavailable"`, non-2xx, unparseable body, or a thrown `fetch` (network/
  timeout) → `error`, message "Couldn't estimate calories — try again."
- Feature 007 fields neutralised per `30-design.md` §4, exactly as decided:
  - **Food-name pill: omitted** entirely (no DOM node for it at all).
  - **"± NN" range: dropped** — caption reads "calories" only.
  - **Two stat tiles kept** (layout fidelity) with value rendered as a static, honest **"—"**
    (`data-testid="stat-value-1"`/`"stat-value-2"`), labels "items seen" / "confidence". No hardcoded
    or computed-looking demo number anywhere in the shipped file (verified by a dedicated test — see
    below: no "642", no "Grilled chicken bowl", no "± NN", no "High confidence", no "3 items seen").

## Visual design (Midnight Lime tokens)

All colors/typography/radii from the handoff README applied as CSS custom properties on `:root`
(`--bg #0A0B0D`, `--accent #C6FF3D` / hover `#D6FF6B`, `--text #F5F7FA`, `--muted #8A9099`, `--dim
#6B7280`, `--dim-2 #7D838C`, hairline/surface/accent-tint rgbas, full radius scale). Space Grotesk +
Manrope loaded via Google Fonts `<link>` (per `30-design.md` §6 — a static asset load, not a runtime
dependency; system-font fallback stack included so the UI degrades gracefully offline). Hero number
`76px` Space Grotesk 700 with `font-variant-numeric: tabular-nums`. `ringPulse` keyframe reproduced
exactly (`opacity .35→.9`, `scale 1→1.04`, `3s ease-in-out infinite alternate`) on the 210px ring; the
250px ring is static, both always rendered behind whichever Result sub-state (number/skeleton/error) is
showing. Screens are full-viewport (`min-height:100vh`), content centered at a `300–420px` max width —
the 340×720 phone-card frame from the prototype was **not** shipped (per `30-design.md`/AC6.5, that
frame is design-reference only).

## Accessibility built in (AC8.1–AC8.5)

- **Dropzone (AC8.2):** a real `<input type="file">` (visually hidden but not `display:none`) plus a
  focusable (`tabindex="0"`, `role="button"`) sibling `div` that opens the same file picker on click
  **and** on Enter/Space (`fileInput.click()`), and also handles drag/drop. Narrowed
  `accept="image/jpeg,image/png"` (closes the manifest's `accept="image/*"` cosmetic debt).
- **Disabled CTA (AC8.3):** native `disabled` attribute **and** `aria-disabled` kept in sync — not
  merely styled-inactive.
- **Focus visibility (AC8.1):** `:focus-visible` outline (`2px solid var(--accent)`, offset `3px`) on
  every interactive control; nothing ships `outline:none` without a replacement.
- **Tap targets (AC8.4):** back button and avatar each sit in a `44×44px` hit box (visible glyph stays
  `34×34px` per the handoff); all CTAs are `44px`+ tall.
- **Contrast (AC8.5):** tokens applied exactly as specified (not altered here) — `#6B7280`/`#7D838C`
  dim text is flagged, per the spec, for the dedicated ux-design/accessibility step to measure and
  remediate if needed. Not decided in this step.

## Regression guard (Story 7)

- `POST /upload` request/response contract, the JPEG/PNG-only allowlist, rate-limit, and server-side
  metadata stripping are all untouched — confirmed by running the full existing suite unmodified
  (`tests/vision.test.js`, `tests/rate-limit.test.js`, `tests/strip-metadata.test.js`,
  `tests/calories.test.js`) plus the extended `tests/upload.test.js`.
- Privacy notice (`data-testid="privacy-notice"`) restyled to the handoff's copy while keeping the
  same substance (names Anthropic, states metadata is stripped before egress, states nothing is
  stored) — per AC7.3, the copy may be restyled, the disclosure may not be weakened. The two static
  assertions that pinned the old exact wording (`"metadata are removed"`, `accept="image/*"`,
  `data-testid="send-button"`/`"status"`) were updated to match the new copy/structure — this is the
  legitimate "extend the shape assertions to cover the redesign" work called for by this step, not a
  weakening: the same substance (names the third party / states the strip happens before egress /
  states nothing is stored) is still asserted, just against the new wording and the new
  `estimate-cta`/`hero-number`/`error-message` hooks instead of the retired
  `send-button`/`status` ones.
- No client-side EXIF stripping was added (explicitly out of scope per `30-design.md` §5 / AC7.5) —
  server-side stripping in `strip-metadata.js` remains the sole enforced guarantee.

## Test results

- `npm run lint` — clean (`src/index.html` is in ESLint's `ignores` list, so the inline script/style
  are not linted, per the existing config).
- `npm test` — **73/73 passing** (all pre-existing tests pass unmodified in substance; the frontend
  shape-assertion block was extended with new checks for: both screens present, dropzone-as-file-input
  with narrowed `accept`, CTA disabled-by-default with `aria-disabled`, hero-number/error-message/
  back/new-photo/try-again hooks present, stat tiles rendering literal "—" only, and an explicit
  negative-assertion test that none of the 007 demo values (642 / "Grilled chicken bowl" / "± NN" /
  "3 items seen" / "High confidence" / a food-name DOM hook) appear anywhere in the shipped file).

## Known gap (flagged forward, not resolved here)

- **Frontend behaviour is still not browser-automated (E2E) tested.** This run only extends the
  static-HTML shape assertions (as instructed) — it does **not** add Playwright or any new test
  framework. The click→select→estimate→render flow (all 5 states, drag-drop, keyboard activation,
  the double-submit guard, and the visual ring/skeleton animations) has been reasoned through and
  manually smoke-tested (served-HTML fetched and inspected via a throwaway Node script during this
  build), but is not covered by an automated browser test. This was already flagged in the manifest
  as a pending QA/test-tier decision before 003 and remains open; QA's step should rule on whether
  Playwright is now warranted given the redesign adds real interaction complexity (drag-drop,
  keyboard dropzone activation, animated states) beyond what 001/002 shipped.
