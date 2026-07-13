# 002 — Calorie estimate · Code Review (pipeline Step 5.5)

**Reviewer:** isolated fresh subagent (Tier A — did NOT write the code, never saw the build reasoning).
**Branch:** `feature/002-calorie-estimate` · PR #5
**Scope reviewed:** `src/vision.js`, `src/server.js`, `src/index.html`, `tests/vision.test.js`,
`tests/upload.test.js`, plus the diff vs `main`. Cross-checked against the spec (`20-stories-acs.md`),
settled design (`30-design.md`, model = `claude-sonnet-5`), manifest, ADR-001/002, and the
authoritative Anthropic API reference (claude-api skill).

**Independence tier: A.**

**Verdict: 1 major, 2 minor.** No security-class findings. No ADR drift. No 001 regression. The
fail-closed architecture is sound and the untrusted-model-output handling is correct. The one major
is a reliability defect (not a fabricated-number defect): a wrong assumption about the model's default
thinking behavior can make **legitimate** estimates intermittently fail closed.

---

## Findings (ranked)

### MAJOR — M1 · Adaptive thinking is ON by default on Sonnet 5; with `max_tokens: 256` real estimates can truncate and fail closed
**File:** `src/vision.js:17` (`MAX_TOKENS = 256`) + `src/vision.js:102–120` (request body has no `thinking` field).
**Category:** correctness / reliability · **Verdict: CONFIRMED** (against the claude-api reference).

The request omits the `thinking` parameter. The design (`30-design.md`, decision 3) justified this as
"omit thinking … on Opus 4.8/Sonnet 5 that runs thinking-off." **That premise is wrong for Sonnet 5.**
Per the Anthropic API reference (Thinking & Effort table), the models differ:

- **Opus 4.8 / 4.7:** omitting `thinking` runs *without* thinking.
- **Claude Sonnet 5 (the picked model):** omitting `thinking` runs **adaptive thinking (ON)**.

`max_tokens` is a hard cap on *total* output = thinking tokens + response text. The structured JSON
(`{"food_identified":true,"calories":650}`) is ~15 tokens, so 256 is ample for the answer alone — but
with adaptive thinking on, any non-trivial reasoning for a real food photo can consume the 256-token
budget before the JSON is emitted. The result: `stop_reason: "max_tokens"`, an empty or truncated text
block, `extractStructuredReply()` returns `null` (`vision.js:170,176`), and the call collapses to
`{status:"unavailable"}` → the user sees "Couldn't estimate calories, try again." on a perfectly good
photo.

**Failure scenario:** A user uploads a valid, clearly-photographed meal. Sonnet 5 (thinking on by
default) spends >~240 tokens reasoning about the plate before producing JSON → truncated → fail-closed
"couldn't estimate." This is intermittent and probabilistic (adaptive thinking varies), which makes it
worse: AC1.1 passes in tests (which mock `fetch`) and in the one live 1×1-PNG sanity check in the build
notes (a `no_food` reply needs almost no thinking), but degrades in production on the exact happy path
the feature exists for.

**Why the tests didn't catch it:** every test stubs `fetch`/the Anthropic response, so the real
model+`max_tokens` interaction is never exercised. The live sanity check used a synthetic 1×1 PNG that
returns `no_food` — the cheapest possible path, which doesn't provoke thinking.

**Suggested fix (engineering's call):** set `thinking: {type: "disabled"}` explicitly (accepted on
Sonnet 5 — this is what the design *intended*), or give real headroom (e.g. `max_tokens` ~1024). Note
that `budget_tokens` is rejected (400) on Sonnet 5, so disabling is the clean lever. Disabling also
removes the (billed) thinking-token cost the design assumed wasn't there.

---

### MINOR — m2 · Large-but-valid photos (up to the 10 MB cap) likely exceed the vision API's per-image size limit and always fail closed
**File:** `src/vision.js:111` (`data: imageBuffer.toString("base64")`).
**Category:** edge case / spec drift · **Verdict: PLAUSIBLE** (exact API image-size limit not verified in-repo).

`readBodyCapped` accepts images up to `MAX_UPLOAD_BYTES` = 10 MB (`server.js:15`), and the whole buffer
is base64-encoded and sent as a single `image` block. Base64 inflates by ~1.33×, so a 10 MB photo
becomes a ~13.3 MB source. The Anthropic Messages API enforces a per-image size limit well below that
(commonly cited ~5 MB base64), so images roughly above ~3.75 MB raw would be rejected with a non-2xx →
`estimateCalories` returns `unavailable` → "couldn't estimate."

