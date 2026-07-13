# Build log — append-only history

> One entry per delivered feature / fixed bug, newest at the top. Written by `delivery-pm` (wrap) and
> `bugfix`. This is the narrative history; `manifest.md` is the current state.

## 2026-07-13 — 001 Initial prototype (v0.1.0)
- Stood up the single Node service (built-in `http` + `fs`, no runtime dep): serves the frontend
  and owns `POST /upload`. Browser file picker sends a food photo as a raw binary POST; server
  receives, validates (size/MIME/empty), and confirms receipt with `{ ok, size, type }`.
- All 8 ACs met; `src/server.js` + `src/index.html` + `tests/upload.test.js` (11 tests green, lint clean).
- Notable decision: **ADR-002** (accepted) — raw binary upload transport (over multipart / base64 JSON).
- Review: **0 blockers, 0 majors** (2 minors + 3 nits accepted). Threat model: 8 risks (2H/3M/3L),
  all **accepted for the localhost prototype** with recorded conditions (see manifest known-limitations).
- PR: #2 · Issue: #1 · commit: squash-merge of PR #2 into `main`

<!-- Entry format:
## <date> — <ID> <Feature name> (vX.Y.Z)
- What shipped, in 1–3 lines.
- Notable decisions / accepted findings.
- PR: #N · commit: <sha>
-->
