# 001 — Initial prototype · Code Review (Step 5.5)

**Reviewer independence tier: A** — reviewed by a fresh, isolated subagent that did NOT write this code
and never saw the build reasoning as it was produced. Only inputs were the spec (`20-stories-acs.md`),
the finished code, the ADRs, and the manifest. Author bias removed.

**Scope reviewed:** `src/server.js`, `src/index.html`, `tests/upload.test.js`, `package.json`,
`eslint.config.js`, against ADR-001 / ADR-002 and `20-stories-acs.md`.

**Confirmation runs (read-only):**
- `npm test` → 11 passed (3 starter + 8 feature-001).
- `npm run lint` → 0 problems.
- Live smoke (`PORT=3998`): 11 MB upload → clean `413 {"error":"file too large"}` with
  `size_upload=11000000` (client fully drained, no socket reset, no double response);
  `GET /../server.js` → 404; `GET /upload` → 404; `PUT /upload` → 404.

---

## Verdict

**Ship-ready. No Blockers, no Majors.** The high-risk areas the tests can't easily reach — the
mid-stream 10 MB cap, the drain-then-413 path, content-type spoofing, XSS, and path traversal — were
exercised directly and all hold up. Findings below are Minor/Nit only.

**Counts:** Blockers 0 · Majors 0 · Minors 2 · Nits 3

---

## Findings by severity

### Minor

