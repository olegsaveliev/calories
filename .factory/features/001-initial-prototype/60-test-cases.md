# 001 — Initial prototype · Test cases (risk-driven)

**Scope.** The single Node service: `GET /` (frontend) and `POST /upload` (raw-body upload
endpoint). Contract per `50-build-notes.md`: success `200 {ok,size,type}`; errors `{error}` JSON —
400 no-file, 415 non-image, 413 oversized, 400 empty; cap = `10,485,760` bytes (10 MB).

**How to read the columns.** Each row is one concrete input + one machine-checkable OR user-visible
expected outcome. **Automated?** says whether the existing Vitest suite (`tests/upload.test.js`)
already covers it, or whether it is manual/exploratory. This suite does **not** set the release bar,
severity, or make the ship call — that is the human's.

**Setup for manual/curl cases.** `npm start` (defaults to `http://localhost:3000`; override `PORT`).
Byte-exact bodies made with e.g. `head -c <N> /dev/zero > body.bin`.

---

## Story 1 — Pick a food photo and send it (happy paths)

| # | Input | Expected outcome | Automated? |
|---|-------|------------------|------------|
| H1 | `POST /upload`, `Content-Type: image/jpeg`, non-empty JPEG bytes | `200`, body `{ ok:true, size:<byte count of body>, type:"image/jpeg" }` | **Automated** — `AC1.2` test (uses `jpegBytes()`). |
| H2 | `POST /upload`, `Content-Type: image/png`, non-empty PNG bytes | `200`, body `{ ok:true, size:<byte count>, type:"image/png" }` | **Partly** — boundary test posts `image/png` and asserts 200+size, but not a small typical PNG. Manual: `curl -X POST --data-binary @small.png -H 'Content-Type: image/png' localhost:3000/upload` → `200 {ok,size,type:"image/png"}`. |
| H3 | AC1.1 — open app URL in a browser, page loads | A visible file input `accept="image/*"` (`data-testid="file-input"`) AND a send control (`data-testid="send-button"`) are present in the DOM | **Automated** (DOM-string level) — served-HTML test asserts both testids + `accept="image/*"`. Manual: confirm they are visibly rendered/clickable in a real browser. |
| H4 | AC1.3 — in the browser, pick a valid image, click send, server returns 200 | Confirmation area (`data-testid="status"`) shows a visible message like `Photo received: <size> bytes, <type>.` (page does NOT stay in its pre-upload state) | **Partly** — served-HTML test asserts the `status` container exists; the *rendered confirmation after a real upload* is **manual/exploratory** (needs a browser, not covered by the HTTP suite). |

---

## Story 2 — Reject bad uploads with a defined response (explicit negatives)

| # | Input | Expected outcome | Automated? |
|---|-------|------------------|------------|
| N1 | `POST /upload` with **no / empty `Content-Type`** and no body (nothing selected) | `400`, body `{ error:"no file provided" }`, string `error`; NOT `200` | **Automated** — `AC2.1` test. |
| N2a | `POST /upload`, `Content-Type: text/plain`, body `"hello, not an image"` | `415`, body `{ error:"file must be an image" }`, string `error`; NOT `200` | **Automated** — `AC2.2` test (asserts status ∈ {400,415}; built server returns 415). |
| N2b | `POST /upload`, `Content-Type: application/pdf`, small PDF bytes | `415`, body `{ error:"file must be an image" }`; NOT `200` | **Manual** — the PDF MIME variant is not in the suite. `curl -X POST --data-binary @x.pdf -H 'Content-Type: application/pdf' .../upload`. |
| N3 | `POST /upload`, `Content-Type: image/png`, body of **10,485,761 bytes** (cap + 1) | `413`, body `{ error:"file too large" }`; NOT `200`. Stream aborted mid-body, response still flushes cleanly | **Automated** — `AC2.3` test (`MAX_UPLOAD_BYTES + 1`; asserts status ∈ {413,400}, server returns 413). |
| N4 | `POST /upload`, `Content-Type: image/jpeg`, **0-byte** body | `400`, body `{ error:"file is empty" }`; NOT `200` | **Automated** — `AC2.4` test. |
| N5 | AC2.5 — inspect the served client (`src/index.html`) | No `sk-…`-style key, no `api[_-]?key`, no `anthropic` string present | **Automated** — `AC2.5` secret-scan test. |

---

## Boundary

| # | Input | Expected outcome | Automated? |
|---|-------|------------------|------------|
| B1 | `POST /upload`, `Content-Type: image/png`, body of **exactly 10,485,760 bytes** (at the cap) | **Accepted**: `200`, `{ ok:true, size:10485760, type:"image/png" }` (cap is inclusive; "oversized" = strictly greater) | **Automated** — boundary test (`MAX_UPLOAD_BYTES` exactly → 200, `size===MAX`). |

---

## Weird / adversarial inputs (exploratory — none automated)

All rows below are **manual/exploratory**; the Vitest suite does not cover them. Expected outcomes
are derived from the built routing + MIME-normalisation logic in `src/server.js`.

| # | Input | Expected outcome | Automated? |
|---|-------|------------------|------------|
| W1 | `POST /upload`, `Content-Type: image/png; charset=x`, non-empty bytes | `200`, `type:"image/png"` — server strips the `;`-param and lowercases, so the charset param is ignored and the upload succeeds | **Manual.** |
| W2 | `POST /upload`, `Content-Type: IMAGE/JPEG` (uppercase MIME), non-empty bytes | `200`, `type:"image/jpeg"` — MIME is lowercased before the `image/` check and in the echoed `type` | **Manual.** |
| W3 | `GET /upload` (wrong method on the upload route) | `404`, body `{ error:"not found" }` — only `POST /upload` is routed; GET does not match, no upload handling runs | **Manual.** |
| W4 | `PUT /upload` (wrong method on the upload route) | `404`, body `{ error:"not found" }` — same as W3; only `POST` matches | **Manual.** |
| W5 | `GET /../server.js` (path-traversal-looking) | `404`, body `{ error:"not found" }` — `new URL()` normalises the path to `/server.js`, which matches neither `/` nor `/index.html`; the server never reads an attacker-chosen file (it only ever reads its fixed `index.html` path), so **no source leak / traversal** | **Manual.** Also worth trying `/../../etc/passwd` → same `404 not found`, no file served. |
| W6 | `GET /index.html` (alias route) | `200`, `text/html`, the frontend page (documented alias of `/`) — sanity check that the alias behaves like `/` and does not fall through to 404 | **Manual.** |

---

## Notes / risks handed to the human (not decided here)

- **Rendered-UI confirmation (H4)** and every **weird-input row (W1–W6)** are exploratory and NOT in
  the automated suite — they rely on manual curl/browser runs. If any should be a release blocker,
  that is the human's call to make, and they could later be promoted into `tests/upload.test.js`.
- The suite asserts the frontend at the **served-HTML-string** level (testids/attributes present),
  not that the elements are visibly rendered or that the post-upload message actually appears in a
  live browser — H3/H4 note the manual gap.
- N2b (`application/pdf`) and the typical-PNG happy path (H2) are close cousins of automated cases but
  use inputs the suite does not exercise; kept as manual to catch MIME-branch surprises.
</content>
</invoke>
