# Manifest — CURRENT STATE of Calories

> ★ Every skill/agent reads this FIRST, before doing anything. It answers:
> "What already exists? What must I not break?"
> The LAST step of every feature run (delivery-pm / wrap) updates this file.

**Last updated:** 2026-07-13
**Current version:** 0.4.0

## Features that exist right now

| ID  | Feature           | Status    | Shipped    | Spec folder                        |
|-----|-------------------|-----------|------------|------------------------------------|
| 001 | Initial prototype | delivered | 2026-07-13 | `features/001-initial-prototype/`  |
| 002 | Calorie estimate  | delivered | 2026-07-13 | `features/002-calorie-estimate/`   |
| 003 | Redesign (Midnight Lime UI) | delivered | 2026-07-13 | `features/003-redesign/` |
| 007 | Food ID + confidence | delivered | 2026-07-13 | `features/007-food-id-confidence/` |

## Live surfaces (files that make up the running app)
- `src/server.js` — the single Node service (built-in `http` + `fs`, ESM, no runtime dep). Exports
  `requestHandler`, `createServer`, `MAX_UPLOAD_BYTES`. Routes: static `GET /` + `/index.html`
  (serves the frontend), and `POST /upload` (raw-binary upload endpoint; now also calls the vision
  model and rate-limits before doing so — see 002 below). **007** — the `"estimated"` branch's
  `calorieResult` assembly now additively spreads `foodName`/`confidence`/`itemsCount` from the
  vision-module result **only if the key is present** (e.g. `"foodName" in result`), so a fully
  degraded 007 response is byte-identical to the pre-007 `{status:"estimated", calories}` shape.
  `ok`/`size`/`type` and the `no_food`/`unavailable` shapes are untouched.
- `src/vision.js` (new, 002; schema expanded 007) — the vision-model client. Exports
  `SUPPORTED_RASTER_MIME_TYPES` (`["image/jpeg", "image/png"]` — see narrowed contract below),
  `isSupportedRasterMime(mime)`, `estimateCalories(imageBuffer, mime)` →
  `Promise<{status:"estimated",calories,foodName?,confidence?,itemsCount?}|{status:"no_food"}|{status:"unavailable"}>`.
  Calls `POST https://api.anthropic.com/v1/messages` via built-in `fetch` (no `@anthropic-ai/sdk`,
  ADR-001 honoured), **same single round-trip** (AC1.3 — no second call, no new model tier), model
  `claude-sonnet-5`, `thinking: {type:"disabled"}`, 30s `AbortController` ceiling, 1–5000 kcal
  plausibility band (R15) on `calories` (unchanged from 002). **007** expands the structured-output
  json_schema from `{food_identified, calories}` to `{food_identified, calories, food_name,
  confidence, items_count}` (wire snake_case, mapped to camelCase result keys) — `confidence` carries
  a schema-level `enum: ["low","medium","high"]` (defense-in-depth); `food_name`/`items_count` get
  only `anyOf`/`null` because structured outputs do not support `minLength`/`maxLength`/`minimum`/
  `maximum`, so their bounds live only in JS, exactly like the `calories` band. New exported
  validation constants: `MAX_FOOD_NAME_LENGTH = 60`, `CONFIDENCE_LEVELS = ["low","medium","high"]`
  (frozen), `MIN_PLAUSIBLE_ITEMS = 0`, `MAX_PLAUSIBLE_ITEMS = 50`, `FOOD_NAME_DISALLOWED_RE` (rejects
  C0/C1 controls, zero-width chars U+200B–U+200F, bidi embedding/override U+202A–U+202E, invisible
  operators U+2060–U+2064, BOM U+FEFF — **known incomplete, see Known limitations R17/F1/F2**). Each
  of the three new fields is validated independently, reject-to-neutral (omit, never truncate/clamp/
  default) — a bad name/confidence/count never flips a good calorie estimate to
  `no_food`/`unavailable`, and the whole-response fail-closed path (refusal / bad `food_identified` /
  null or out-of-band `calories`) never carries any of the three new fields either. **`MAX_TOKENS`
  raised 256→1024 (007)** so the enlarged 5-field JSON reply can't truncate mid-object and *falsely*
  fail-closed a valid photo (no cost-material change — see Known limitations for the R19 note and the
  build-note correction re: an untested `max_tokens` claim). Strips EXIF/GPS via `strip-metadata.js`
  immediately before base64-encoding (R10 — see known limitations for the partial-closure caveat).
  `ANTHROPIC_API_KEY` read from `process.env` only.
