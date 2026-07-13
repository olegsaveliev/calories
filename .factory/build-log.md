# Build log — append-only history

> One entry per delivered feature / fixed bug, newest at the top. Written by `delivery-pm` (wrap) and
> `bugfix`. This is the narrative history; `manifest.md` is the current state.

## 2026-07-13 — 002 Calorie estimate (v0.2.0)
- Plugged a vision-model call into the existing `POST /upload` route: photo → server-side Anthropic
  call (`claude-sonnet-5`, human-picked) → structured `{food_identified, calories}` → browser renders
  "~N calories" or a distinct fail-closed message. Zero new runtime deps (ADR-001 upheld, built-in
  `fetch`); `ANTHROPIC_API_KEY` env-only; ADR-002 raw-binary transport unchanged. New: `src/vision.js`,
  `src/rate-limit.js`, `src/strip-metadata.js`. Success envelope gains an additive `calorieResult` field.
- **Scope change (human-accepted):** supported image types narrowed from the design's jpeg/png/gif/webp
  to **JPEG + PNG only** — GIF/WebP now 415, because they can't be metadata-stripped dependency-free.
- Threat-model gate landed 4 fixes: **R9** (per-IP 10/min + global in-flight cap of 2, checked before
  the paid call), **R10** (EXIF/GPS stripped pre-egress + UI privacy notice — **only partially closed**,
  see below), **R12** (`.env` gitignored), **R15** (1–5000 kcal plausibility band, fail-closed not
  clamped).
- Review: PASS 1 — 1 major (M1, adaptive-thinking truncation) + 2 minor, M1 fixed. PASS 2 (post
  threat-model fixes) — **2 major security-class findings, both left open and human-accepted as known
  limitations**: R10 fails open on JPEG data appended after EOI (Motion Photos/appended payloads still
  leak GPS), and the rate limiter's per-IP window is charged before the concurrency check and not
  refunded on denial (lets 2 attackers lock out honest users). Plus 4 minor findings (F3–F6, unknown-chunk
  handling, Map eviction, window-boundary burst). All logged in the manifest's known limitations under
  the existing "resolve before exposure beyond localhost" hard gate.
- R15 confirmed correct under adversarial review (fuzzed 40k inputs, 0 throws in either parser); client
  IP from the socket, not a spoofable header.
- Tests: 70 passing (was 37, up from 3 in 001). CI green.
- Note: the dev `ANTHROPIC_API_KEY` hit "credit balance too low" during live verification, so the
  happy-path render is covered by tests (API mocked) but wasn't re-demoed live end-to-end afterward —
  not a code defect.
- PR: #5 · Issue: (roadmap 002)

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
