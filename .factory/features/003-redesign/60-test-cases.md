# 003 — Redesign ("Midnight Lime") — Test Cases

> QA step: risk-driven test suite for the two-screen state machine redesign.
> Covers happy paths + explicit negatives; each case specifies a user input and a user-visible expected outcome.
> Vitest (static HTML assertions) is included. **Playwright-tier recommendation is at the end of this document.**

---

## Current test tier coverage (Vitest, static HTML assertions only)

The following cases **are already covered** by the extended `tests/upload.test.js` (shape assertions):

| # | Story | Case | Input | Expected output | Test tier | Status |
|---|-------|------|-------|-----------------|-----------|--------|
| **1-Static-A** | 1 | Idle render, no file | App loads, Pick screen visible | Logo + heading + subtext + empty dropzone + disabled CTA + privacy notice all present | Vitest (static) | ✓ PASS |
| **1-Static-B** | 1 | File input narrowed | DOM inspected | `<input type="file" accept="image/jpeg,image/png">` present (closed from `accept="image/*"`) | Vitest (static) | ✓ PASS |
| **1-Static-C** | 8 | Dropzone is a real file input | DOM inspected | Dropzone contains `<input type="file">` (visually hidden, `tabindex="-1"`); sibling `<div role="button" tabindex="0">` is the focusable proxy | Vitest (static) | ✓ PASS |
| **1-Static-D** | 8 | CTA disabled by default | DOM inspected | "Estimate calories" button has `disabled` attribute + `aria-disabled="true"` | Vitest (static) | ✓ PASS |
| **3-Static-A** | 3 | Result screen elements present | DOM inspected (Result hidden initially) | Hero-number hook (`#hero-value`), error-message hook (`#error-text`), back button (`#back-button`), New-photo button (`#new-photo-button`), Try-again button present in markup | Vitest (static) | ✓ PASS |
| **3-Static-B** | 3 | 007 fabricated values absent | `npm test` assertion: grep for "642" / "Grilled chicken bowl" / "± NN" / "3 items seen" / "High confidence" / food-name DOM hook | None of these strings appear anywhere in `src/index.html` | Vitest (static) | ✓ PASS |
| **3-Static-C** | 3 | Stat tiles render literal "—" | DOM inspected | Stat-value elements (`#stat-value-1`, `#stat-value-2`) contain only the text "—" (em dash), not a number or placeholder | Vitest (static) | ✓ PASS |
| **7-Static-A** | 7 | Privacy notice substance unchanged | DOM text assertion | Privacy notice (`data-testid="privacy-notice"`) states: photo is sent to Anthropic's model + metadata is stripped before egress + nothing is stored | Vitest (static) | ✓ PASS |
| **7-Static-B** | 7 | Server contract untouched | No-change assertion | Files `server.js`, `vision.js`, `rate-limit.js`, `strip-metadata.js` are byte-for-byte unchanged | Vitest (static) | ✓ PASS |
| **7-Static-C** | 7 | Existing test suites still pass | `npm test` | All pre-existing tests in `tests/vision.test.js`, `tests/rate-limit.test.js`, `tests/strip-metadata.test.js`, `tests/calories.test.js` pass unmodified | Vitest (static) | ✓ PASS |

---

## **NEW TEST CASES REQUIRING PLAYWRIGHT** (browser automation — currently untested)

The following cases exercise the **client-side JS state machine** that is **NOT covered** by static-HTML assertions. These need browser automation (Playwright/Chromium) to verify:

### **Story 1 — Pick screen: file selection and CTA enablement**

