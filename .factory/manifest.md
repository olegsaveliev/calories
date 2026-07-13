# Manifest — CURRENT STATE of Calories

> ★ Every skill/agent reads this FIRST, before doing anything. It answers:
> "What already exists? What must I not break?"
> The LAST step of every feature run (delivery-pm / wrap) updates this file.

**Last updated:** 2026-07-13
**Current version:** 0.3.0

## Features that exist right now

| ID  | Feature           | Status    | Shipped    | Spec folder                        |
|-----|-------------------|-----------|------------|------------------------------------|
| 001 | Initial prototype | delivered | 2026-07-13 | `features/001-initial-prototype/`  |
| 002 | Calorie estimate  | delivered | 2026-07-13 | `features/002-calorie-estimate/`   |
| 003 | Redesign (Midnight Lime UI) | delivered | 2026-07-13 | `features/003-redesign/` |

## Live surfaces (files that make up the running app)
- `src/server.js` — the single Node service (built-in `http` + `fs`, ESM, no runtime dep). Exports
  `requestHandler`, `createServer`, `MAX_UPLOAD_BYTES`. Routes: static `GET /` + `/index.html`
  (serves the frontend), and `POST /upload` (raw-binary upload endpoint; now also calls the vision
  model and rate-limits before doing so — see 002 below).
- `src/vision.js` (new, 002) — the vision-model client. Exports `SUPPORTED_RASTER_MIME_TYPES`
  (`["image/jpeg", "image/png"]` — see narrowed contract below), `isSupportedRasterMime(mime)`,
  `estimateCalories(imageBuffer, mime)` → `Promise<{status:"estimated",calories}|{status:"no_food"}|{status:"unavailable"}>`.
  Calls `POST https://api.anthropic.com/v1/messages` via built-in `fetch` (no `@anthropic-ai/sdk`,
  ADR-001 honoured), model `claude-sonnet-5`, `thinking: {type:"disabled"}`, structured-output
  json_schema `{food_identified, calories}`, 30s `AbortController` ceiling, 1–5000 kcal plausibility
  band (R15). Strips EXIF/GPS via `strip-metadata.js` immediately before base64-encoding (R10 — see
  known limitations for the partial-closure caveat). `ANTHROPIC_API_KEY` read from `process.env` only.
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
  fallback. **Wires only the total-calorie number** from the existing `calorieResult` — every other
  field the design mock shows (food-name pill, "± NN" range, items-seen/confidence tiles) belongs to
  feature 007 and is honestly neutralized (pill omitted, "± NN" dropped, tiles render a literal "—"),
  never fabricated. All response-derived text still reaches the DOM via `textContent` only (no
  `innerHTML`), preserving the 001/002 XSS posture. Keyboard-operable dropzone (Enter/Space opens the
  file picker), visible `:focus-visible` rings on every control, ≥44×44px tap targets, and a
  `prefers-reduced-motion` guard on the two looping animations are all built in.
  **`src/server.js`, `src/vision.js`, `src/rate-limit.js`, `src/strip-metadata.js` and the
  `POST /upload` contract are UNCHANGED by 003 — this was a frontend-only visual/structural rebuild.**
- `tests/upload.test.js` — Vitest integration suite (mounts `createServer()` on port 0, hits it with
  real HTTP; covers every server AC + a cap boundary test + the AC2.5 secret scan + (002) the vision
  call, MIME allowlist, rate-limit, and metadata-strip paths end-to-end, with `api.anthropic.com`
  intercepted by a `fetch` dispatcher and everything else passed through). **(003)** gained static-HTML
  shape-assertions for the rebuilt frontend: both screens present, narrowed
  `accept="image/jpeg,image/png"`, CTA disabled-by-default with `aria-disabled`, hero/error/back/
  new-photo/try-again hooks present, stat tiles render only "—", and an explicit negative assertion
  that none of the feature-007 demo values (642 / "Grilled chicken bowl" / "± NN" / "3 items seen" /
  "High confidence") appear anywhere in the shipped file. These are static-markup assertions only — the
  client-side state machine itself is not browser-exercised (see Known limitations).
- `tests/vision.test.js` (new, 002) — unit tests for `estimateCalories`/`isSupportedRasterMime`
  (request shape, all fail-closed branches, the R15 plausibility band, R10 egress assertions).
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
  - `{ status: "estimated", calories: <integer, 1–5000> }` — usable vision-model estimate.
  - `{ status: "no_food" }` — model could not identify food, or returned no usable number.
  - `{ status: "unavailable" }` — any failure (timeout, non-2xx, refusal, unparseable, network error,
    out-of-band value).
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

## Known limitations / tech debt

**Hard gate (unchanged by 003 — this was a frontend-only rebuild that never touched the server) — MUST
resolve before any exposure beyond localhost:**
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
- **Frontend behaviour still not E2E-tested (carried forward from 002, now larger surface area after
  003).** The redesign's entire client-side state machine — the 5-state transitions, the double-submit
  guard (AC2.2), the `calorieResult` → view mapping, object-URL create/revoke lifecycle, drag-and-drop,
  keyboard dropzone activation, the ring/skeleton animations and their `prefers-reduced-motion` guard,
  and the "Try again" re-submit path — is covered only by static-HTML string assertions in
  `tests/upload.test.js`, not by a running browser. QA specified a 24-case Playwright tier for exactly
  this surface. **Human decision: ship 003 now; Playwright queued as follow-up roadmap 008.**
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
