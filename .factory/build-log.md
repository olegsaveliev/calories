# Build log — append-only history

> One entry per delivered feature / fixed bug, newest at the top. Written by `delivery-pm` (wrap) and
> `bugfix`. This is the narrative history; `manifest.md` is the current state.

## 2026-07-13 — BUG-001 Dropzone icon + label centering (bugfix)
- Pick-screen dropzone: the camera icon sat left of centre and "Add a photo" wasn't stacked under it.
- Root cause: `#dropzone-empty` (holding the icon + labels) had no layout rule, so it was a plain block
  sized to the widest line; the 64px icon aligned left while `text-align:center` centred only the text.
- Fix: made `#dropzone-empty` a centred flex column (`display:flex; flex-direction:column;
  align-items:center; gap:14px`) — CSS-only, `src/index.html`. No behaviour/contract change.
- Test-first guard: `tests/upload.test.js` → "BUG-001 …" (failed before, passes after). Suite 74/74 green.
- Severity: minor/cosmetic. bugs.md: BUG-001 → fixed. Issue: #11 · PR: #12

## 2026-07-13 — 003 Redesign — "Midnight Lime" two-screen UI rebuild (v0.3.0)
- Full **frontend-only** rebuild of `src/index.html`: a Pick screen (dropzone + privacy notice +
  disabled-until-selected CTA) and a Result screen (photo thumbnail + animated-ring hero calorie
  number + reset), driven by a single 5-state vanilla-JS state machine (`idle → selected →
  estimating → done | error → idle`). Inline CSS custom properties carry every "Midnight Lime"
  design token; Google Fonts `<link>` for Space Grotesk/Manrope (static asset, not a dependency).
  Zero new runtime deps, no framework/build tool (ADR-001 upheld); no new ADR needed (architecture
  step confirmed both ADR-001 and ADR-002 hold unchanged). **The server, the vision-model call, and
  the `POST /upload` contract are byte-for-byte unchanged** — `server.js`, `vision.js`,
  `rate-limit.js`, `strip-metadata.js` not touched.
- **Scope (human-confirmed):** wires only the total-calorie number from the existing `calorieResult`.
  Every feature-007 field the design mock shows with demo values (food-name pill, "± NN" range,
  items-seen/confidence tiles) is honestly neutralized — pill omitted, "± NN" dropped, tiles render
  a literal "—" — never fabricated. Verified by a dedicated negative-assertion test and independent
  review.
- ux-design pass: fixed a real WCAG AA contrast failure (`--dim` `#6B7280` ≈4.05:1 on `#0A0B0D`, fails
  the 4.5:1 bar for its 11–13px usages → `#7A808D` ≈4.95:1, passes with margin — review independently
  re-derived the arithmetic and confirmed it), corrected a secondary-CTA border token copied from the
  wrong hairline value, and added a `prefers-reduced-motion` guard on the two looping animations.
  Keyboard-operable dropzone, visible focus rings, ≥44×44px tap targets all confirmed.
- Review: **PASS**, Tier A (independent, fresh subagent), 0 major, 1 minor (F1: no client-side fetch
  timeout — a stalled/half-open connection strands the user on the loading skeleton with no reachable
  control until the browser's own timeout fires; AC4.2 names "timed out" as a trigger but nothing
  client-side implements it) + 2 nits (F2: bypassed-415 shows a generic message instead of the design's
  distinct "unsupported file type" copy; F3: benign non-idiomatic `role="button"` ARIA nesting on the
  dropzone). All three logged as known limitations, not fixed this run.
- QA: current tier is 73 passing static-HTML shape assertions only — the entire client-side state
  machine (transitions, double-submit guard, result mapping, object-URL lifecycle, drag-drop,
  keyboard, animations) is untested by anything that drives a browser. QA specified a 24-case
  Playwright tier. **Human decision: ship 003 now; Playwright + the F1 timeout fix queued as follow-up
  roadmap 008.**
- Tests: 73 passing (up from 70 in 002; all pre-existing 001/002 suites pass unmodified). Lint clean.
- Note: the dev `ANTHROPIC_API_KEY` still hasn't been re-verified live end-to-end (credit-balance gap
  from 002 carries forward) — fail-closed paths are verified by tests; not a code defect.
- PR/commit: not created by this wrap step (orchestrator-owned) · Issue: (roadmap 003)

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