| # | Case | Input | Expected output | Why Playwright? | Status |
|---|------|-------|-----------------|-----------------|--------|
| **1-1** | **Happy path: valid JPEG selection enables CTA** | User clicks dropzone, native picker opens, selects a valid JPEG file (e.g. 2MB sample photo) | (1) Dropzone preview thumbnail appears (image `src` is a blob URL); (2) state transitions from `idle` to `selected`; (3) CTA becomes enabled (no `disabled` attribute); (4) CTA is clickable/tappable | Needs browser to: render image blob, verify DOM state change, click CTA. JS state machine changes are invisible to static tests | NOT YET TESTED |
| **1-2** | **Happy path: valid PNG selection enables CTA** | User clicks dropzone, native picker opens, selects a valid PNG file (e.g. 1.5MB sample photo) | Same as 1-1 (preview + enabled CTA + state change to `selected`) | Same as 1-1 | NOT YET TESTED |
| **1-3** | **Edge: wrong file type rejected client-side** | User clicks dropzone, native picker opens, selects a GIF or WebP file | No preview is shown; state remains `idle`; CTA remains disabled; the file is never sent to the server (can verify by checking network tab) | Needs browser to: reject file in `change` handler without triggering preview, confirm state is still `idle`, confirm no network request fired (AC1.4) | NOT YET TESTED |
| **1-4** | **Edge: non-image file rejected client-side** | User clicks dropzone, selects a PDF or .txt file | Same as 1-3 (no preview, no state change, no request) | Same as 1-3 | NOT YET TESTED |
| **1-5** | **Edge: no file selected, CTA stays disabled and inert** | App loads to Pick screen; user attempts to click the disabled "Estimate calories" CTA | CTA does not respond; no network request is sent; screen does not transition | Needs browser to verify: disabled CTA is truly inert (click/keyboard has no effect) — static markup test can check `disabled` attribute, but can't verify the "inert" behaviour | NOT YET TESTED |
| **1-6** | **Edge: replace selection** | User selects a photo (state = `selected`), then clicks dropzone again and picks a different JPEG | (1) Old preview removed; (2) new preview image shows the new file; (3) in-memory file reference updated (confirmed by submitting and checking request body); (4) CTA remains enabled | Needs browser to: render two different preview images in sequence, verify object-URL lifecycle (old one revoked before new one created) | NOT YET TESTED |
| **1-7** | **Drag-and-drop: valid file dropped onto dropzone** | User drags a JPEG file onto the dropzone and drops it | Same as 1-1 (preview + enabled CTA + state `selected`) | Needs browser to: handle `dragover`/`drop` events, render preview from dropped file, prevent page navigation on drop | NOT YET TESTED |
| **1-8** | **Drag-and-drop: wrong file type dropped** | User drags a GIF/WebP/non-image file onto dropzone and drops it | No preview, no state change, no request (same as 1-3/1-4) | Same as 1-7 | NOT YET TESTED |

### **Story 2 — Submit and loading state**

| # | Case | Input | Expected output | Why Playwright? | Status |
|---|------|-------|-----------------|-----------------|--------|
| **2-1** | **Happy path: submit visible, loading state shown** | User selects a valid photo (state = `selected`), taps "Estimate calories" CTA | (1) State transitions to `estimating` immediately; (2) the pulsing animated skeleton appears in place of the hero-number area; (3) the ring decorations pulse (opacity/scale animation); (4) Pick screen hidden, Result screen shown; (5) back/New-photo/Try-again buttons are hidden (`hidden` attribute); (6) a `POST /upload` request is sent with the file bytes | Needs browser to: observe state-machine render() calls, verify animation is playing (skeleton + ring), verify button `hidden` state, confirm network request fired (check DevTools Network tab) | NOT YET TESTED |
| **2-2** | **Edge: double-submit prevented** | User selects a photo, taps "Estimate calories", and (while `estimating`) attempts to tap the CTA again (or taps the file input to re-open picker) | Only one `POST /upload` is sent; the second tap has no effect; state remains `estimating` with the same in-flight request (AC2.2) | Needs browser to verify: (1) during `estimating`, the CTA is hidden, so a second tap is unreachable — but if JS is bypassed (e.g. via devtools click), the handler must still guard against re-submit; (2) confirm only 1 network request ever issued | NOT YET TESTED |

### **Story 3 & 4 — Result rendering and error states**