Modern phone photos routinely fall in the 3–8 MB range, so this isn't a rare corner — a class of valid
uploads that pass 001's 10 MB cap and the raster allowlist will *never* produce an estimate, drifting
from AC1.1 ("valid food photo → displayed estimate"). It fails closed (no fabricated number), so it's
not a safety defect, but it undercuts the core happy path silently. Worth either downscaling server-side
(would need a dep — check against ADR-001) or lowering the accepted size / documenting the effective
ceiling. At minimum it should be a known limitation, not a silent surprise.

---

### MINOR — m3 · `food_identified:true` + `calories:null` is surfaced as "Couldn't identify a meal in this photo."
**File:** `src/vision.js:141` (`parsed.food_identified === false || parsed.calories === null` → `NO_FOOD`) → `src/index.html:65–67`.
**Category:** messaging / spec nuance · **Verdict: CONFIRMED.**

When the model *does* recognize food but returns `calories:null` (saw a meal, couldn't estimate), the
code routes it to `no_food`, and the UI says "Couldn't identify a meal in this photo." — which is
factually the opposite of what happened. The spec permits collapsing this into the refusal path (AI Eval
Card: refusal trigger includes "fails the confidence threshold"), and the builder-notes allow any clear
message, so this is **within spec** — but the wording can mislead the user ("it clearly shows my lunch,
why does it say no meal?"). Consider a distinct message for the "recognized but no estimate" branch, or
neutral wording ("Couldn't estimate calories for this photo"). Non-blocking.

---

## Lens coverage (all six addressed)

1. **Correctness / logic** — **M1** (thinking-on truncation). Otherwise solid: `AbortController` +
   `finally clearTimeout` (no timer leak, `vision.js:91–92,155–157`); refusal checked before touching
   `content` (`vision.js:132`); `extractStructuredReply` skips non-text blocks so a leading `thinking`
   block wouldn't break parsing (`vision.js:169`); calories validated as non-negative integer
   (`vision.js:146`); `estimateCalories` never throws (outer try/catch). No `stop_reason:"max_tokens"`
   branch, but it correctly funnels to `unavailable` via the null-parse path — safe, though it's the
   mechanism behind M1.
2. **Security** — **none found.** Key is `process.env.ANTHROPIC_API_KEY` only, never logged, never sent
   to the client; `estimateCalories` fail-closes when the key is absent instead of 401-ing
   (`vision.js:84–89`). No key in client code (verified by the existing `tests/upload.test.js` secret
   scan). Only a validated integer ever reaches the DOM, and the frontend renders exclusively via
   `textContent` — no `innerHTML`/eval, no untrusted model free-text to the page (`index.html:37,62–79`).
   Prompt-injection-in-image ("output 99999") is bounded by structured-output→integer + the untrusted
   treatment; the model could always be *wrong*, but it cannot inject markup or free text. ADR-002 upheld
   (browser→server transport unchanged; base64 happens server-side for the outbound API only).
3. **Regression (001 contract)** — **none found.** Success envelope gains `calorieResult` additively
   (`ok/size/type` unchanged). Check order preserved: empty Content-Type 400 → allowlist 415 → oversize
   413 → empty-body 400 → model call (`server.js:94–140`). The 415 message text changed
   ("file must be an image" → "unsupported file type"), but 001 tests only assert `typeof error ===
   "string"`, so no contract break. `startsWith("image/")` → strict allowlist is the intended Story-2
   change (closes manifest R3/M1/M2).
4. **Edge cases** — **m2** (large valid images), **m3** (food+null). Covered well: SVG and degenerate
   `image/*` rejected with 415 before any API call (allowlist + tests); non-2xx / network / abort /
   unparseable / non-integer / negative all fail closed; AC3.2 independence holds (no caching; call
   counter reaches 2 in the test).
5. **Simplicity / dead code** — **none found.** Frozen constants and typedefs are used or serve as
   contract docs; no copy-paste or unused vars.
6. **ADR / decision drift** — **none found.** Built-in `fetch`, zero new runtime deps (ADR-001 honoured);
   no framework/build tool; `output_config.format` is the current, non-deprecated structured-outputs
   parameter; model ID `claude-sonnet-5` is exact with no date suffix and matches the human pick.

## Test blind spots noted
- All Anthropic responses are mocked; the real `max_tokens`+thinking interaction (M1) and the real
  image-size limit (m2) are never exercised. The frontend click→fetch→render path is still only shape-
  asserted (the manifest already flags Playwright as warranted for this first user-read result).
- No test drives `stop_reason:"max_tokens"` — adding one would document the truncation→unavailable
  mapping and guard M1's fix.

**Handoff:** findings returned to engineering. Reviewer made no code edits. Escalation (does M1 block
ship? accept m2 as a known limitation?) is the human's call.
