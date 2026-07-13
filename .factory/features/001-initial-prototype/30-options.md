# 001 — Initial prototype · Options: how the browser transports the image bytes

**The fork.** The browser must get the selected photo's bytes to the single Node upload endpoint,
which must then read the size + MIME type and validate them (AC1.2, AC2.1–2.4). ADR-001 forbids any
new **runtime** dependency (and any framework) without a new ADR. Multipart parsing — the idiomatic
way to receive an HTML file upload — normally needs a runtime dep (busboy/formidable), so the
transport choice is genuinely constrained. Dev-only deps (eslint/vitest) are unaffected.

**Criteria.** No-dependency-ness (stays inside ADR-001) · Size cap / streaming vs buffering (10 MB) ·
Content-type validation · Forward-fit with the later vision-model feature (which needs image bytes
server-side).

---

## Option A — multipart/form-data (`<form>` / `FormData`)

Idiomatic HTML upload: `<input type="file">` in a `FormData`, `multipart/form-data` body.

- **No-dependency-ness — L.** Node's `http` has no multipart parser. Parsing the multipart envelope by
  hand is error-prone (boundaries, headers, CRLF handling); the realistic path is busboy/formidable →
  **requires its own ADR to add a runtime dep.** This is exactly what ADR-001 tells us not to do here.
- **Size / streaming — M.** Multipart streams naturally, so a cap can be enforced mid-stream — but only
  with the parser dep that we're avoiding.
- **Content-type validation — M.** The part carries its own `Content-Type` header; must be pulled out
  of the parsed part.
- **Forward-fit — M.** Bytes arrive as a stream/buffer; usable later, but wrapped in multipart framing.
- **Score:** Value **M** · Effort **H** · Risk **H** (hand-rolled parser) — or a **new dependency**.

## Option B — raw binary POST (File as the raw request body) — ★ RECOMMENDED

Client `fetch(url, { method:'POST', body: file, headers:{'Content-Type': file.type} })`. The File's
bytes ARE the request body; the browser sends the file's MIME as `Content-Type`. Server reads the raw
request stream — **zero runtime deps, pure `http`.**

- **No-dependency-ness — H.** No parser, no framework, no dep. Squarely inside ADR-001.
- **Size / streaming — H.** Server counts bytes as they arrive on the stream and can **abort as soon as
  the running total exceeds 10,485,760** (AC2.3) instead of buffering a whole oversized body. Empty body =
  0 bytes read (AC2.4). Missing body / no Content-Type = no file (AC2.1).
- **Content-type validation — H.** Read directly from the request's `Content-Type` header; reject if not
  `image/*` (AC2.2). Size is the byte count of the body (AC1.2).
- **Forward-fit — H.** The later vision feature needs the raw image bytes server-side; this delivers a
  clean `Buffer` with its MIME with **no decode step** — the most direct feedstock for a model call.
- **Score:** Value **H** · Effort **L** · Risk **L**.

## Option C — base64-encoded JSON POST

Client reads the File to a base64 data string and POSTs `{ "type": "...", "data": "<base64>" }`. Server
uses built-in `JSON.parse` — no dep.

- **No-dependency-ness — H.** JSON parsing is built in; no dep. Inside ADR-001.
- **Size / streaming — L.** ~33% wire overhead, and JSON is buffered/parsed whole before you can measure
  the real (decoded) size — so a 10 MB image is ~13.3 MB on the wire and fully in memory before the cap
  check. Harder to abort early. The *true* byte size (AC1.2) is the decoded length, not the JSON length.
- **Content-type validation — M.** MIME is a self-declared JSON field (client-asserted), not a transport
  header; still checkable but one step further from ground truth.
- **Forward-fit — H.** Maps cleanly onto how a vision model ingests an image (many accept base64), so the
  later feature could forward it almost as-is.
- **Score:** Value **M** · Effort **M** · Risk **M** (buffering + overhead against the 10 MB cap).

---

## Recommendation

**Recommended: Option B — raw binary POST.** It is the only option that satisfies AC1.2 and all of
AC2.1–2.4 with **zero new runtime dependency** (honouring ADR-001) while letting the server **abort an
oversized upload mid-stream** rather than buffering it, and it hands the later vision-model feature the
raw image `Buffer` + MIME with no decode. Value H · Effort L · Risk L.

**Runner-up: Option C — base64 JSON POST.** Also dependency-free and arguably the friendliest handoff to
a base64-accepting vision model, but it pays a ~33% size penalty, forces whole-body buffering before the
size cap can be checked, and makes the "true" file size the decoded length rather than the transport
length — extra friction against the 10 MB AC. Pick C over B only if a future model integration is
confirmed to require base64 and we prefer to pay that cost now.

**Rejected: Option A — multipart/form-data.** The idiomatic choice, but it forces either a hand-rolled
multipart parser (Effort H / Risk H) or a new runtime dependency — the exact thing ADR-001 says needs
its own ADR. Not worth it for a single-field, single-file upload.

> Human decision gate: this pick is recorded as **ADR-002 (proposed)**. Confirm B (or override to C)
> before build.
