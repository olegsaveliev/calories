# 001 — Initial prototype · Design (approach note)

**ADRs that govern this feature.**
- **ADR-001 (accepted)** — ONE Node service (ESM), serves the frontend + owns the (later) model route;
  model key server-side only; no framework / build tool / new runtime dep without a new ADR. Honoured
  here: no framework, no runtime dep, no model route built.
- **ADR-002 (proposed, this feature)** — upload transport = **raw binary POST** (File as raw request
  body). See `30-options.md` + `decisions/002-raw-binary-upload-transport.md`.

## Approach

One Node `http` service (built-in `http` + `fs`, ESM), no dependencies. It plays two roles:

1. **Serve the static frontend.** `GET /` (and any static asset it needs) returns `src/index.html`,
   which contains an `<input type="file" accept="image/*">` and a send control (AC1.1), plus JS that
   POSTs the file and renders the confirmation (AC1.3).
2. **Accept the upload.** `POST /upload` (name is the builder's; keep it single + stable) receives the
   image as the **raw request body** (per ADR-002), with the file's MIME in the request `Content-Type`
   header. On success it responds **HTTP 200 + `{ ok: true, size: <bytes>, type: "<mime>" }`** (AC1.2).

## Where the size limit is enforced

**On the incoming request stream, as bytes arrive — not after buffering.** The handler accumulates
`req` data chunks, keeping a running byte count. **The moment the running total exceeds 10,485,760 bytes
(10 MB), stop reading and respond 413** (AC2.3) — do not buffer the whole oversized body. Non-oversized
bodies are collected into a `Buffer`; its length is the file size for AC1.2 and AC2.4.

## Validation → AC map (all on `POST /upload`)

| Check | Rule | Response | AC |
|-------|------|----------|----|
| Happy path | body present, `Content-Type` is `image/*`, `0 < size ≤ 10 MB` | 200 `{ ok:true, size, type }` | AC1.2 |
| No file | no body / empty request / no `Content-Type` (nothing sent) | 400 `{ error: "no file provided" }` | AC2.1 |
| Not an image | `Content-Type` not `image/*` (e.g. `text/plain`, `application/pdf`) | 400 or 415 `{ error: "file must be an image" }` | AC2.2 |
| Oversized | running byte count > 10,485,760 | 413 (or 400) `{ error: "file too large" }` | AC2.3 |
| Empty file | body read to completion, size == 0 | 400 `{ error: "file is empty" }` | AC2.4 |

All error bodies are JSON with a machine-checkable `{ error }` shape. The MIME check reads the request
`Content-Type` header directly (ground truth of the transport, per ADR-002). Ordering note for the
builder: reject the oversized stream **during** reading (before it all lands in memory); the
image-type check can run on the header before/while reading; empty-file is decided after a complete,
in-limit read yields 0 bytes.

## Explicitly out (this feature)

- **No persistence / DB** — the buffer is measured and discarded; nothing is written to disk or a store.
- **No vision model / API route** — deferred per ADR-001 + PRD out-of-scope; there is therefore **no
  secret** anywhere in client or server code (AC2.5 holds trivially).
- **No framework, no build tool, no runtime dependency** — built-in `http`/`fs` only (ADR-001).
