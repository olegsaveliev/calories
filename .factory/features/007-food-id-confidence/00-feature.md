# 007 — Food ID + confidence

**Pulled from:** roadmap row 007
**Status:** KICKOFF COMPLETE — formally opened, roadmap row → `in progress`.

**Request (roadmap one-liner):** Name the detected dish and show a low/med/high confidence badge next to the estimate.

**Why:** Feature 003 rebuilt the UI with two screens and wired the total-calorie number. The Result screen design includes three fields the implementation left neutral: the food-name pill, and two stat tiles (confidence + items-seen count). Feature 007 fills these by expanding the vision-model output schema to include dish name, a confidence level, and item count. This surfaces the model's food identification alongside the calorie estimate—a more complete result to the user.

## Scope (CONFIRMED — human decision, not open)

**Wire three Result-screen fields** (feature 003 left them neutral) using an **expanded structured-output schema** from the existing single vision call. Preserve all security, data-egress, and fail-closed handling from 002/003.

### What's in this feature
1. **Expanded vision-model schema** — the existing `claude-sonnet-5` call + single vision roundtrip, but structured-output contract adds:
   - `foodName` — the dish name (string, max length TBD by engineering, per threat-model).
   - `confidence` — one of `"low" | "medium" | "high"` (discrete, no free text).
   - `itemsCount` — integer count of food items visible (0–N, plausible range TBD).
   - Existing fields `food_identified` (boolean) and `calories` (integer) preserved unchanged.

2. **Result screen fields wired** (feature 003 mock showed these; 003 rendered them neutral):
   - **Food-name pill** — overlaid bottom-left on the photo thumbnail. Display the model's `foodName` or omit if not identified.
   - **Stat tile 1** — left tile on Result screen, currently renders "—" (feature 003 test). Wire `itemsCount` here; label stays "items seen".
   - **Stat tile 2** — right tile on Result screen, currently renders "—" (feature 003 test). Wire confidence badge here (visual TBD by ux-design, e.g. "High" / "Medium" / "Low" text, a color-coded dot, or both); label stays "confidence".

3. **Security: untrusted model text** — `foodName` is the FIRST model-generated free text surfaced to users in this app. Threat-model will assess the full surface. **Engineering must**:
   - Length-bound the string before rendering (max length TBD).
   - Render via `textContent` only — **never `innerHTML`** (preserves 001/002 XSS posture).
   - No emoji injection, no user-facing markdown/formatting.

4. **Preserve from 002/003 manifest**:
   - `POST /upload` contract (success/error responses, fail-closed paths).
   - Metadata stripping (EXIF/GPS) server-side before transmission.
   - JPEG/PNG-only allowlist.
   - Fail-closed error rendering (no fake data if the model returns an incomplete response).
   - Data-egress + privacy notice on Pick screen (same copy).
   - Rate-limit and concurrency guards (002).

### What's NOT in this feature (deferred)
- Portion adjuster (feature 004).
- Camera/drag-drop (feature 005).
- Shareable result card (feature 006).
- The ± calorie range ("± NN" under the total) — still omitted from Result screen (feature 003 design note, placeholder "calories · ± NN" is NOT wired, out of scope).

### Stack & constraints
- **Vanilla HTML/CSS/JS only** (ADR-001: one Node service, plain code, no framework/build tool without a new ADR).
- No new dependencies. No changes to the raw-binary `POST /upload` contract (ADR-002 preserved).
- Vision-model tier: **reuse `claude-sonnet-5`** (no new model, no cost re-baseline; human-picked in 002, see `features/002-calorie-estimate/30-options.md`).
- Backwards-compatible: if the model returns `foodName: null` or omits it, the app renders nothing (fail-closed).

## Pipeline shape
This feature includes **threat-model** (assess untrusted text surface) + **ux-design** (confidence visual spec) + **architecture** (confirm ADR-001/002 still hold + vision-model contract expansion) + **engineering** (expand schema, wire fields, test end-to-end, XSS audit) + **qa** + **reviewer** + **delivery-pm**.

## Acceptance criteria (from design handoff + feature scope)
- [ ] Structured-output schema expanded: `{food_identified, calories, foodName, confidence, itemsCount}`.
- [ ] Vision-model call (one POST to Anthropic, `claude-sonnet-5`, same 30s timeout, same plausibility band) returns the three new fields.
- [ ] Result screen food-name pill: displays `foodName` if present; omitted if null/empty (no placeholder/fallback text).
- [ ] Stat tiles wired: left = `itemsCount` (integer, no suffix yet; label "items seen"), right = confidence (text/visual TBD by ux-design; label "confidence").
- [ ] Length-bound `foodName` (max length TBD) and render via `textContent` only (never `innerHTML`).
- [ ] Fail-closed: if the model response lacks any new field or returns invalid shapes, the app renders nothing for that field (no fake/default data, no error).
- [ ] Privacy notice preserved (same text, same placement).
- [ ] JPEG/PNG allowlist unchanged. Metadata strip unchanged. Rate-limit/concurrency unchanged.
- [ ] All existing tests (001/002/003) still pass. New fields covered by tests or flagged as pending QA.
- [ ] XSS audit: `foodName` never flows through `innerHTML`; confirm via code inspection and threat-model.

## Alignment
- Depends on 002 (Calorie estimate) and 003 (Redesign) — ✓ both delivered.
- Conflicts with PROJECT.md non-goals: **none** (name + confidence is part of "estimate calories", not a new feature like accounts/history/macros).
- ADR compliance: **ADR-001 (vanilla stack) + ADR-002 (raw binary upload) both honored** — no new dependencies, vision model call shape preserved, same raw-binary contract.
- Manifest must-haves: **all preserved** — `POST /upload` contract, metadata strip, JPEG/PNG-only, fail-closed rendering, privacy notice, rate-limit, concurrency guard.
- **New security surface flagged** — `foodName` is untrusted model-generated text, first in this app. Threat-model will assess injection / length / render surface. Engineering must use `textContent` only.
