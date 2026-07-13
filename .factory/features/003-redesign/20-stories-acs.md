# 003 — Redesign ("Midnight Lime" UI rebuild) — Stories & Acceptance Criteria

> Source of truth for behaviour/visuals: `design_handoff_calories_lime/README.md`.
> Source of truth for what's already built and must not break: `.factory/manifest.md`.
> Scope is CONFIRMED in `00-feature.md` — this document does not reopen it.

**State machine (all stories below are framed against this):**
`idle` (Pick, no file) → `selected` (Pick, file chosen, CTA enabled) → `estimating` (loading) →
`done` (Result, number shown) | `error` (Result-shaped, message shown, no number) →
back to `idle` via "New photo" or the Result back button.

---

## Story 1 — Pick screen: pick a photo before I can estimate

**As** a user opening the app, **I want** a Pick screen with a clear dropzone and disabled CTA
**so that** I can't accidentally submit before choosing a photo.

- **AC1.1 (happy path — idle render).** Given the app loads with no photo chosen, when the Pick
  screen renders, then it shows: logo lockup + avatar placeholder in the header, heading "Snap it.
  Count it.", subtext "Pick a food photo and we'll estimate the calories.", the dashed dropzone in
  its empty state ("Add a photo" / "Drag in, or tap to choose"), the privacy note, and the
  "Estimate calories" CTA rendered **disabled** (`disabled` attribute / `aria-disabled="true"`).
- **AC1.2 (happy path — file selected).** Given the Pick screen in `idle`, when the user clicks the
  dropzone (or drags a file onto it) and picks a JPEG or PNG file, then: the dropzone content is
  replaced by a preview thumbnail of the chosen image, state moves to `selected`, and the CTA
  becomes enabled (no `disabled` attribute / `aria-disabled="false"`).
- **AC1.3 (edge — no file, CTA stays disabled).** Given the Pick screen in `idle` (no file chosen),
  when the user attempts to activate the "Estimate calories" CTA (click or Enter/Space while
  focused), then no request is sent and the screen does not transition — the CTA is inert while
  disabled.
- **AC1.4 (edge — wrong file type rejected client-side).** Given the Pick screen in `idle`, when
  the user picks a file that is not JPEG or PNG via the native file picker (input `accept="image/
  jpeg, image/png"`) or drags a non-image / unsupported file onto the dropzone, then no preview is
  shown, state remains `idle`, and the CTA remains disabled — the file is never sent to the server
  for this case. (This is a client-side UX guard; the server's 415 allowlist in AC8.2 is the
  authoritative backstop and must still be reachable if this guard is bypassed, e.g. via devtools.)
- **AC1.5 (edge — replace selection).** Given the Pick screen in `selected` with a photo already
  previewed, when the user picks a different valid photo, then the preview and the in-memory file
  reference are replaced (not appended) and the CTA remains enabled with the new file.

---

## Story 2 — Submitting an estimate: loading state and transition to Result

**As** a user who picked a photo, **I want** to tap "Estimate calories" and see visible progress
**so that** I know the app is working and don't tap twice or think it's frozen.