| # | Case | Input | Expected output | Why Playwright? | Status |
|---|------|-------|-----------------|-----------------|--------|
| **3-1** | **Happy path: estimated result (number shown)** | App submits a valid photo; server responds `200 { calorieResult: { status: "estimated", calories: 487 } }` | (1) State transitions to `done`; (2) Result screen displays the submitted photo thumbnail; (3) hero-number area shows exactly "487" (textContent, no added characters); (4) loading skeleton is hidden; (5) back button + New-photo button are now visible and enabled; (6) Try-again button remains hidden | Needs browser to: observe state transition + render(), verify numeric value is displayed without transformation, confirm buttons visibility changes, assert no error message is shown | NOT YET TESTED |
| **3-2** | **Happy path: estimated result with different number (N = 1250)** | Server responds `{ status: "estimated", calories: 1250 }` | Hero number shows "1250" (tabular-numerals font applied, all four digits visible and aligned) | Needs browser to: verify numeric rendering and tab-nums CSS is applied (visual inspection) | NOT YET TESTED |
| **3-3** | **Edge: estimated result at plausibility boundary (1 kcal)** | Server responds `{ status: "estimated", calories: 1 }` | Hero number shows "1" | Needs browser to: render single-digit number (tab-nums still apply correctly) | NOT YET TESTED |
| **3-4** | **Edge: estimated result at plausibility boundary (5000 kcal)** | Server responds `{ status: "estimated", calories: 5000 }` | Hero number shows "5000" | Same as 3-2 | NOT YET TESTED |
| **4-1** | **Happy path: no_food error (model could not identify meal)** | App submits a valid photo; server responds `200 { calorieResult: { status: "no_food" } }` | (1) State transitions to `error`; (2) Result screen shows the submitted photo thumbnail; (3) error-message area displays "Couldn't identify a meal in that photo."; (4) **no hero number is shown** (hero-value area is hidden or empty); (5) Try-again button is visible and enabled; (6) New-photo button is visible | Needs browser to: verify state transition to `error`, confirm honest error message (not generic), verify no numeric value appears, confirm both affordances (Try-again / New-photo) are reachable | NOT YET TESTED |
| **4-2** | **Happy path: unavailable error (server failure / timeout / network)** | App submits a valid photo; server responds `200 { calorieResult: { status: "unavailable" } }` OR network request times out OR server returns non-2xx (e.g. 500) | (1) State transitions to `error`; (2) error-message shows "Couldn't estimate calories — try again." or similar; (3) **no hero number** appears; (4) Try-again and New-photo buttons visible | Same as 4-1 | NOT YET TESTED |
| **4-3** | **Edge: unparseable response body** | Server sends `200 { calorieResult: "garbage" }` (malformed/invalid structure) | State transitions to `error`; error-message is "Couldn't estimate calories — try again."; no number shown (AC2.4 enforced by JSON.parse try/catch) | Needs browser + controlled server mock to test parse failure path | NOT YET TESTED |
| **4-4** | **Edge: no calorie value in response** | Server sends `200 { status: "estimated", calories: null }` or `calories: undefined` | State stays in `estimating` OR transitions to `error` (code check: done requires `Number.isFinite(calories)` at 779); **never displays a blank/empty hero area as if it's valid** | Needs browser to verify: `done` is unreachable with a falsy/non-finite calories value | NOT YET TESTED |
| **4-5** | **Edge: stale number never shown on error** | User submits photo A → gets result "500 calories"; then submits photo B → server returns error | Error screen shows no number from photo A, no blank hero, no stale "500" — the hero area either shows the error message in its place or is completely hidden | Needs browser to: observe two full submit→result cycles and verify state machine clears the old calories value before rendering the error | NOT YET TESTED |

### **Story 5 — Reset and retry flow**

