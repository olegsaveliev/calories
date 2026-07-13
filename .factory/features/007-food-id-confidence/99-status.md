# 007 — Food ID + confidence: Status

**Status: DELIVERED — 2026-07-13 (v0.4.0).**

## What shipped

The Result screen's three previously-neutral fields (food-name pill, "items seen" tile, "confidence"
tile) are now wired to real model output. `src/vision.js`'s existing single `claude-sonnet-5` vision
call (same call feature 002 introduced) had its structured-output schema expanded from
`{food_identified, calories}` to `{food_identified, calories, food_name, confidence, items_count}` —
**no second model call, no new model tier, no new runtime dependency** (ADR-001 upheld, `AC1.3`
confirmed: exactly one `POST` per request).

- **Food-name pill** — overlaid bottom-left on the Result-screen photo thumbnail; shows the model's
  dish name or is omitted entirely (never a placeholder) if absent/invalid.
- **Items-seen tile** (left) — shows `itemsCount` (integer, 0–50) or `"—"`.
- **Confidence tile** (right) — shows `"Low"/"Medium"/"High"` (plain-text label) or `"—"`.

## Verified (QA + review)

- 95/95 automated tests green (`npm test`), up from 74 pre-007; lint clean.
- Server-side validation is authoritative and runs before egress to the client: `foodName` is
  rejected-to-neutral (never truncated) over 60 chars or on any C0/C1 control, zero-width, or
  bidi-override code point; `confidence` accepted only on an exact case-sensitive match to
  `"low"|"medium"|"high"` (also schema-enforced `enum`, defense-in-depth); `itemsCount` accepted
  only as an integer in `[0,50]`. All three degrade **independently** — a bad name/confidence/count
  never fails the calorie estimate itself, and `render()` resets all three to neutral unconditionally
  before every branch, so no stale value survives into estimating/error/no_food/Try-again/New-photo.
- All model-derived text reaches the DOM via `textContent` only — no `innerHTML`/`insertAdjacentHTML`
  anywhere in the render path (hard-asserted by a static test).
- `POST /upload` contract change is additive-only and backward compatible: on full degradation the
  `estimated` response is byte-identical to the pre-007 `{status:"estimated", calories}` shape
  (proven by both `vision.test.js` and `upload.test.js`). `ok`/`size`/`type` and the
  `no_food`/`unavailable` shapes are untouched.
- QA ran 51 risk-driven test cases (34 explicit negatives) against the live app.
- Reviewer verdict: **PASS**, Tier A independence, 0 major findings.
- Human release call: **SHIP NOW.**

## Left for later (not hidden, tracked)

- **Review F1/F2 (deferred, roadmap 009)** — the `foodName` character reject-set is incomplete:
  bidi *isolate* controls (U+2066–U+2069 LRI/RLI/FSI/PDI), U+061C (Arabic Letter Mark), and
  U+2028/U+2029 (line/paragraph separators) currently pass validation. Impact is bounded (rendered
  `textContent`-only, no XSS/injection possible — worst case is visual reordering/line-break
  deception within the 60-char pill), so this shipped as an accepted, logged gap, not a blocker.
  Threat-model tracks this as **R17 (Low, human-deferred)**.
- **Review F3 — build-note inaccuracy, corrected this run.** `50-build-notes.md` claimed the
  `MAX_TOKENS` 256→1024 bump stayed "within the existing test's `<= 1024` bound" — no such test
  assertion exists (confirmed: no `max_tokens` assertion anywhere in `tests/`). The build note has
  been corrected to state plainly that the bump is untested. (Note: the same claim also appears as a
  code comment in `src/vision.js:31`, which is outside this wrap step's edit scope — flagged for
  whoever next touches that file.)
- **Review F4 (folded into roadmap 008)** — the entire client-side render path for the new fields
  (pill show/hide, per-field neutral reset across state transitions, stale-value non-leak on
  Try-again/New-photo, client-side re-validation of a crafted payload) is verified only by static-HTML
  string assertions, not by a running browser. QA's 51-case suite recommends a Playwright tier
  (3–5 E2E flows); the human's release call keeps this folded into the existing roadmap 008
  Playwright follow-up (which already covered the 003 render surface) rather than adding a new item.
- **Review F5 (accepted, nit)** — the client-side defensive re-check of `foodName` doesn't re-apply
  the length bound or character reject-set (server is authoritative; render is `textContent`-only so
  this has no practical exposure). Optional future symmetry fix.

## Threat-model — human-accepted risks (localhost prototype, under the existing "resolve before
exposure beyond localhost" gate)

- **R18 (High) — overreliance amplification.** The confidence badge is the model's **self-reported,
  uncalibrated** confidence — "High" can sit beside a wrong calorie number, and a clean-but-wrong
  dish name defeats its own sanity-check purpose (evolves carried 002-R14). Accepted & logged; a
  product/copy calibration question, not a code defect.
- **R16 (Med) — prompt injection can now place attacker-chosen readable text on screen** (dish
  name/confidence/count), not just steer a number. Contained today: schema + validators +
  `textContent`-only render, self-targeting (the uploader can only deceive themselves). **Flag for
  feature 006 (shareable card):** if one user's dish-name text is ever shown to *another* user, R16
  re-scores High — this is recorded as an explicit pre-condition note on 006 below.
- **R17 (Low)** — the deferred bidi/separator gap (F1/F2 above); human-deferred to roadmap 009.
- **R19 (Low)** — the `MAX_TOKENS` raise modestly widens the per-call ceiling of the carried,
  still-High cost-DoS risk R9; rate-limit/concurrency caps are unchanged and remain the control.
- Carried 002 escalations (R9 cost-DoS, R1 concurrency memory, R10 partial EXIF/GPS strip) are
  unchanged by 007 — not re-derived, not re-scored.

## AI usage

**A. Dev-cost of building this feature** — see `.factory/dev-cost.md` for the per-step token
breakdown (7 metered subagent steps + this wrap step).

**B. Runtime AI cost of the shipped feature** — same single `claude-sonnet-5` call feature 002
already priced (no cost re-baseline; this feature adds fields to the same request, not a new
request). No usage/cost logging exists yet (carried known limitation from 002), so actual runtime
spend cannot be verified against the design estimate without adding logging. **AI adoption:** used
as intended — the human confirmed a live happy-path run today via the now-funded dev
`ANTHROPIC_API_KEY` (a real photo returned "95 calories"); the expanded schema's three new fields
were not independently re-verified live in this session (fail-closed paths and happy-path shape are
covered by the 95/95 test suite).

## Follow-ups queued (orchestrator to schedule)

- **Roadmap 009 — Dish-name spoofing-char hardening.** Complete the bidi/isolate/separator
  reject-set (add U+2066–U+2069, U+061C, U+2028/U+2029) and decide a homoglyph/confusables policy.
  Addresses review F1/F2 and threat-model R17.
- **Roadmap 008 (existing, expanded scope)** — fold in a Playwright browser-E2E tier (3–5 flows)
  covering the 007 render paths: pill show/hide, per-field neutral reset, stale-value non-leak across
  Try-again/New-photo, and a crafted-payload client-side re-validation check — in addition to the
  003 render surface it already covers.

## Operational note

The dev `ANTHROPIC_API_KEY` now has credit — a real photo returned a live "95 calories" result,
confirmed by the human. Reminder for whoever runs the dev server next: **it must be restarted** to
pick up any `src/server.js`/`src/vision.js` code changes (Node caches ES module imports at process
start); only `src/index.html` is re-read fresh on every request.
