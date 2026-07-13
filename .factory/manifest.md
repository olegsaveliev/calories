# Manifest — CURRENT STATE of Calories

> ★ Every skill/agent reads this FIRST, before doing anything. It answers:
> "What already exists? What must I not break?"
> The LAST step of every feature run (delivery-pm / wrap) updates this file.

**Last updated:** 2026-07-13
**Current version:** 0.2.0

## Features that exist right now

| ID  | Feature           | Status    | Shipped    | Spec folder                        |
|-----|-------------------|-----------|------------|------------------------------------|
| 001 | Initial prototype | delivered | 2026-07-13 | `features/001-initial-prototype/`  |
| 002 | Calorie estimate  | delivered | 2026-07-13 | `features/002-calorie-estimate/`   |

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
- `src/index.html` — upload UI: file picker (`<input type="file" accept="image/*">` — not yet narrowed
  to reflect the JPEG/PNG-only backend, see known limitations) + send button + a `textContent` result
  area. Now (002) branches on `calorieResult.status` to render "~N calories" / "couldn't identify a
  meal" / "couldn't estimate calories" / "unsupported file type", and carries a one-line privacy
  notice (`data-testid="privacy-notice"`) that the photo is sent to Anthropic's model and metadata is
  stripped first.
- `tests/upload.test.js` — Vitest integration suite (mounts `createServer()` on port 0, hits it with
  real HTTP; covers every server AC + a cap boundary test + the AC2.5 secret scan + (002) the vision
  call, MIME allowlist, rate-limit, and metadata-strip paths end-to-end, with `api.anthropic.com`
  intercepted by a `fetch` dispatcher and everything else passed through).
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

## Known limitations / tech debt

**Hard gate (unchanged, now MORE ACUTE and with more items folded in) — MUST resolve before any exposure
beyond localhost:**
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
- **UI copy (002, cosmetic).** `src/index.html`'s file input still has `accept="image/*"` and the copy
  doesn't state the JPEG/PNG-only limit up front — a user can pick a GIF/WebP/HEIC file and only learns
  it's unsupported via the 415 response.
- **Frontend behaviour still not E2E-tested:** the upload click→fetch→result render (including the three
  002 branches — estimate / no_food / unavailable) is covered only by static-HTML shape assertions +
  one-off live manual verification, not an automated browser test. QA's test-tier trigger flags
  Playwright as warranted now that the app renders a model-derived result the user reads.
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
