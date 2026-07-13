# 002 — Calorie estimate · Build notes

**Status:** implemented per `30-design.md` (settled; model = `claude-sonnet-5`, human-picked
2026-07-13). No new ADR — see design doc's "ADR decision" section (all choices reversible).

## What changed

### `src/vision.js` (new)
The vision-model module. Exports:
- `SUPPORTED_RASTER_MIME_TYPES` — `["image/jpeg", "image/png", "image/gif", "image/webp"]` (Story 2
  allowlist; `image/svg+xml` and any other `image/*` subtype are deliberately excluded).
- `isSupportedRasterMime(mime)` — allowlist check.
- `estimateCalories(imageBuffer, mime)` → `Promise<CalorieResult>` where `CalorieResult` is one of:
  - `{ status: "estimated", calories: <non-negative integer> }`
  - `{ status: "no_food" }`
  - `{ status: "unavailable" }`

Implementation per the design's settled decisions:
- Calls `POST https://api.anthropic.com/v1/messages` with the **built-in `fetch`** — no
  `@anthropic-ai/sdk`, no new runtime dependency (ADR-001 honoured).
- `model: "claude-sonnet-5"`, `max_tokens: 256`, no `thinking` param (design: "omit thinking" —
  cheap/fast single extraction), non-streaming.
