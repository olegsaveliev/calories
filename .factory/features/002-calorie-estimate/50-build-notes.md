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
