# Manifest — CURRENT STATE of Calories

> ★ Every skill/agent reads this FIRST, before doing anything. It answers:
> "What already exists? What must I not break?"
> The LAST step of every feature run (delivery-pm / wrap) updates this file.

**Last updated:** 2026-07-13
**Current version:** 0.1.0

## Features that exist right now

| ID  | Feature           | Status    | Shipped    | Spec folder                        |
|-----|-------------------|-----------|------------|------------------------------------|
| 001 | Initial prototype | delivered | 2026-07-13 | `features/001-initial-prototype/`  |

## Live surfaces (files that make up the running app)
- `src/server.js` — the single Node service (built-in `http` + `fs`, ESM, no runtime dep). Exports
  `requestHandler`, `createServer`, `MAX_UPLOAD_BYTES`. Routes: static `GET /` + `/index.html`
  (serves the frontend), and `POST /upload` (raw-binary upload endpoint).
- `src/index.html` — upload UI: file picker (`<input type="file" accept="image/*">`) + send button +
  a `textContent` confirmation area that renders the server's success message.
- `tests/upload.test.js` — Vitest integration suite (mounts `createServer()` on port 0, hits it with
  real HTTP; covers every server AC + a cap boundary test + the AC2.5 secret scan).
- `src/calories.js` — starter module (`formatCalories`); still exists (toolchain proof), untouched by 001.
- `tests/calories.test.js` — starter Vitest suite; still green.

## Data model
_No persisted data model — the upload body is measured then discarded (no disk/DB)._

**`POST /upload` contract (ADR-002 raw binary transport).** Request = raw image bytes as the request
body, MIME in the `Content-Type` header.
- **Success:** `200 { ok: true, size: <bytes:number>, type: "<mime:string>" }` (`size` = streamed byte
  count; `type` = normalised lowercased, `;`-stripped `Content-Type`).
- **Errors** (all JSON `{ error: "<string>" }`): `400` no-file (no/empty `Content-Type`) · `415`
  non-image (`Content-Type` not `image/*`) · `413` oversized (`> 10,485,760` bytes) · `400` empty
  (0-byte body) · `404` unknown route/method.
- **Size cap:** `MAX_UPLOAD_BYTES = 10 * 1024 * 1024 = 10,485,760` bytes; enforced mid-stream (aborts
  the moment the running total strictly exceeds the cap). Exactly 10,485,760 bytes is accepted.

## Key decisions in force
_(one-liner here → full reasoning + rejected alternatives in `decisions/`)_
- **ADR-001** — Calories is ONE Node service: serves the frontend + owns the only vision-model API route;
  the model API key is server-side only (never in client code / committed files). No framework or build
  tool without a new ADR. → `decisions/001-node-service-stack.md`
- **ADR-002** — upload transport = **raw binary POST** (File sent as the raw request body; MIME in the
  `Content-Type` header). No multipart/parser dependency (or framework) without a superseding ADR.
  → `decisions/002-raw-binary-upload-transport.md`

## Known limitations / tech debt
- **R1 concurrency memory / R2 slow-loris** (threat-model High): the per-request 10 MB cap does NOT bound
  aggregate in-flight memory, and there are no request timeouts. **Accepted for the localhost prototype —
  MUST resolve (concurrency/aggregate memory cap + `server.requestTimeout`/`headersTimeout`) before any
  exposure beyond localhost.**
- **R3 / M1 / M2 MIME allowlist** (review Minor + threat-model Med): `image/svg+xml` and degenerate
  `image/` subtypes pass `startsWith("image/")`. Benign now (body is discarded). **HARD pre-condition on
  the future vision-model route: replace with an explicit raster-MIME allowlist and decide SVG policy
  BEFORE that route consumes uploads.**
- **Frontend behaviour not yet E2E-tested:** the upload click→fetch→confirmation render is covered only
  by static-HTML shape assertions + live manual verification, not an automated browser test. The qa
  skill's test-tier trigger will recommend Playwright on the first feature that renders a result the user
  reads (e.g. the calorie estimate).
- **Prototype gaps (accepted, low/med):** plaintext HTTP (no TLS), no rate limiting, no security response
  headers, no request logging.