- Image sent as `{ type: "image", source: { type: "base64", media_type: mime, data: <base64> } }` —
  base64-encodes the existing raw `Buffer` from the upload handler (ADR-002's decode-free buffer).
- `output_config.format` = `json_schema` constraining the reply to
  `{ food_identified: boolean, calories: integer|null }` (`additionalProperties: false`,
  `required: [food_identified, calories]`).
- `ANTHROPIC_API_KEY` read from `process.env` only — never logged, never sent to the client, never
  committed. If unset, `estimateCalories` fails closed immediately and **does not call `fetch` at
  all** (verified in `tests/vision.test.js`).
- 30 s latency ceiling via `AbortController` + `setTimeout` (referenced through `globalThis.*` so no
  new ESLint global config was needed — out of this feature's write scope).
- Fail-closed mapping, all funnelling to `"unavailable"` except the one recognised `"no_food"` case:
  non-2xx response, `stop_reason: "refusal"` (checked **before** touching `content`, per the model's
  refusal-handling guidance), unparseable JSON in the reply, wrong shape, non-integer or negative
  `calories`, any thrown error (network failure, abort/timeout). The model's output is treated as
  **untrusted** the whole way through — only a validated integer is ever returned; free text is
  never surfaced.

### `src/server.js`
- Imports `isSupportedRasterMime` and `estimateCalories` from `./vision.js`.
- `handleUpload`: replaced the old `mime.startsWith("image/")` check with
  `isSupportedRasterMime(mime)` (Story 2 / AC2.1–AC2.2) — checked **before** the body is read, so an
  unsupported/ambiguous type (incl. `image/svg+xml`) is rejected with `415 { error: "unsupported file
  type" }` and never reaches the model. Closes manifest R3/M1/M2 for this route.
- After the existing 001 checks pass (no-file 400, allowlist 415, oversize 413, empty 400), the
  handler now calls `estimateCalories(body, mime)` and adds a `calorieResult` field to the existing
  `200 { ok, size, type }` success envelope:
  - `{ ok: true, size, type, calorieResult: { status: "estimated", calories: N } }`
  - `{ ok: true, size, type, calorieResult: { status: "no_food" } }`
  - `{ ok: true, size, type, calorieResult: { status: "unavailable" } }`
  The 001 success envelope shape (`ok`, `size`, `type`) is unchanged/additive — `calorieResult` is a
  new field, not a breaking change.

### `src/index.html`
- The inline script now branches on `data.calorieResult.status`:
  - `"estimated"` → renders `~N calories` (AC1.1) in place of the old plain "file received" line.
  - `"no_food"` → renders "Couldn't identify a meal in this photo." (AC3.1), no number.
  - anything else (`"unavailable"`) → renders "Couldn't estimate calories, try again." (AC1.2), no
    number.
  - `415` responses get an explicit "Unsupported file type." message (AC2.2).
- No API key or Anthropic reference added to client code (verified by the existing
  `tests/upload.test.js` "no secret in client code" scan, which still passes).

## Tests added

- **`tests/vision.test.js`** (new, 16 tests) — unit-level coverage of `estimateCalories` and
  `isSupportedRasterMime`: happy path, request-shape assertions (model/max_tokens/schema/image
  block), `no_food` on `food_identified:false` and on `calories:null`, fail-closed on non-2xx,
  refusal, unparseable JSON, non-integer calories, negative calories, network error, simulated
  abort/timeout, and the no-key/no-network-call case. `global.fetch` is stubbed via
  `vi.stubGlobal` in every test — no real network call is made.
- **`tests/upload.test.js`** (extended) — added three new `describe` blocks exercising the full
  HTTP round-trip through `createServer()` (same pattern as the existing 001 suite):
  - Story 1 (AC1.1/AC1.2): estimated result, non-2xx, network error, refusal, unparseable reply.
  - Story 2 (AC2.1/AC2.2): PNG forwarded to the model; `image/svg+xml` and a degenerate `image/*`
    subtype rejected with 415 and **never** reach the model (asserted via a call counter).
  - Story 3 (AC3.1/AC3.2): `food_identified:false` → `no_food`; two identical uploads each trigger
    their own independent model call (call counter reaches 2, proving no caching).
  - The outbound Anthropic call is intercepted by a `fetch` dispatcher that only mocks requests to
    `api.anthropic.com` and passes everything else (the test's own calls to the local ephemeral
    server) through to the real `fetch` — necessary because vision.js and the test HTTP client share
    the same global `fetch`. `ANTHROPIC_API_KEY` is stubbed to a dummy value via `vi.stubEnv` so the
    suite is deterministic regardless of whatever key is present in the local/dev environment.

**Note on the local dev environment:** this machine has a real `ANTHROPIC_API_KEY` exported. Before
adding the fetch mock, the pre-existing 001 upload test was unintentionally making a real API call
(visible as ~1.5s test latency). The mock now fully intercepts every Anthropic-bound request in the
suite, confirmed by the test run duration dropping from ~2.8s to ~0.4s. Separately (outside the test
suite), I ran one live sanity check directly against the real API with a synthetic 1×1 PNG and with
`curl` through the actual running server — both correctly returned `{"status":"no_food"}`, confirming
the model ID, structured-output schema, and request shape are accepted by the real API and that the
415 allowlist rejection works end-to-end. No verification artifacts were left in the repo.

## Data model / contract changes

- `POST /upload` success response gains one new field: `calorieResult` (see shape above). No
  existing field removed or renamed — additive only.
- `POST /upload` 415 error message text changed from `"file must be an image"` to `"unsupported file
  type"` (the error contract — `415` status + `{ error: <string> }` shape — is unchanged; only the
  message string changed, which the 001 tests never asserted on beyond `typeof json.error ===
  "string"`).
- New environment variable consumed: `ANTHROPIC_API_KEY` (read-only, server-side; not in any
  committed file).

## Known limitations carried forward (per 30-design.md, unchanged)

- R1 (aggregate in-flight memory) and R2 (no inbound request timeouts) are **more acute** now (each
  request holds the image buffer + its base64 copy for the multi-second model round-trip) but the
  manifest's accepted "localhost-only" posture is unchanged — still must be resolved before any
  exposure beyond localhost.
- No persistence anywhere (AC3.2 falls out for free — verified by the independent-call test).

## Review fix (M1, human-dispositioned)

- **M1 fixed:** `src/vision.js` now sends `thinking: { type: "disabled" }` explicitly in the
  Messages API request. Omitting the field on `claude-sonnet-5` means adaptive thinking ON, and
  thinking tokens share `max_tokens` — a real food photo could exhaust the 256-token budget before
  the structured JSON was emitted (`stop_reason: max_tokens` → parse fail → fail-closed on a VALID
  photo). This applies 30-design.md decision 3 ("no extended thinking") explicitly. Field shape
  verified against the API reference. `tests/vision.test.js` request-shape test now asserts the
  outbound body carries `thinking: { type: "disabled" }`. Re-verified live against the real API
  (2xx + parsed structured reply). Lint + all 37 tests green. Minors m2/m3 were accepted & logged,
  not fixed (per disposition).

## Threat-model fixes (R9 / R10 / R12 / R15)

The threat-model HITL gate blocked the merge on four findings. All four are fixed; no new runtime
dependency, no framework, key still env-only (ADR-001 intact).

### R9 — unbounded model spend (High) → `src/rate-limit.js` (new)
`POST /upload` is unauthenticated and every accepted request spends real money. Added a plain,
in-process, dependency-free guard with two caps, both checked **before** the API call:
- **Per-IP fixed window** — `RATE_LIMIT_MAX_PER_WINDOW = 10` calls per `RATE_LIMIT_WINDOW_MS = 60_000`
  per client IP (`req.socket.remoteAddress`).
- **Global in-flight concurrency** — `MAX_CONCURRENT_VISION_CALLS = 2` across all clients. This also
  bounds the R1 memory problem (at most 2 requests can pin their ~3× base64 footprint at once).

Exceeding either returns **`429 { error }`** with no `calorieResult` — a refusal, never a fabricated
number. `acquireVisionSlot()` returns a `release()` that `server.js` calls in a `finally`, so a throw
cannot leak a slot; `release()` is idempotent. All three limits are exported as named constants and
`resetRateLimits()` is exported so tests can drive them. State is per-process (correct for the
single-process localhost service; it would not coordinate across replicas — the manifest's
"resolve before exposure beyond localhost" gate still stands).

### R10 — meal photos with EXIF/GPS leave the box, silently (High) → `src/strip-metadata.js` (new) + `src/index.html`
**(a) Strip before egress.** New module walks the container structurally and drops the
metadata-bearing segments, leaving compressed pixel data byte-for-byte untouched (no re-encode, so
fidelity is exactly preserved):
- **JPEG** — drops **all** APPn segments (`0xFFE0`–`0xFFEF`, incl. **APP1 = EXIF/GPS**) and COM
  comments; keeps DQT/SOF/DHT/etc. and copies the scan data through verbatim.
- **PNG** — keeps critical chunks (detected via the case bit, so unknown critical chunks survive) plus
  an explicit ancillary **keep**-list (`tRNS gAMA cHRM sRGB iCCP sBIT bKGD pHYs acTL fcTL fdAT`), and
  drops everything else — so `eXIf`/`tEXt`/`zTXt`/`iTXt`/`tIME` **and any unknown ancillary chunk**
  cannot smuggle data out. Chunk bytes are unmodified, so the original CRCs stay valid.

Called inside `estimateCalories()` immediately before base64 — the last choke point before TB-3 — and
the result (`safeBuffer`), never the original buffer, is what gets sent. An image that cannot be
provably stripped returns `null` → **fail-closed, never sent unstripped**.

> **Allowlist narrowed as a direct consequence (deliberate, per the disposition's "a format that
> can't be safely stripped is a fail-closed reject, not a silent pass-through"):**
> `SUPPORTED_RASTER_MIME_TYPES` is now **`image/jpeg` + `image/png`** only. **`image/gif` and
> `image/webp` are now rejected with 415.** Stripping them dependency-free would mean walking GIF's
> LZW-interleaved blocks and rewriting WebP's RIFF/VP8X chunk flags — enough parsing surface to risk
> corrupting the pixels. JPEG/PNG cover the real product path (camera photos, screenshots), and
> EXIF/GPS — the thing R10 is about — is overwhelmingly a JPEG concern. **This is a user-visible
> narrowing of the design's original 4-type allowlist and should be reflected in the manifest.**

**(b) Tell the user.** `src/index.html` now carries a plain one-line notice (`data-testid="privacy-notice"`),
no dark patterns: the photo is sent to Anthropic's Claude model to estimate the calories, location and
camera metadata are removed before it is sent, and neither the photo nor the estimate is stored.

### R12 — `.gitignore` had no `.env` pattern → `.gitignore`
Added `.env`, `.env.*`, with a `!.env.example` negation. The obvious place a developer would put
`ANTHROPIC_API_KEY` is now structurally un-committable. No key or secret is in any file.

### R15 — no plausibility bound on the model's integer → `src/vision.js`
Added `MIN_PLAUSIBLE_CALORIES = 1` / `MAX_PLAUSIBLE_CALORIES = 5000` (a single meal; 5000 sits well
above any realistic plate, so a genuine estimate is never clipped). A value outside the band **fails
closed through the existing "couldn't estimate" path**. It is deliberately **not clamped** to the
boundary — rewriting the model's answer into a plausible-looking number would be fabricating one,
which the AI Eval Card forbids. So `999999999` now yields "couldn't estimate", not "~999999999 calories".

### Tests
`npm run lint` clean; `npm test` **70/70 green** (was 37). New/changed:
- `tests/rate-limit.test.js` (new) — per-IP cap, per-IP isolation, window rollover, concurrency cap,
  idempotent release.
- `tests/strip-metadata.test.js` (new) — asserts the GPS needle is **gone from the stripped bytes**,
  that APPn/COM and eXIf/tEXt/tIME are removed, that DQT/tRNS/pixel data **survive byte-for-byte**, and
  that malformed/truncated/unstrippable input fails closed (returns `null`).
- `tests/image-fixtures.js` (new) — structurally valid JPEG (with APP1/EXIF + COM) and PNG (with
  eXIf/tEXt/tIME) fixtures carrying a `SECRET_GPS_MARKER` needle, so the strip tests prove removal on
  real bytes rather than just that a function ran.
- `tests/vision.test.js` — now uses the real fixtures; adds R10 egress assertions (the **base64 actually
  POSTed** contains no GPS needle; an unstrippable image is never sent and spends nothing) and the full
  R15 band matrix (absurd value, zero, both edges accepted, one-over rejected).
- `tests/upload.test.js` — adds the R9 429 paths (budget exhaustion spends no extra call; concurrency
  overflow is refused not queued; a 429 carries no number), the R10 end-to-end egress-strip assertion,
  gif/webp now 415, the R15 HTTP path, and a check for the privacy notice.
- The AC2.5 secret scan previously forbade the literal string `/anthropic/i` in `index.html`. R10(b)
  **requires** naming the third party, so that assertion was replaced with checks for an actual
  key/secret (`sk-…`, `api[_-]?key`, `ANTHROPIC_API_KEY`). The scan still does its real job.

### Live verification (against the real API)
- Built a genuine EXIF/GPS-bearing JPEG. `stripImageMetadata` removed exactly the 72-byte APP1
  segment; **Pillow still decodes the stripped image and its pixels are bit-identical** to the
  original — the strip does not corrupt real photos.
- Uploaded it through the running server to the real Messages API: got a valid `200` + parsed
  structured reply (`no_food`), proving the **API accepts the stripped bytes**.
- Confirmed live: `image/gif` → **415**; the 10th call from one IP within the window → **429**.
- ⚠️ **The dev `ANTHROPIC_API_KEY` ran out of credit** during this verification burst (the API began
  returning `400 "credit balance is too low"`). The app handled it exactly as designed — fail-closed to
  "couldn't estimate", no fabricated number — but **the happy-path "~N calories" render could not be
  re-demoed live afterwards.** Top up the key's balance before a live demo. (Not a code defect; the
  happy path is covered by tests.)
