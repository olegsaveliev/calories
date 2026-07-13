# 001 — Initial prototype · Status (delivered)

**Feature:** 001 — Initial prototype · **Version:** v0.1.0 · **Delivered:** 2026-07-13
**PR:** #2 · **Issue:** #1

## What shipped
The first end-to-end slice of Calories and the first stand-up of the Node service.
A browser file picker sends a food photo to a single Node upload endpoint; the server
receives the raw bytes, validates them, and confirms receipt back to the browser.

- `src/server.js` — the single Node service (built-in `http` + `fs`, ESM, no runtime dep):
  serves the frontend (`GET /`, `/index.html`) and owns `POST /upload`.
- `src/index.html` — real frontend: `<input type="file" accept="image/*">` + send button +
  a `textContent`-rendered confirmation area.
- `tests/upload.test.js` — Vitest integration suite (starts server on port 0, real HTTP).

## Acceptance criteria — all 8 met
AC1.1 file picker + send control · AC1.2 valid upload → 200 `{ok,size,type}` · AC1.3 browser
confirmation · AC2.1 no-file → 400 · AC2.2 non-image → 415 · AC2.3 oversized (>10 MB) → 413 ·
AC2.4 zero-byte → 400 · AC2.5 no secret in client. Each verified by a real code path
(reviewer + QA confirmed), not just asserted. `npm test` → 11 passed · `npm run lint` → 0 problems.

## Key decisions
- **ADR-001 (in force)** — ONE Node service; model key server-side only; no framework/build
  tool/runtime dep without a new ADR. Honoured (no framework, no dep, no model route built).
- **ADR-002 (accepted)** — upload transport = raw binary POST (File as raw request body).
  Chosen over multipart (Option A, needs a parser dep) and base64 JSON (Option C, ~33% overhead
  + whole-body buffering). Human confirmed Option B at the options gate.

## Review verdict
Ship-ready — **0 Blockers, 0 Majors** (isolated Tier-A review). 2 Minors + 3 Nits, all accepted
and logged. Mid-stream 10 MB cap, drain-then-413, content-type spoofing, XSS, and path traversal
were exercised directly and hold up.

## Risk posture
Threat model (STRIDE): 8 risks — 2 High (R1, R2), 3 Med (R3, R4, R5), 3 Low. **Human accepted
R1–R8 for the localhost prototype.** OWASP-LLM / lethal-trifecta pass N/A (no model in scope).

## Runtime AI cost
**N/A — no AI/model in this feature.** The vision-model route is explicitly deferred to a later
feature; no runtime model calls, no gateway log to report.

## Outstanding conditions (carried into the manifest's known-limitations)
1. **R1 concurrency/aggregate memory + R2 request timeouts** — MUST resolve
   (concurrency/aggregate cap + `server.requestTimeout`/`headersTimeout`) **before any exposure
   beyond localhost.**
2. **R3/M1/M2 MIME allowlist** — replace `startsWith("image/")` with an explicit raster-MIME
   allowlist and decide SVG policy **before** the future vision-model route consumes uploads.
3. **Frontend behaviour not yet E2E-tested** — the click→fetch→confirmation render is covered
   only by static-HTML shape assertions + live manual verification. Playwright to be recommended
   on the first feature that renders a user-read result (e.g. the calorie estimate).