| # | Case | Input | Expected output | Why Playwright? | Status |
|---|------|-------|-----------------|-----------------|--------|
| **5-1** | **Happy path: New photo from done state** | User sees a Result screen with a number (state = `done`); user taps "New photo" button | (1) State transitions to `idle`; (2) in-memory file/preview/calories cleared; (3) Pick screen rendered with empty dropzone; (4) CTA disabled; (5) back button hidden; (6) Result screen hidden | Needs browser to: verify state reset, confirm all screen elements toggle visibility correctly, confirm prior file no longer in memory (can't submit same file without re-picking) | NOT YET TESTED |
| **5-2** | **Happy path: New photo from error state** | User sees an error message (state = `error`); user taps "New photo" button | Same as 5-1 (full reset to idle, not a retry) | Same as 5-1 | NOT YET TESTED |
| **5-3** | **Happy path: back-chevron behaves as New photo** | User on Result screen (done or error); user taps back-chevron button in the header | Same reset as 5-1/5-2 (state → idle, Pick screen shown, CTA disabled) | Same as 5-1 | NOT YET TESTED |
| **4-3-retry** | **Happy path: Try again re-submits without re-picking** | User sees error state with original photo still in memory; user taps "Try again" | (1) State transitions to `estimating` (not back to `idle`, per AC4.3); (2) the same file is re-submitted (same request body, same `POST /upload` call); (3) user does **not** need to re-open the file picker; (4) if the retry succeeds, shows result; if it fails again, shows error again | Needs browser to: confirm state machine takes the `error → estimating` path (not `error → idle`), verify same file bytes are re-sent (network inspection), confirm file picker is not re-opened | NOT YET TESTED |

### **Story 6 — Visual design and animations**

| # | Case | Input | Expected output | Why Playwright? | Status |
|---|------|-------|-----------------|-----------------|--------|
| **6-1** | **Ring and skeleton animations playing** | App is in `estimating` state (loading) | (1) The 210px ring pulses: opacity fades from 0.35 → 0.9 → 0.35; scale grows from 1 → 1.04 → 1; animation duration is 3s; repeats infinitely | Needs browser to: capture CSS animation state (via computed styles or visual inspection), measure timing, verify `ease-in-out` pacing | NOT YET TESTED |
| **6-2** | **Skeleton animation playing** | App is in `estimating` state | Hero-skeleton area pulses with an indeterminate animation (not a static gray bar) | Needs browser to: observe skeleton element's animation property | NOT YET TESTED |
| **6-3** | **Animations stop with prefers-reduced-motion** | System sets `prefers-reduced-motion: reduce`; app enters `estimating` state | Ring and skeleton are visible but **not animated** (no opacity/scale change, no skeleton pulse) — user still sees loading indication via the hidden back/new-photo buttons, but animations are suppressed (AC8.5, 40-design-changes.md §6) | Needs browser to: set media query preference, verify CSS `animation: none` is applied in `@media (prefers-reduced-motion: reduce)` | NOT YET TESTED |

### **Story 8 — Accessibility: keyboard and focus**

| # | Case | Input | Expected output | Why Playwright? | Status |
|---|------|-------|-----------------|-----------------|--------|
| **8-1** | **Keyboard: Tab order on Pick screen** | User presses Tab repeatedly from page load | (1) Focus reaches the dropzone first (or near first, in logical top-to-bottom order); (2) focus reaches the CTA button next; (3) Tab cycles through all interactive elements (file input is not directly focusable, `tabindex="-1"`); (4) shift-tab reverses the order | Needs browser to: simulate keyboard navigation, track focus order, verify logical sequence | NOT YET TESTED |
| **8-2** | **Keyboard: Enter/Space on dropzone** | Dropzone is focused; user presses Enter or Space | Native file picker opens (same as click on the dropzone) | Needs browser to: verify `keydown` handler on the focusable dropzone proxy triggers `fileInput.click()` | NOT YET TESTED |
| **8-3** | **Keyboard: Enter/Space on disabled CTA (idle state)** | CTA has focus, is disabled; user presses Enter or Space | CTA does not activate; no network request sent; nothing happens (inert) — verified by checking that the `click` handler early-returns on `cta.disabled` or the button's native disabled state prevents firing | Needs browser to: verify disabled button doesn't fire click handler (native browser behaviour for native buttons, but test explicitly confirms) | NOT YET TESTED |
| **8-4** | **Keyboard: Enter/Space on enabled CTA (selected state)** | CTA has focus, is enabled; user presses Enter or Space | Same as pressing the CTA with a click — state transitions to `estimating`, request is sent (AC2.1) | Needs browser to: confirm keyboard activation and click activation are equivalent | NOT YET TESTED |
| **8-5** | **Focus indicator visible** | Any interactive control is focused (dropzone, CTA, back button, New-photo, Try-again) | A visible outline appears around the control (2px solid accent-color, 3px offset per `40-design-changes.md` §4); `outline: none` is not used without a replacement | Needs browser to: visually inspect `:focus-visible` outline on each control (screenshot or computed style check) | NOT YET TESTED |
| **8-6** | **Disabled CTA is exposed to assistive tech** | Screen reader is enabled; user navigates to the disabled CTA | Button is announced as "disabled" or "unavailable" (native `disabled` attribute or `aria-disabled="true"`) — not merely visually inactive but still focusable | Needs browser + screen-reader bridge to: verify ARIA attribute is set (can check via computed attributes, but full AT verification needs a screen reader API or manual review) | NOT YET TESTED (static markup OK; AT bridge verification needed) |
| **8-7** | **Touch target sizing: back button** | User taps the back-chevron button on Result screen (in both done and error states) | Hit area is at least 44×44px (visible glyph is 34×34px per the handoff, but padding extends the hit box) — confirmed by inspecting computed `width`/`height`/`padding` on `.icon-btn` | Needs browser to: measure actual click-zone size (via element.getBoundingClientRect()) or inspect CSS | NOT YET TESTED |
| **8-8** | **Touch target sizing: CTA buttons** | User taps any primary CTA ("Estimate calories", "Try again") or secondary CTA ("New photo") | Hit area is at least 44px tall and full width (per AC8.4) | Same as 8-7 | NOT YET TESTED |

### **Story 7 — Regression tests (server-side contract unchanged)**

| # | Case | Input | Expected output | Why Vitest+Playwright? | Status |
|---|------|-------|-----------------|-----------------|--------|
| **7-1** | **Request format unchanged** | App selects a photo and taps "Estimate calories" | `POST /upload` request: body is raw file bytes (no multipart); `Content-Type` header is the MIME type (e.g. `image/jpeg`) | Vitest (network inspection) + Playwright (click through the flow, inspect DevTools Network) | NOT YET TESTED (Vitest partial) |
| **7-2** | **Response shape unchanged** | Server responds to `/upload` | `{ ok: true, size: <number>, type: "<string>", calorieResult: { ... } }` structure is unchanged | Vitest (JSON schema assertion) | ✓ PASS (Vitest) |
| **7-3** | **JPEG/PNG-only server-side** | A request with `Content-Type: image/gif` or `image/webp` reaches the server (e.g. via devtools bypass) | Server responds `415 { error: "..." }` (unchanged from 002) | Vitest (mock server) | ✓ PASS (Vitest) |
| **7-4** | **Rate-limit and metadata-stripping untouched** | Multiple rapid requests from the same IP; or request with EXIF data in the image | Rate-limit and metadata-strip modules work as before (no changes) | Vitest (`tests/rate-limit.test.js`, `tests/strip-metadata.test.js` run unmodified) | ✓ PASS (Vitest) |

---

## Summary: test coverage by tier

### Vitest (current; static assertions + server contract verification)
- **Status:** 73/73 tests passing
- **Coverage:** Pick screen idle state, CTA disabled-by-default, file input narrowed to JPEG/PNG, Result screen elements present, 007 fields render "—" (not fabricated values), privacy notice substance preserved, server files untouched, existing test suites pass

### Playwright (RECOMMENDED for this feature; browser automation of client-side state machine)
- **NOT YET IMPLEMENTED** — requires new test framework adoption
- **Coverage needed:** state machine transitions (idle → selected → estimating → done/error → idle), double-submit guard, file selection + preview rendering, drag-and-drop, keyboard dropzone activation, error message mapping (no_food/unavailable/network correctly mapped to distinct user-visible messages), Try-again re-submit flow, Result screen number rendering (exact value), animations (ring pulse + skeleton), keyboard navigation + focus indicators, touch targets ≥44px, accessibility (disabled CTA announced, `prefers-reduced-motion` honored)
- **Cases:** 24 new cases (listed above in "NEW TEST CASES REQUIRING PLAYWRIGHT")
- **Why critical:** The entire client-side behaviour (the core user experience) is untested. A user could encounter: wrong calorie numbers, fake/stale numbers, missing error messages, inability to fix a failed request without a page reload (F1), drag-drop not working, keyboard navigation broken, animations causing motion sickness if `prefers-reduced-motion` is not honored.

---

## Test-tier recommendation: **PLAYWRIGHT IS WARRANTED**

### Evidence

**Current tier (Vitest + static HTML):** Covers only the *structure* of the generated HTML (buttons exist, text is in place, 007 fields are not fabricated). Cannot exercise the client-side JS state machine.

**Behaviour added in 003 that is user-facing and currently untested:**
1. **State-machine transitions** — the app moves between 5 states (idle → selected → estimating → done/error → idle). Each transition is invisible to static-markup tests; a bug that never reaches a state (e.g. a user error never shown) is undetectable.
2. **Double-submit guarding** (AC2.2) — the app prevents re-tapping the CTA while `estimating`. Static tests cannot verify this; Vitest can verify the code path *exists*, but cannot prove it actually prevents a second network request.
3. **Result mapping logic** (AC2.3/AC2.4/AC4.1/AC4.2) — given `calorieResult.status`, the app renders the right screen + the right message. Three branches (estimated → done, no_food → error, unavailable → error, non-2xx → error, unparseable → error). A miscoded mapping (e.g. sending "unavailable" to the done screen, or failing to clear a stale number) produces a visibly wrong result — but static tests only verify that the message text exists in the HTML *somewhere*, not that it is linked to the right state.
4. **Drag-and-drop** (AC1.7/AC1.8) — the dropzone accepts dropped files and renders a preview. No static test exercises this.
5. **Keyboard dropzone activation** (AC8.2) — pressing Enter/Space on the focused dropzone opens the file picker. Static tests verify the focusable proxy exists; Vitest cannot verify the keydown handler fires.
6. **Object-URL lifecycle** (AC1.5/AC5.1) — the app creates/revokes blob URLs for the image preview and final result photo. Vitest cannot detect memory leaks or premature revocation.
7. **Animations** (AC6.4, 40-design-changes.md §6) — ring pulses, skeleton animates, `prefers-reduced-motion` suppresses animations. Static CSS can be inspected (Vitest), but animation *execution* and the media-query guard require a real browser.
8. **Accessibility:**
   - **Keyboard reachability** (AC8.1) — Tab order is logical and complete. Requires browser keyboard simulation.
   - **Focus indicators** (40-design-changes.md §4) — `:focus-visible` outlines are visible on every control. Requires visual inspection in a browser.
   - **Touch targets** (AC8.4, 40-design-changes.md §5) — back button / avatar are ≥44px. Vitest can inspect CSS sizes; Playwright can verify the actual click-zone.
   - **Disabled state announced** (AC8.3) — Vitest can check the `aria-disabled` attribute; full verification requires an AT bridge (out of scope here, but a static check is better than none).

**Known gaps from the review (55-review.md):**
- F1 (client-side timeout) — affects error recovery; a stalled socket leaves the user trapped. Only reproducible in a browser with network simulation.
- F2/F3 (nits) — flagged for awareness but not blockers.

### Recommendation

**Adopt Playwright as a dev-dependency (ADR-001 permits test deps) and write a test suite covering the 24 cases above.** The key test paths:
1. **Happy path (Pick → estimate → result):** select JPEG → CTA enables → tap → skeleton+ring animate → result shows number → "New photo" → back to empty Pick
2. **Error path (no_food):** select photo → submit → server returns `{status:"no_food"}` → error message shown, no number → "Try again" → re-submit → observe state machine re-enter `estimating`
3. **Error path (unavailable/network):** select photo → submit → network failure OR server non-2xx → error message shown → "Try again" works
4. **Double-submit guard:** tap CTA, immediately tap again (or simulate fast clicks) → only one `POST /upload` sent
5. **Keyboard navigation:** Tab through all controls, focus indicators visible, Enter/Space activate, Space on dropzone opens file picker
6. **Drag-drop:** drag JPEG onto dropzone → preview appears; drag GIF → rejected, no state change
7. **Reset flows:** from done: "New photo" → idle, from error: "New photo" → idle, from error: "Try again" → re-submit same file
8. **Accessibility:** `prefers-reduced-motion` → animations stop, `disabled` CTA announced, 44px targets, focus visible

### What this does NOT change
- **Vitest suite remains the gate for server-side logic** (vision-model calls, rate-limit, metadata-strip, all untouched by the UI redesign).
- **The 007 fields neutralized (no fabrication)** — this is already guarded by the JS code check (no write to `hero-value` except via the `calories` variable), and static tests confirm the "—" literals and absent DOM hooks. Playwright adds visual confirmation and state-transition proof.
- **Release decision is a human call.** This recommendation is "Playwright would be a good investment to catch regressions in this flow"; the decision to adopt it, set a test-passing bar, or gate on it is the project's.

---

## Disposition of findings from 55-review.md

| Finding | Test coverage | Recommendation |
|---------|------|---|
| F1 (client-side timeout → stalled socket) | Needs Playwright with simulated network conditions; cannot be caught by static tests or pure Vitest. A browser test that kills the server mid-response would reproduce this. | Defer to a follow-up (acknowledged in review); flag for next sprint. Blocking: if ship is expected to handle network timeouts per AC4.2's language. |
| F2 (415 shows generic message, not distinct "unsupported file type") | Needs Playwright: exercise the client-side guard bypass (devtools, raw request) and verify the error message. Nit-level; design note deviation, not AC failure. | Accept (human disposition already given in task context). Test: devtools bypass of 415 shows generic "couldn't estimate" message (expected per AC2.4 mapping), not a distinct 415 copy (per-design deviation, logged). |
| F3 (role="button" wraps focusable descendants) | Vitest can check ARIA attributes; Playwright can verify screen reader behavior (requires AT bridge, out of scope). | Accept (human disposition: benign). Static test: `role="button"` present; input inside has `tabindex="-1"` and `aria-hidden="true"`. Full AT verification deferred. |

---

## Test execution notes

- **Vitest cases (1-Static-A through 7-Static-C):** Already passing. Verify by running `npm test`.
- **Playwright cases (1-1 through 8-8, plus 7-1):** Requires `npm install -D playwright` (dev-dependency, ADR-001 OK), then write `tests/flow.spec.ts` (or `.js`) with Chromium browser context. Can re-use the test server from `upload.test.js` (local mocked `/upload` endpoint). Suggested test structure:
  - Fixture: launch app on test server, load `GET /` (served `index.html`).
  - Helper: mock `/upload` responses (return `{ok, size, type, calorieResult: {...}}` for happy/error paths).
  - Each case: user interaction (click, drag, keyboard, observe DOM/animations/network).

---

**Final tally:** 9 cases covered by current Vitest; **24 new cases require Playwright** for the behaviour state machine, animations, keyboard/accessibility, and drag-drop. The user experience is currently untested; Playwright adoption is recommended to close this gap.
