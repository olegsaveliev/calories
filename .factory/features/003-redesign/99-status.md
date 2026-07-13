# 003 — Redesign ("Midnight Lime" two-screen UI rebuild) — Status

**Status:** DELIVERED · 2026-07-13 · v0.3.0

## What shipped

A full **frontend-only** rebuild of `src/index.html` into the "Midnight Lime" two-screen experience
(Pick → Result), vanilla HTML/CSS/JS with inline design-token CSS custom properties and a 5-state
in-page JS state machine (`idle → selected → estimating → done | error → idle`). No framework, no
build tool (ADR-001 upheld), no new runtime dependencies (Google Fonts `<link>` is a static asset
load, not a dependency). **The server, the vision-model call, and the `POST /upload` contract are
byte-for-byte unchanged** — `src/server.js`, `src/vision.js`, `src/rate-limit.js`,
`src/strip-metadata.js` were not touched.

**Scope = visual redesign only (human-confirmed).** The rebuild wires exactly one real datum — the
total-calorie number from the existing `calorieResult`. Every field the design mock shows with demo
values belongs to feature 007 and was neutralized honestly, not faked: the food-name pill is omitted
from the DOM entirely, the "± NN" range is dropped (caption reads "calories" only), and the two stat
tiles render a literal em-dash "—". No hardcoded or computed-looking demo value (642 / "Grilled
chicken bowl" / "± NN" / "3 items seen" / "High confidence") appears anywhere in the shipped file —
confirmed by both the extended test suite and independent review.

**Fail-closed preserved:** an `estimated` result is the only path to the hero number; `no_food` /
`unavailable` / non-2xx / unparseable / network failure all route to an honest inline error state
with a "Try again" affordance, never a number, and never a stale number from a prior photo. Server-side
metadata stripping, the JPEG/PNG-only 415 allowlist, and the data-egress/privacy notice are all
preserved (privacy copy restyled, substance unchanged and re-asserted by tests).

## Verified

- **Tests:** 73/73 passing (`npm test`), lint clean. `tests/upload.test.js` gained redesign
  shape-assertions (both screens present, narrowed `accept="image/jpeg,image/png"`, CTA
  disabled-by-default with `aria-disabled`, hero/error/back/new-photo/try-again hooks, stat tiles
  render only "—", and an explicit negative-assertion that none of the feature-007 demo values leak
  into the DOM). All pre-existing 001/002 suites (`vision.test.js`, `rate-limit.test.js`,
  `strip-metadata.test.js`, `calories.test.js`) pass unmodified.
- **Accessibility (ux-design pass):** found and fixed a real WCAG AA contrast failure —
  `--dim` `#6B7280` measured ≈4.05–4.07:1 on `#0A0B0D` and the stat-tile surface (fails the 4.5:1 bar
  for the 11–13px text it's used on); nudged to `#7A808D` (≈4.95–4.97:1, passes with margin). Review
  independently re-derived the same arithmetic and confirmed it. Also corrected a secondary-CTA
  border token that had been copied from the wrong (unshipped) hairline value, and added a
  `prefers-reduced-motion` guard on the two looping animations (none existed before). Keyboard
  reachability, `:focus-visible` rings on every control, dropzone Enter/Space file-picker activation,
  and ≥44×44px tap targets (back button / avatar / CTAs) all confirmed built-in.
- **Independent review:** PASS, Tier A (fresh subagent, no prior context). 0 blocking/major findings.
  1 minor + 2 nits (see Known limitations below). Confirmed no server file is in the diff, no
  `innerHTML` used for any response-derived text (XSS posture preserved), and the double-submit guard
  and object-URL revoke lifecycle are both correct by trace.
- **AI adoption / runtime AI cost:** N/A change this feature — no new AI usage; the existing 002
  vision-model call is unmodified. Live happy-path "~N calories" rendering still needs a topped-up
  `ANTHROPIC_API_KEY` (the dev key hit "credit balance too low" during 002) — fail-closed paths are
  verified by tests; this is an account/billing gap, not a code defect.

## Known limitations (left for later — see manifest for full carry-forward list)

- **Browser-E2E gap (not a blocker, but real):** the entire client-side state machine — transitions,
  the double-submit guard, `calorieResult` → view mapping, object-URL revoke, drag-drop, keyboard
  activation, animations, "Try again" — is exercised only by static-HTML string assertions, not by a
  running browser. QA specified a 24-case Playwright tier. **Human decision: ship now; Playwright is
  queued as follow-up feature 008.**
- **F1 (review minor, deferred to 008):** the client `fetch` has no timeout/`AbortController`. A
  stalled/half-open connection (not a clean network error, not the server's own 30s ceiling) traps
  the user on the pulsing skeleton — back/New-photo/Try-again are all hidden during `estimating` —
  until the browser's own default network timeout fires. AC4.2 names "request timed out" as an error
  trigger but no client-side timeout implements it today.
- **F2 (nit, accepted):** a bypassed 415 (client `accept` guard defeated via devtools) renders the
  generic "Couldn't estimate calories — try again" message instead of a distinct "unsupported file
  type" message the design note called for. Not an AC failure (server still returns 415 correctly).
- **F3 (nit, accepted):** the dropzone container carries `role="button"` while wrapping a focusable
  `<input>`/`<img>` — non-idiomatic ARIA nesting, but benign (the input is `tabindex="-1"
  aria-hidden="true"`, correctly excluded from the a11y tree).
- All prior 002 known limitations (R1/R2 concurrency-memory, R10 partial EXIF closure, rate-limit
  fairness bug, etc.) are unchanged by this feature — 003 never touches the server.

## Follow-up

**Roadmap 008 — Browser E2E (Playwright) tier + client-side estimate timeout (F1).** Queued; not
committed here (orchestrator owns roadmap changes).