- `src/rate-limit.js` (new, 002) — dependency-free per-process guard: per-IP fixed window
  (`RATE_LIMIT_MAX_PER_WINDOW = 10` / `RATE_LIMIT_WINDOW_MS = 60_000`, keyed on
  `req.socket.remoteAddress`) + global in-flight concurrency cap (`MAX_CONCURRENT_VISION_CALLS = 2`).
  Exports `acquireVisionSlot()` (returns `{allowed, reason, release}`) and `resetRateLimits()` for
  tests. **Known fairness bug** — see Known limitations.
- `src/strip-metadata.js` (new, 002) — structural (no re-encode) EXIF/GPS/comment stripper for
  JPEG and PNG; exports `stripImageMetadata(buffer, mime)` → stripped `Buffer` or `null` (fail-closed
  if it can't be provably stripped). **Known partial-closure bug (JPEG data after EOI)** — see Known
  limitations.
- `src/index.html` — **rebuilt in 003** into the "Midnight Lime" two-screen UI: a **Pick** screen
  (logo header, "Snap it. Count it." heading, a dashed dropzone that doubles as a real
  `<input type="file" accept="image/jpeg,image/png">` file trigger with preview-on-select/drag-drop,
  the privacy note, and an "Estimate calories" CTA disabled until a photo is chosen) and a **Result**
  screen (back header, submitted-photo thumbnail, animated-ring hero block, "New photo" reset). Single
  in-page 5-state vanilla-JS state machine (`idle → selected → estimating → done | error → idle`),
  driven by one in-memory model (`state, currentFile, previewUrl, calories, errorReason`) toggling
  sibling `<section data-screen="pick"|"result">`s via the `hidden` attribute — no router, no framework
  (ADR-001 upheld). All Midnight Lime design tokens (colors, Space Grotesk/Manrope typography, radii,
  the `ringPulse` animation) live as CSS custom properties in one inline `<style>` block; Space
  Grotesk/Manrope load via a Google Fonts `<link>` (static asset, not a runtime dep) with a system-font
  fallback. **007 wires the three fields 003 left neutral:** a `.food-name-pill` node (overlaid
  bottom-left inside `.photo-thumb`, `hidden` by default, `id="food-name-pill"`) shows
  `cr.foodName` via `textContent` when it's a non-empty string, else stays hidden (no placeholder);
  the two stat tiles (`id="stat-value-1"`/`id="stat-value-2"`, labels "items seen"/"confidence"
  unchanged from 003) show `String(itemsCount)`/the confidence label (`CONFIDENCE_LABELS = {low:
  "Low", medium:"Medium", high:"High"}`, plain text — ux-design's visual call, not a badge/dot) or
  `"—"` on invalid/missing. State grows to `foodName`/`confidenceLevel`/`itemsCount` (default
  `null`) alongside `state, currentFile, previewUrl, calories, errorReason`. `render()` resets all
  three to neutral **unconditionally at the top of the function**, before branching on state, so a
  stale value from a prior `done` can never leak into estimating/error/no_food or a fresh
  Try-again/New-photo render; `submitEstimate()` re-validates each field client-side (defensive
  re-check on top of server validation) and resets all three on every non-`estimated` branch.
  **The "± NN" calorie range is still out of scope** (003/007 carry-forward) — not wired. All
  response-derived text (old and new) still reaches the DOM via `textContent` only (no `innerHTML`/
  `insertAdjacentHTML`), preserving the 001/002/003 XSS posture — now load-bearing for the app's
  first model-generated free text (threat-model 007, R16). Keyboard-operable dropzone (Enter/Space
  opens the file picker), visible `:focus-visible` rings on every control, ≥44×44px tap targets, and
  a `prefers-reduced-motion` guard on the two looping animations are all built in (unchanged from
  003). **`src/server.js`'s route table, `src/rate-limit.js`, `src/strip-metadata.js`, and the
  `POST /upload` request side are UNCHANGED by 007 — only the response body's `calorieResult`
  and the Result-screen render grew (additive).**
- `tests/upload.test.js` — Vitest integration suite (mounts `createServer()` on port 0, hits it with
  real HTTP; covers every server AC + a cap boundary test + the AC2.5 secret scan + (002) the vision
  call, MIME allowlist, rate-limit, and metadata-strip paths end-to-end, with `api.anthropic.com`
  intercepted by a `fetch` dispatcher and everything else passed through). **(003)** gained static-HTML
  shape-assertions for the rebuilt frontend: both screens present, narrowed
  `accept="image/jpeg,image/png"`, CTA disabled-by-default with `aria-disabled`, hero/error/back/
  new-photo/try-again hooks present, stat tiles render only "—", and an explicit negative assertion
  that none of the feature-007 demo values (642 / "Grilled chicken bowl" / "± NN" / "3 items seen" /
  "High confidence") appear anywhere in the shipped file. These are static-markup assertions only — the
  client-side state machine itself is not browser-exercised (see Known limitations). **(007)** revised
  that one negative assertion (as scoped) to confirm the pill/tile DOM hooks now exist and degrade to
  neutral by default, while keeping every hardcoded demo-value literal as a hard negative; added a
  matrix of new server-side end-to-end cases (happy path all-five-fields, fully-degraded regression,
  over-length name, off-enum confidence, out-of-range count, no_food/refusal non-leak) — 95 tests total
  (up from 74). The **client-side render path for the three new fields is still not browser-exercised**
  (pill show/hide, per-field neutral reset, stale-value non-leak across Try-again/New-photo) — see
  Known limitations; QA's Playwright recommendation for this is folded into roadmap 008.
- `tests/vision.test.js` (new, 002; extended 007) — unit tests for `estimateCalories`/
  `isSupportedRasterMime` (request shape, all fail-closed branches, the R15 plausibility band, R10
  egress assertions). **(007)** added ~20 tests: expanded-schema request-shape assertions (required
  keys, `confidence`'s schema-level enum, `anyOf`/`null` shapes); full happy-path resolution of all
  three new fields; every untrusted-text rejection path (over-length/empty/whitespace/non-string
  name, control/zero-width/bidi-override characters, off-enum confidence incl. wrong case/number/
  synonym, out-of-range/non-integer/negative `items_count`); band-edge acceptance; emoji/markdown
  passed through verbatim; fully-degraded response still resolving the calorie estimate in the exact
  pre-007 shape; no_food/refusal paths never leaking the new fields.
- `tests/rate-limit.test.js` (new, 002) — per-IP cap, per-IP isolation, window rollover, concurrency
  cap, idempotent release.
- `tests/strip-metadata.test.js` (new, 002) — asserts GPS/EXIF removal on real fixture bytes, that
  pixel/critical data survives byte-for-byte, and fail-closed on malformed/unstrippable input.
- `tests/image-fixtures.js` (new, 002) — structurally valid JPEG/PNG fixtures carrying a GPS needle,
  used by the strip and vision test suites.
- `src/calories.js` — starter module (`formatCalories`); still exists (toolchain proof), untouched by 001/002.
- `tests/calories.test.js` — starter Vitest suite; still green.

## Data model
_No persisted data model — the upload body (and, since 002, the vision-model result) is used for the
single request and then discarded (no disk/DB, no caching — verified by 002's AC3.2 independent-call test)._

**`POST /upload` contract (ADR-002 raw binary transport).** Request = raw image bytes as the request
body, MIME in the `Content-Type` header.
- **Success:** `200 { ok: true, size: <bytes:number>, type: "<mime:string>", calorieResult: <CalorieResult> }`
  (`size` = streamed byte count of the *original* uploaded body; `type` = normalised lowercased,
  `;`-stripped `Content-Type`). **`calorieResult` added in 002** (additive field, `ok`/`size`/`type`
  unchanged) — one of:
  - `{ status: "estimated", calories: <integer, 1–5000>, foodName?: <string, ≤60 chars>,
    confidence?: "low"|"medium"|"high", itemsCount?: <integer, 0–50> }` — usable vision-model
    estimate. **`foodName`/`confidence`/`itemsCount` added in 007, all three OPTIONAL** — each key is
    present **only** if it independently passed server-side validation, and **absent** (never
    `null`) otherwise (omit-on-absent). A fully-degraded 007 response — all three fields invalid or
    missing from the model's reply — is therefore **byte-identical** to the pre-007 wire shape
    `{status:"estimated", calories}`; this is the backward-compatibility guarantee (verified by both
    `tests/vision.test.js` and `tests/upload.test.js`). A bad/missing new field never affects whether
    `calories` itself renders — the two are independent.
  - `{ status: "no_food" }` — model could not identify food, or returned no usable number. Never
    carries any of `foodName`/`confidence`/`itemsCount`, even if the raw model reply included them.
  - `{ status: "unavailable" }` — any failure (timeout, non-2xx, refusal, unparseable, network error,
    out-of-band value). Never carries any of `foodName`/`confidence`/`itemsCount`.
- **Errors** (all JSON `{ error: "<string>" }`): `400` no-file (no/empty `Content-Type`) · `415`
  unsupported file type (`Content-Type` not on the raster allowlist — **narrowed in 002, see below**)
  · `413` oversized (`> 10,485,760` bytes) · `400` empty (0-byte body) · `429` rate/concurrency limited
  (**new in 002** — no `calorieResult`, no model call spent) · `404` unknown route/method.
- **Size cap:** `MAX_UPLOAD_BYTES = 10 * 1024 * 1024 = 10,485,760` bytes; enforced mid-stream (aborts
  the moment the running total strictly exceeds the cap). Exactly 10,485,760 bytes is accepted.
- **Supported raster-image allowlist — NARROWED in 002 (human-accepted scope change):**
  `SUPPORTED_RASTER_MIME_TYPES = ["image/jpeg", "image/png"]` only. The original 002 design allowed
  `jpeg/png/gif/webp`; **GIF and WebP now 415** because they cannot be metadata-stripped (R10)
  dependency-free without risking pixel corruption. `image/svg+xml` and any other `image/*` subtype
  remain rejected (closes manifest R3/M1/M2 on this route, unchanged from the original 002 design).
- **Check order:** `400` no-type → `415` allowlist → `413` oversize → `400` empty-body → `429`
  rate/concurrency → vision-model call. A request that fails any earlier check spends no model call.

## Key decisions in force
_(one-liner here → full reasoning + rejected alternatives in `decisions/`)_
- **ADR-001** — Calories is ONE Node service: serves the frontend + owns the only vision-model API route;
  the model API key is server-side only (never in client code / committed files). No framework or build
  tool without a new ADR. → `decisions/001-node-service-stack.md`
- **ADR-002** — upload transport = **raw binary POST** (File sent as the raw request body; MIME in the
  `Content-Type` header). No multipart/parser dependency (or framework) without a superseding ADR.
  → `decisions/002-raw-binary-upload-transport.md`
- **002 vision-model tier (human pick, no new ADR — reversible one-line model-ID string):**
  `claude-sonnet-5`, chosen over `claude-haiku-4-5` (cheaper, weaker) and `claude-opus-4-8` (best,
  ~2.5x cost) for accuracy-per-dollar on "identify the meal, estimate calories." See
  `features/002-calorie-estimate/30-options.md`.
- **002 raster-MIME allowlist narrowed to JPEG/PNG only** (human-accepted scope change from the design's
  jpeg/png/gif/webp — GIF/WebP can't be EXIF-stripped dependency-free). Reversible: restoring GIF/WebP
  needs either a full metadata-strip implementation for those formats or an ADR to adopt an
  image-processing dependency.
- **003 redesign — no new ADR** (architecture step confirmed both ADR-001 and ADR-002 hold unchanged):
  the two-screen "Midnight Lime" rebuild stays a single-document view toggle inside the one existing
  `src/index.html` (no second static route, no framework, no build tool), inline CSS/JS, and the same
  raw-binary `POST /upload` call the page already made. A Google Fonts `<link>` was adopted as a
  reversible static-asset load, not a dependency. See `features/003-redesign/30-design.md`.
- **007 food ID + confidence — no new ADR** (additive, reversible, backward-compatible): the
  structured-output schema on the *same* single `claude-sonnet-5` call grows from 2 to 5 fields; the
  response body's `calorieResult` grows three optional keys, omit-on-absent, restoring the exact
  prior shape if ever removed. Direct precedent: 002 already added `calorieResult` to the envelope
  with no ADR. ADR-001 (vanilla, no framework/dependency) and ADR-002 (raw-binary request transport,
  untouched — only the response body changed) both hold. See
  `features/007-food-id-confidence/30-design.md` §6.

## Known limitations / tech debt

**Hard gate (unchanged by 003 and 007 — neither touched the server's request-side/transport surface)
— MUST resolve before any exposure beyond localhost:**
- **R1 concurrency memory / R2 slow-loris** (threat-model High, carried from 001, worse since 002): the
  per-request 10 MB cap does NOT bound aggregate in-flight memory, and there are no inbound request
  timeouts. Since 002, each in-flight request also holds the image buffer's base64 copy + serialised
  JSON request body (~3x the image size) for the whole multi-second vision-model round-trip (up to 30s),
  vs. milliseconds in 001 — the same accepted gap now costs far more per concurrent request.
- **R10 only PARTIALLY closed (002 review-2, major, security/fail-open).** EXIF/GPS stripping
  (`src/strip-metadata.js`) correctly removes metadata from the primary JPEG/PNG segment before egress
  to Anthropic — the common camera-photo case — but data appended after the first JPEG's EOI marker
  (Samsung/Google Motion Photos, MPF, iPhone Live Photo exports, or any deliberately appended payload)
  is copied through **verbatim, unparsed**. A secondary JPEG with its own APP1/GPS appended after EOI
  egresses with location data intact. Confirmed by execution (review-2 finding F1). **R10 is not fully
  closed; do not treat this route as "photos are always stripped of location data."**
- **Rate-limit fairness bug (002 review-2, major, security/availability).** `src/rate-limit.js` debits
  the caller's per-IP window before checking the global in-flight concurrency cap, and does not refund
  the window on a concurrency denial. Two attackers holding both in-flight slots can cause every other
  IP's requests to be denied on `reason:"concurrency"`, silently burning those victims' per-IP windows —
  after enough denials a legitimate user gets locked out on `reason:"rate"` having spent zero model
  calls. The control meant to protect availability/cost can be turned into a denial-of-service lever.
- **New raster-MIME allowlist scope cut (002, human-accepted):** `SUPPORTED_RASTER_MIME_TYPES` is now
  `image/jpeg` + `image/png` only — **GIF and WebP are unsupported** (415), narrowed from the original
  002 design's jpeg/png/gif/webp, because those formats can't be metadata-stripped dependency-free
  without risking pixel corruption. Restoring them needs either a full GIF/WebP strip implementation or
  an ADR to adopt an image-processing dependency.
- **R3 / M1 / M2 MIME allowlist** — **CLOSED** on the `/upload` route as of 002: `image/svg+xml` and
  degenerate `image/` subtypes are rejected with 415 before the body is read and before any model call
  (replaced the old `startsWith("image/")` check with an explicit allowlist).

**Minor / accepted, not gating exposure but should be fixed opportunistically:**
- **F3/F4 (002 review-2, minor, security/correctness).** The metadata-strip module's "cannot smuggle
  data out" guarantee is not fully true: PNG keeps any unknown chunk whose type byte is uppercase
  ("critical"), not only the four true critical chunk types (IHDR/PLTE/IDAT/IEND); JPEG uses a denylist
  (drop APPn+COM) rather than a keep-list, so an unrecognized non-APPn marker survives. Both are
  self-targeting today (the uploader controls their own image) but the stated invariant is false.
- **F5 (002 review-2, minor, resource).** The per-IP rate-limit `Map` in `src/rate-limit.js` is never
  evicted — unbounded memory growth over many distinct source IPs (same class as R1).
- **F6 (002 review-2, minor, correctness).** Fixed-window rate limiting allows ~2x the nominal rate
  briefly across a window boundary (e.g. 10 calls just before a minute rolls + 10 just after = 20 in
  ~10ms). Acceptable for a cost-guard prototype; a sliding window or token bucket would remove it.
- **UI copy (002, cosmetic) — CLOSED by 003.** `src/index.html`'s file input is now narrowed to
  `accept="image/jpeg,image/png"` (was `image/*`); a user picking a GIF/WebP/HEIC file client-side now
  gets no preview and an inert CTA instead of learning it's unsupported only via the 415 response. The
  server-side 415 allowlist remains the authoritative backstop for a bypassed client guard.
- **Frontend behaviour still not E2E-tested (carried forward from 002/003, surface area grown again by
  007).** The client-side state machine — the 5-state transitions, the double-submit guard (AC2.2), the
  `calorieResult` → view mapping, object-URL create/revoke lifecycle, drag-and-drop, keyboard dropzone
  activation, the ring/skeleton animations and their `prefers-reduced-motion` guard, and the "Try again"
  re-submit path — is covered only by static-HTML string assertions in `tests/upload.test.js`, not by a
  running browser. QA specified a 24-case Playwright tier for the 003 surface. **007 review F4 extends
  this gap to the app's first untrusted-text render path:** pill show/hide, per-field neutral reset
  across estimating/error/no_food/Try-again/New-photo, stale-value non-leak, and the client-side
  defensive re-validation are all code-present but verified only by static assertions, not a running
  browser. QA's 51-case suite (007) recommends 3–5 additional Playwright flows for exactly this.
  **Human decision (003, reaffirmed at 007): ship now; Playwright queued as follow-up roadmap 008** —
  the 007 render-path cases are explicitly folded into that same roadmap 008 item, not a separate one.
- **003 review F1 (minor, deferred to 008) — no client-side fetch timeout.** `src/index.html`'s
  `submitEstimate` has no `AbortController`/timeout on its `fetch('/upload', …)`. During `estimating`,
  every reset control (back/New-photo/Try-again) is deliberately hidden, so the only ways out are the
  `fetch` resolving or rejecting. Ordinary failures are fine (a refused connection rejects → `error`;
  a live-but-slow server self-aborts at its own 30s ceiling → `unavailable` → `error`), but a stalled/
  half-open socket (server dies mid-response, connection black-holes) produces neither event promptly —
  the user is stuck on the pulsing skeleton with no reachable control until the browser's own default
  network timeout eventually fires. AC4.2 names "request timed out" as an error trigger, but no
  client-side timeout implements it today. Not an integrity/fabrication issue (no number is ever shown
  here). To be fixed alongside the Playwright follow-up (roadmap 008).
- **003 review F2 (nit, accepted).** A bypassed 415 (client `accept` guard defeated via devtools/direct
  request) renders the generic "Couldn't estimate calories — try again" message instead of the distinct
  "unsupported file type" copy the design handoff called for. Not an AC failure — the server still
  returns 415 correctly (AC7.2) — just a design-note fidelity deviation, logged as a conscious choice.
- **003 review F3 (nit, accepted).** The Pick screen's dropzone container carries `role="button"` while
  wrapping a focusable `<input type="file">` and an `<img>` — non-idiomatic ARIA (a button shouldn't
  contain other interactive descendants). Benign in practice: the input is `tabindex="-1"
  aria-hidden="true"`, correctly excluded from the tab order and the accessibility tree; the dropzone
  itself is the intended focusable proxy (AC8.2).
- **007 review F1/F2 + threat-model R17 (Low, human-DEFERRED to roadmap 009) — incomplete `foodName`
  character reject-set.** `FOOD_NAME_DISALLOWED_RE` (`src/vision.js`) rejects C0/C1 controls,
  zero-width chars (U+200B–U+200F), bidi *embedding/override* chars (U+202A–U+202E), invisible
  operators (U+2060–U+2064), and BOM (U+FEFF) — but **misses** bidi *isolate* controls
  (U+2066–U+2069 LRI/RLI/FSI/PDI), U+061C (Arabic Letter Mark), and U+2028/U+2029 (line/paragraph
  separators). A crafted `foodName` using these passes validation and can visually reorder or
  line-break the pill text (e.g. `"⁦Estimate calories ▶ tap here⁩"`) — the same deception family the
  reject-set already exists to block (AC5.5). **Impact bounded, not a blocker:** render is
  `textContent`-only (no XSS/injection possible), the pill is hard-capped at 60 chars, and the
  attacker only deceives themselves (self-targeting today). **Human-deferred to follow-up roadmap
  009** ("Dish-name spoofing-char hardening") — extend the reject-set + decide a homoglyph/confusables
  policy. Confusables/homoglyphs are out of scope for a dependency-free reject-set regardless.
- **007 review F3 (minor, test-coverage) — `MAX_TOKENS` 256→1024 bump is untested.** No test in
  `tests/` asserts anything about `max_tokens`'s value or bound. The bump itself is sound (avoids a
  truncation → parse-fail → false fail-closed on a valid photo with the larger 5-field JSON reply;
  `thinking` stays disabled so the whole budget is reserved for the answer; no material cost
  implication — see R19 below). **Correction:** `50-build-notes.md` previously claimed this stayed
  "within the existing test's `<= 1024` assertion" — no such assertion exists; the build note was
  corrected at wrap (this run). The same inaccurate claim also still appears as a code comment in
  `src/vision.js` (~line 31) — out of scope for this wrap step to edit; flagged for the next touch of
  that file. Recommend adding a one-line request-shape assertion on `max_tokens`.
- **007 review F5 (nit, accepted) — client-side `foodName` re-check is weaker than the server's.**
  `src/index.html`'s defensive re-validation only checks `typeof === 'string' && length > 0`; it does
  not re-apply `MAX_FOOD_NAME_LENGTH` or the character reject-set the server enforces. No practical
  exposure (server is authoritative, same-origin, render is `textContent`-only). Optional future
  symmetry fix.
- **007 threat-model R18 (High, human-ACCEPTED) — confidence badge / dish-name pill can amplify
  overreliance (OWASP LLM09), evolves carried 002-R14.** The `confidence` badge is the model's own
  **self-reported, uncalibrated** assessment, not a calibrated accuracy metric — "High confidence" can
  render beside a wrong calorie number, and a clean-but-plausible-but-wrong dish name actively defeats
  the pill's stated purpose ("confirm the estimate matches what you photographed"), making a wrong
  number *more* credible rather than less. **Accepted for the prototype** — a product/copy calibration
  question (e.g. framing the badge as a self-assessment, an "estimates are approximate" caveat), not a
  code defect. Same decision-owner as carried 002-R14.
- **007 threat-model R16 (Med, human-ACCEPTED) — prompt injection can now place attacker-chosen
  readable text on screen** (dish name/confidence/count), not just steer an integer (evolves carried
  002-R11). **Contained today:** structured-output schema forbids markup/tools, `validateFoodName`
  bounds it to ≤60 control-free chars, and `textContent`-only render makes it inert — no XSS/injection.
  Self-targeting (the uploader can only deceive themselves). **Pre-registered tripwire — explicit
  pre-condition flag for roadmap 006 (shareable card):** if a future feature ever shows one user's
  model-derived name/badge/count to *another* user, renders it via `innerHTML`/a share-card template,
  or feeds it downstream, R16 re-scores **High** and must be re-assessed before that feature ships.
- **007 threat-model R19 (Low, accepted) — `MAX_TOKENS` raise widens the per-call cost ceiling.** The
  256→1024 bump (see F3 above) quadruples the theoretical worst-case output tokens per call, which
  modestly raises the per-call ceiling of the carried, still-High cost-DoS risk **R9** (unchanged —
  same per-IP window + concurrency cap gate it; no new per-call spend cap was added, same as 002).
- **Large-but-valid photos may silently never estimate (002 review, minor, m2):** a photo up to the
  10 MB upload cap, once base64-encoded (~1.33x), may exceed the Anthropic API's per-image size limit
  (commonly cited ~5 MB base64, i.e. ~3.75 MB raw) — a class of realistic modern phone photos. This
  fails closed ("couldn't estimate"), not unsafely, but silently narrows the effective happy path below
  the advertised 10 MB cap.
- **Prototype gaps (accepted, low/med, carried from 001):** plaintext HTTP (no TLS), no security response
  headers, no request/outbound logging (so cost anomalies and third-party sends are un-auditable —
  threat-model R7).
- **No usage/cost logging (002, new):** there is no record of how many vision-model calls were made,
  when, or at what token cost — cannot verify actual runtime AI spend against the ~$0.006–0.01/estimate
  design estimate without adding logging.