- **AC2.1 (happy path).** Given the Pick screen in `selected`, when the user taps "Estimate
  calories", then state moves to `estimating` immediately: the app calls the existing `POST
  /upload` with the raw file bytes and its MIME type in `Content-Type` (contract unchanged, see
  Story 8), and a loading state is visible (per the handoff: the ring kept visible with a pulsing/
  indeterminate treatment, number area replaced by a skeleton/animated placeholder — no numeric
  value is shown during `estimating`).
- **AC2.2 (edge — CTA cannot be re-tapped mid-flight).** Given state is `estimating`, when the user
  taps the (now-hidden/Pick-screen) CTA again or otherwise tries to trigger a second submit for the
  same in-flight request, then no second `POST /upload` is issued — at most one request is in
  flight per estimate attempt.
- **AC2.3 (happy path — success transition).** Given state is `estimating`, when the server
  responds `200` with `calorieResult.status === "estimated"`, then state moves to `done` and the
  app navigates to the Result screen showing that photo and that number (see Story 4).
- **AC2.4 (edge — failure transition, no fabricated result).** Given state is `estimating`, when
  the server responds with anything other than a usable `estimated` result (network error, non-200
  status, `calorieResult.status === "no_food"`, `calorieResult.status === "unavailable"`, or a
  response that fails to parse), then state moves to `error` — never `done` — and no calorie number
  is displayed (see Story 5).

---

## Story 3 — Result screen: wire the one real datum, never fake the rest

**As** a user who got an estimate, **I want** to see the calorie number the app actually computed
**so that** I can trust what I'm shown — and never see numbers the app didn't produce.

- **AC3.1 (happy path).** Given state is `done` with `calorieResult = { status: "estimated",
  calories: N }`, when the Result screen renders, then the hero number shows exactly `N` (Space
  Grotesk, tabular numerals per tokens) under the "ESTIMATED" eyebrow label, and the photo
  thumbnail shows the actual submitted photo (not a placeholder gradient).
- **AC3.2 (scope guard — unimplemented fields never fabricated).** Given state is `done`, when the
  Result screen renders, then the food-name pill, the "± NN" range under the total, the
  items-seen tile, and the confidence tile — all of which the design mock shows as demo values
  (642 kcal / "🥗 Grilled chicken bowl" / "3 items seen" / "High confidence") — are each either (a)
  omitted from the DOM entirely, or (b) rendered as an explicit neutral/empty placeholder (e.g. an
  em dash "—" or a "not available yet" label). No hardcoded demo value and no computed-looking
  fake value for these fields may ever render.
- **AC3.3 (edge — no calories value, no render).** Given state is `done` is only reachable when
  `calorieResult.status === "estimated"` (per AC2.3/AC2.4), confirm by inspection that there is no
  code path where the hero number area renders a non-`no_food`/non-`unavailable` numeric value that
  did not come from the current response's `calorieResult.calories`.
- **AC3.4 (happy path — new-photo control present).** Given state is `done`, when the Result
  screen renders, then the "New photo" secondary CTA and the back-chevron header are both visible
  and enabled.

---

## Story 4 — Result screen: honest error state (no number, ever)

**As** a user whose estimate failed, **I want** a clear error message instead of a fake or blank
number **so that** I never mistake "it broke" for "here's your calorie count."

- **AC4.1 (happy path — no_food).** Given state is `error` because `calorieResult.status ===
  "no_food"`, when the Result-shaped error view renders, then it shows an inline message
  distinguishing "couldn't identify a meal in that photo" (not a generic failure), no hero number,
  and a "Try again" affordance — the photo thumbnail of the submitted image is still shown.
- **AC4.2 (happy path — unavailable/network failure).** Given state is `error` because
  `calorieResult.status === "unavailable"`, the request timed out, or the network/fetch failed
  outright, when the error view renders, then it shows a distinct inline message (e.g. "couldn't
  estimate calories — try again") with no hero number and a "Try again" affordance.
- **AC4.3 (edge — Try again re-attempts, doesn't silently reset).** Given state is `error` with the
  original file still held in memory, when the user taps "Try again", then the app re-submits the
  same photo (`error → estimating`, per Story 2) without requiring the user to re-pick the file
  from the Pick screen.
- **AC4.4 (edge — error never shows a stale/previous number).** Given a user has previously seen a
  `done` result for photo A, when they submit photo B and it fails, then the error view for photo B
  shows no calorie number at all (not photo A's number, not a zero, not a blank hero left over from
  the prior render).

---

## Story 5 — Reset flow: "New photo" and back return to a clean Pick screen

**As** a user done viewing a result (or a photo I want to swap), **I want** "New photo" / back to
return me to a fresh Pick screen **so that** I can estimate another meal without stale state.

- **AC5.1 (happy path — New photo from done).** Given state is `done`, when the user taps "New
  photo", then: the in-memory file/preview/estimate are cleared, state returns to `idle`, and the
  Pick screen renders with the dropzone empty and the CTA disabled (per AC1.1).
- **AC5.2 (happy path — New photo from error).** Given state is `error`, when the user taps "New
  photo" (as distinct from "Try again", AC4.3), then the same reset in AC5.1 occurs — a failed
  photo is not resubmitted automatically or held onto.
- **AC5.3 (edge — back-header chevron behaves the same as New photo).** Given state is `done` or
  `error`, when the user taps the back-chevron button in the Result header, then it performs the
  same reset as AC5.1/AC5.2 (the handoff defines only one Result→Pick transition; this AC makes the
  back button's behaviour explicit rather than leaving it undefined/decorative).
- **AC5.4 (edge — no orphaned request after reset).** Given a reset happens while `estimating` is
  impossible to trigger from `done`/`error` in this state machine, confirm by inspection that
  "New photo" is only reachable from `done` or `error` (not mid-flight), so no in-flight request is
  ever abandoned silently without a corresponding UI reset.

---

## Story 6 — Visual design: reproduce Midnight Lime tokens

**As** the product, **I want** the Pick and Result screens to match the design handoff's colors,
type, spacing, and radii **so that** the rebuild is the promised visual upgrade, not just a
reshuffle.

- **AC6.1 (happy path — color tokens).** Given either screen renders, when colors are inspected,
  then they match the handoff's token values exactly: background `#0A0B0D`, accent `#C6FF3D`
  (hover `#D6FF6B`), text primary `#F5F7FA`, text muted `#8A9099`, text dim `#6B7280` / dim-2
  `#7D838C`, hairline borders `rgba(255,255,255,.09/.08/.06)`, surface fills
  `rgba(255,255,255,.05/.03)`, accent tints `rgba(198,255,61,.35/.25/.12/.06)`.
