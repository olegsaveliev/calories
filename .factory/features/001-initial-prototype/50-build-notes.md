# 001 — Initial prototype · Build notes

**Stack:** Node ESM, built-in `http` + `fs` only. No framework, no build tool, **no new runtime
dependency** (honours ADR-001). Upload transport = raw binary POST body (honours ADR-002).

## Files touched

| File | Change |
|------|--------|
| `src/server.js` | **New.** The single Node service: serves the frontend (`GET /`) and owns the one upload endpoint (`POST /upload`). Exports `requestHandler`, `createServer`, `MAX_UPLOAD_BYTES` so tests can mount it on an ephemeral port. Starts on `PORT` (default 3000) only when run directly. |
| `src/index.html` | **Replaced** the placeholder. Real frontend: `<input type="file" accept="image/*">`, a send button, and a live-region confirmation area. Sends via `fetch('/upload', { method:'POST', body:file, headers:{'Content-Type':file.type} })` (ADR-002). Server text rendered with `textContent` only (never `innerHTML`). |
| `tests/upload.test.js` | **New.** Integration tests: start `createServer()` on port 0, hit it with real `fetch` HTTP requests, assert status + JSON for every server AC, plus a boundary test and an AC2.5 secret-scan of `index.html`. |
| `package.json` | Added `"start": "node src/server.js"`. No dependency changes. |
| `eslint.config.js` | Added `Buffer`, `URL`, `fetch` to the readonly globals list (used by server + tests). |
| `src/calories.js`, `tests/calories.test.js` | **Kept** unchanged (starter toolchain proof; suite still green). |

## Endpoint contract — `POST /upload`

Request: raw image bytes as the request body; MIME in the `Content-Type` header (ADR-002).

**Success (AC1.2):**
```
HTTP 200  { "ok": true, "size": <bytes:number>, "type": "<mime:string>" }
```
`size` = streamed byte count of the received body. `type` = normalised (lowercased, `;`-stripped)
request `Content-Type`.

**Errors** — all JSON with a machine-checkable `{ "error": "<string>" }` shape:

| Case | Status | Body |
|------|--------|------|
| No / empty `Content-Type` (AC2.1) | `400` | `{ "error": "no file provided" }` |
| Non-image `Content-Type` (AC2.2) | `415` | `{ "error": "file must be an image" }` |
| Oversized, `> 10,485,760` bytes (AC2.3) | `413` | `{ "error": "file too large" }` |
| Zero-byte body (AC2.4) | `400` | `{ "error": "file is empty" }` |
| Unknown route/method | `404` | `{ "error": "not found" }` |

**Size cap:** `MAX_UPLOAD_BYTES = 10 * 1024 * 1024 = 10,485,760`. Enforced **on the incoming stream** —
a running byte count is kept as chunks arrive; the moment it strictly exceeds the cap, buffering stops
(collected bytes freed, no full-body buffering) and the stream is drained so the `413` flushes cleanly
to the client. Exactly 10,485,760 bytes is accepted (covered by a boundary test).

## Data fields

No persisted data model. The upload body is measured and discarded (no disk/DB — out of scope). The only
data shape introduced is the success response `{ ok, size, type }` above.

## How each AC is exercised

| AC | Where | How |
|----|-------|-----|
| AC1.1 file picker + send control | `src/index.html` + `tests/upload.test.js` ("served HTML has file input…") | Served HTML asserted to contain `data-testid="file-input"`, `accept="image/*"`, and `data-testid="send-button"`. |
| AC1.2 valid upload → 200 + size + type | integration test "AC1.2" | Real POST of image bytes with `image/jpeg`; asserts `200`, `ok:true`, `size===body.length`, `type==='image/jpeg'`. Also verified live via curl. |
| AC1.3 browser confirmation | `src/index.html` + served-HTML test | On `res.ok && data.ok`, status area shows `Photo received: <size> bytes, <type>.` via `textContent`; served HTML asserted to contain the `data-testid="status"` confirmation container. |
| AC2.1 no file / no Content-Type | integration test "AC2.1" | POST with empty `Content-Type` → `400`, `{error}` string, not `200`. |
| AC2.2 non-image | integration test "AC2.2" | POST `text/plain` → `415` (∈ {400,415}), `{error}` string, not `200`. |
| AC2.3 oversized | integration test "AC2.3" + boundary test | POST `MAX+1` bytes → `413` (∈ {413,400}); `MAX` exactly → `200`. |
| AC2.4 zero-byte | integration test "AC2.4" | POST empty `image/jpeg` body → `400`, `{error}` string, not `200`. |
| AC2.5 no secret in client | integration test "AC2.5" | `index.html` scanned: no `sk-…` key, no `api[_-]?key`, no `anthropic`. No model route built, so nothing to expose. |

## Verification

- `npm run lint` → **pass** (ESLint, 0 problems).
- `npm test` → **pass** — 2 files, **11 tests** (3 starter + 8 feature-001).
- Live smoke test (curl against `npm start` on `PORT=3999`): `GET /` → 200 HTML; valid upload → 200
  `{ok,size,type}`; no-Content-Type → 400; `text/plain` → 415; empty image → 400.

## Run locally

```
npm install
npm start          # http://localhost:3000  (override with PORT=…)
npm run lint
npm test
```