**M1 — `image/svg+xml` is accepted as a valid image (`src/server.js:97`).**
`mime.startsWith("image/")` admits `image/svg+xml`. SVG is a script-capable format, and while THIS
feature only measures and discards the body (so there is no live XSS today), the later vision-model
feature will consume whatever this endpoint accepts. Right now it is spec-conformant (SVG genuinely
declares `image/*`, and AC2.2's target is non-image types like `text/plain`/`application/pdf`), so this
is not a blocker — but it's a latent risk worth a decision.
*Repro:* `curl -X POST -H 'Content-Type: image/svg+xml' --data-binary @x.svg /upload` → `200`.
*Fix suggestion:* if only raster photos are wanted, allowlist explicit MIME types
(`image/jpeg`, `image/png`, `image/webp`, `image/heic`, …) instead of the `image/` prefix, and record
the choice. Otherwise, flag SVG for handling before the model route ships.

**M2 — Degenerate/empty subtypes pass content-type validation (`src/server.js:96–97`).**
`image/` (empty subtype) and `image/;charset=x` both pass `startsWith("image/")` and would return a
`200` echoing `type:"image/"`. Harmless in this feature (body is only measured), but it means the
`type` field the success contract promises can be a non-canonical MIME.
*Repro:* `curl -X POST -H 'Content-Type: image/' --data-binary @img.jpg /upload` → `200 {type:"image/"}`.
*Fix suggestion:* require a non-empty subtype, e.g. reject when `mime === "image/"` or when the subtype
after `image/` is empty. Folds naturally into the M1 allowlist.

### Nit

**N1 — `settled` guard on `req.resume()` path leaves the drain running unobserved (`src/server.js:55–61`).**
After the cap trips, `req.resume()` drains the rest of the (up to unbounded) body. The `end`/`error`
handlers are correctly guarded by `settled`, so there is no double-settle and no double-response
(verified live). This is *correct*, but there is no cap on how long the client can keep the socket
draining after the 413 — a slow-loris-style client could hold the drained socket open. Not exploitable
for OOM (bytes are discarded) and out of scope for a prototype. *Fix suggestion (optional, later):* set
`server.requestTimeout` / `headersTimeout`, or `req.destroy()` *after* the response has flushed, if DoS
hardening becomes in scope.

**N2 — `readBodyCapped` keeps `chunks` array reference after `chunks.length = 0` (`src/server.js:58`).**
Freeing via `chunks.length = 0` is fine, but the closure still holds `chunks`; a subsequent (impossible,
because `settled`) `data` push is dead. Purely cosmetic — the `settled` guard makes lines 63 unreachable
once oversized. No action needed; noting for clarity.

**N3 — No `Content-Type`/method matrix beyond the two routes (`src/server.js:150–164`).**
`GET /upload`, `PUT /upload`, `POST /` all fall through to `404 {"error":"not found"}`. That is clean and
consistent (verified live), but a `405 Method Not Allowed` for a known path with the wrong method would
be marginally more correct. Optional; 404 is acceptable for a prototype.

---

## Six review lenses

1. **Correctness / logic** — The mid-stream cap is correct: `total > MAX_UPLOAD_BYTES` (strictly greater),
   so exactly 10,485,760 bytes is accepted (boundary test + logic confirm). No off-by-one. The
   `settled` flag prevents double-settle across `data`/`end`/`error`. Drain-then-413 confirmed live with
   an 11 MB body (clean 413, full client drain, no reset). **No blocking finding.** (Minor M1/M2 above.)
2. **Security** — Frontend renders all server text via `textContent` (`src/index.html:37`), never
   `innerHTML`/`eval` — XSS-safe. No secret in client (AC2.5, test-scanned + manual read). Path traversal
   is structurally impossible: only `/` and `/index.html` are served, from a hardcoded `INDEX_HTML_PATH`;
   `URL` normalizes `/../server.js` → 404 (verified). No injection surface. SVG acceptance noted as M1.
   **No security blocker.**
3. **Regression** — Manifest lists no shipped feature; `src/calories.js` + `tests/calories.test.js` are
   untouched and still green (3 tests). Nothing to regress. **None found.**
4. **Edge cases** — empty body (AC2.4), no Content-Type (AC2.1), non-image (AC2.2), oversized (AC2.3),
   exact-cap boundary, case-insensitive MIME, whitespace, charset params, prefix-trickery
   (`imagexfoo` correctly rejected) all handled. Rapid clicks on the frontend just re-issue independent
   fetches with a fresh status message — no state desync. **None blocking** (M1/M2 for degenerate MIMEs).
5. **Simplicity / dead code** — Small, single-purpose, no unused vars (lint clean). Line 63
   (`chunks.push`) is unreachable once oversized due to the `settled` guard, but that's inherent, not dead
   code. **None found** beyond N2.
6. **ADR / decision drift** — **No drift.** Built-in `http` + `fs` only; `package.json` adds no runtime
   dependency (devDeps unchanged: eslint, vitest). No framework, no multipart parser — transport is raw
   binary POST body with MIME from `Content-Type` exactly per ADR-002. No secret in client per ADR-001.

---

## ACs verified checklist

| AC | Verdict | Evidence |
|----|---------|----------|
| AC1.1 file picker + send control | ✅ | `src/index.html:23–24` — `<input type="file" accept="image/*">` + send button, both `data-testid`'d; served-HTML test asserts presence. |
| AC1.2 valid upload → 200 + size + type | ✅ | `server.js:122` returns `{ok:true, size, type}`; integration test + live curl confirm `200`, byte-accurate size, normalized MIME. |
| AC1.3 browser confirmation | ✅ | `index.html:59–61` sets a visible `Photo received: … bytes, …` status via `textContent`; not left in pre-upload state. |
| AC2.1 no file / no Content-Type → 400 | ✅ | `server.js:90–92` → `400 {"error":"no file provided"}`; test + live confirm. |
| AC2.2 non-image → 400/415 | ✅ | `server.js:97–99` → `415 {"error":"file must be an image"}`; robust MIME parsing. (M1: SVG passes — spec-conformant but flagged.) |
| AC2.3 oversized (>10,485,760) → 413/400 | ✅ | `server.js:50` strict `>`; mid-stream abort + drain → clean `413`; live 11 MB test confirms no reset/double-response. |
| AC2.4 zero-byte → 400 | ✅ | `server.js:116–118` → `400 {"error":"file is empty"}`; test confirms. |
| AC2.5 no secret in client | ✅ | No model route built; `index.html` scanned clean (`sk-…`, `api_key`, `anthropic`) + manual read. |

All 8 acceptance criteria are genuinely satisfied by a real code path (not just asserted). No AC gap.

---

## Handoff

Findings are Minor/Nit only and are handed back to **engineering** to accept or address; the
reviewer made no code changes. **M1 (SVG acceptance)** is the one worth an explicit decision before the
vision-model route consumes this endpoint — recommend recording that choice (allowlist vs. accept SVG)
in engineering's build notes or a short ADR. Nothing here blocks QA. The ship call is the human's.