- **AC6.2 (happy path — typography).** Given either screen renders, when fonts are inspected, then
  Space Grotesk is used for the logo wordmark, headings, hero number, stat values, and CTA labels;
  Manrope is used for body/subtext/labels/notices; sizes match the handoff scale (`76px` hero,
  `30px` H2, `18px` stat value, `16px` body/CTA, `14.5px` subtext, `14px` label, `13px`, `12px`
  eyebrow, `11.5px`, `11px`); the hero number has `font-variant-numeric: tabular-nums`.
- **AC6.3 (happy path — radius/spacing).** Given either screen renders, when radii are inspected,
  then they match the handoff: dropzone `24px`, photo `22px`, tiles/notes `14px`, CTA `16px`, small
  controls `12px`, logo mark `8px`, icon tile `20px` (screen-card `40px` radius applies only if a
  card frame is kept; full-viewport real-app screens may omit the outer card radius — flagged for
  the architecture/ux-design step to confirm, not decided here).
- **AC6.4 (happy path — ring animation).** Given the Result screen is in `done` or `estimating`,
  when the decorative rings render, then the `210px` ring pulses opacity `.35→.9` and scale
  `1→1.04` over `3s` ease-in-out infinite alternate, per the handoff's `ringPulse` spec.
- **AC6.5 (edge — responsive bounds).** Given the viewport is wider than ~420px (e.g. desktop
  browser), when either screen renders, then the screen's content is centered with a max content
  width in the `340–420px` range (not stretched full-bleed) — the 340×720px "phone card" from the
  prototype is a design-reference frame only, not a requirement to literally cap the app at 720px
  tall.

---

## Story 7 — Regression: existing upload contract and safety behaviour unchanged

**As** the project, **I want** the visual rebuild to leave the `POST /upload` contract and its
safety guarantees untouched **so that** a UI redesign can't silently reopen closed security/
correctness gaps from 001/002.

- **AC7.1 (happy path — contract unchanged).** Given the new UI submits a photo, when the request
  is inspected, then it is still a raw-binary `POST /upload` (file bytes as body, MIME in
  `Content-Type`) and the success response shape is still `{ ok, size, type, calorieResult }` with
  `calorieResult` one of `{status:"estimated",calories}` / `{status:"no_food"}` /
  `{status:"unavailable"}` exactly as documented in the manifest — no new required request/response
  fields.
