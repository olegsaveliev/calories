# ADR-002 — Transport the upload as a raw binary POST body (no multipart, no dep)

- **Status:** accepted
- **Date:** 2026-07-13

## Context
Feature 001 stands up the Node service and its single upload endpoint. ADR-001 forbids any new **runtime**
dependency or framework without a new ADR, but the idiomatic way to receive an HTML file upload —
`multipart/form-data` — normally needs a runtime multipart parser (busboy/formidable) or a hand-rolled
one. So how the browser transports the image bytes is a constrained, hard-to-reverse fork.

## Decision
The browser POSTs the selected File as the **raw request body** (`fetch(url, { method:'POST', body: file,
headers:{ 'Content-Type': file.type } })`), and the server reads the raw request stream using built-in
`http`. Size = the streamed byte count (aborting mid-stream once it exceeds 10,485,760 bytes); MIME =
the request `Content-Type` header. **No multipart, no framework, no new runtime dependency.**

## Alternatives considered
1. **multipart/form-data** — rejected: needs a runtime parser dep (busboy/formidable) or an error-prone
   hand-rolled parser, i.e. the exact thing ADR-001 says requires its own justification — too much cost
   for a single-field, single-file upload.
2. **base64-encoded JSON POST** — rejected (kept as runner-up): dependency-free via built-in JSON, but
   adds ~33% wire overhead, forces buffering the whole body before the 10 MB cap can be checked, and
   makes the true file size the decoded length rather than the transport length.

## Consequences
- **Positive:** zero new runtime deps (honours ADR-001); the server can abort an oversized upload
  mid-stream instead of buffering it; the later vision-model feature gets the raw image `Buffer` + MIME
  with no decode step.
- **Negative:** not a standard HTML `<form>` submit — the client MUST send via `fetch` with an explicit
  `Content-Type`; only one file per request (no mixed form fields alongside the image).

## Agent-readable summary
The image upload is sent as the raw HTTP request body with the file's MIME in `Content-Type`, read via
built-in `http`; do NOT switch to multipart/form-data or add a multipart-parser (or any) runtime
dependency without a new ADR superseding this one.