- **AC7.2 (edge — non-JPEG/PNG still 415 server-side).** Given a request reaches the server with a
  `Content-Type` outside `image/jpeg`/`image/png` (bypassing the client-side guard in AC1.4, e.g.
  via devtools or a direct request), when the server processes it, then it still responds `415`
  with the existing JSON error shape, unchanged from 002.
- **AC7.3 (happy path — privacy notice preserved).** Given the Pick screen renders, when the
  privacy note is inspected, then it still states that the photo is sent to the model for
  estimation and that location/camera metadata is stripped first before egress, and that nothing
  is stored — matching the substance of the existing 002 notice (wording may be restyled per the
  handoff's copy, but the disclosure's content must not be weakened or removed).
- **AC7.4 (edge — existing automated tests still pass).** Given the 001/002 Vitest suites
  (`tests/upload.test.js`, `tests/vision.test.js`, `tests/rate-limit.test.js`,
  `tests/strip-metadata.test.js`), when they are run against the rebuilt frontend + unchanged
  backend, then all of them still pass unmodified (or with only additive changes, never changes
  that weaken an existing assertion).
- **AC7.5 (edge — server-side metadata stripping stays server-side, not silently duplicated
  incorrectly).** Given the handoff text loosely says metadata is "stripped client-side before
  sending" but the manifest records this app strips EXIF/GPS **server-side** in
  `src/strip-metadata.js` before the model call, when this feature ships, then the existing
  server-side stripping path remains the enforced guarantee (the privacy copy in AC7.3 describes
  what actually happens); adding a *duplicate* client-side strip is out of scope for this BA spec
  (an architecture decision, not a UI decision) and is **not** required by this feature.

---

## Story 8 — Accessibility hooks for the redesign

**As** a keyboard or screen-reader user, **I want** the new screens to be operable and legible
without a mouse **so that** the visual rebuild doesn't regress usability for me.

- **AC8.1 (happy path — keyboard reachability).** Given either screen renders, when the user tabs
  through it, then every interactive element (dropzone/file trigger, CTA, back button, "New
  photo", "Try again") is reachable via Tab in a logical top-to-bottom order, is
  enterable/activatable via Enter or Space, and shows a visible focus indicator (not
  `outline: none` with no replacement).
- **AC8.2 (happy path — dropzone keyboard-operable).** Given the Pick screen's dropzone is a
  file-input target (not a plain `<div>` with only a click handler), when it is focused and the
  user presses Enter or Space, then the native file picker opens exactly as it would on click.
- **AC8.3 (edge — disabled CTA is exposed to assistive tech).** Given the CTA is disabled
  (`idle` state), when a screen reader reaches it, then it is announced as disabled/unavailable
  (native `disabled` attribute or `aria-disabled="true"` + `tabindex` handling), not merely styled
  to look inactive while still focusable and clickable.
- **AC8.4 (edge — tap target sizing flagged, not silently shrunk).** Given the handoff specifies a
  `34×34px` back button and avatar placeholder (below the commonly-recommended ~44×44px minimum
  tap target), when these controls are built, then they receive at least a 44×44px hit area (via
  padding/hitslop) even though the visible glyph stays 34×34px — this AC is the explicit hook for
  the dedicated ux-design/accessibility step to verify; sizing is not silently left sub-minimum.
- **AC8.5 (edge — contrast flagged for verification, not asserted here).** Given several handoff
  text tokens are low-contrast-by-design on `#0A0B0D` (e.g. `#6B7280` dim text, `#7D838C` dim-2
  text), this AC records that WCAG AA contrast verification for body/label text is explicitly
  in scope for the dedicated ux-design step per `00-feature.md`'s pipeline shape — this BA spec
  does not itself pass/fail contrast, it hands the check forward.
