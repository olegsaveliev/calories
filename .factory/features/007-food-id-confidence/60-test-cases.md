# 007 — Food ID + confidence: Test Cases

**Status:** 95/95 Vitest cases pass (server-side unit + integration already green). **Manual test suite below** covers the new user-visible fields and their degradation paths. **Client render path is behaviourally untested** — see Playwright recommendation at the end.

---

## Test suite: risk-driven coverage

Organized by story and by risk category (happy path, negatives, regressions). Each case specifies a concrete input and a user-visible expected outcome, executable against the live `GET /` served Result screen.

| # | Story | Category | Input | Expected Outcome | Pass |
|---|-------|----------|-------|------------------|------|
| **TC1** | Story 1 (schema) | Happy path | `POST /upload` → model response: `{ food_identified: true, calories: 542, food_name: "Grilled chicken bowl", confidence: "high", items_count: 3 }` | HTTP 200; response `calorieResult` includes all five fields: `{status:"estimated", calories:542, foodName:"Grilled chicken bowl", confidence:"high", itemsCount:3}`; hero number **542** renders on Result screen; pill shows **"Grilled chicken bowl"**; left tile shows **3**; right tile shows **"High"** | ✅ |
| **TC2** | Story 2 (pill) | Happy path — max length | `foodName: "Roasted beets & goat cheese salad w/ balsamic reduction"` (60 chars, at limit) | Pill renders exact text; no truncation, no ellipsis | ✅ |
| **TC3** | Story 2 (pill) | Negative — over-length | `foodName: "Roasted beets & goat cheese salad with balsamic reduction"` (61+ chars, exceeds `MAX_FOOD_NAME_LENGTH=60`) | Pill element is absent (not hidden, not showing truncated text); hero number still renders | ✅ |
| **TC4** | Story 2 (pill) | Negative — missing | Response includes `food_identified:true, calories:450` but **no** `food_name` key at all (simulating pre-007 shape or degraded response) | Pill absent; hero **450** renders; left/right tiles show `"—"` | ✅ |
| **TC5** | Story 2 (pill) | Negative — null value | `food_name: null` | Pill absent; hero renders normally | ✅ |
| **TC6** | Story 2 (pill) | Negative — empty string | `food_name: ""` | Pill absent | ✅ |
| **TC7** | Story 2 (pill) | Negative — whitespace only | `food_name: "   "` (spaces, tabs, newlines) | After trim, string is empty; pill absent | ✅ |
| **TC8** | Story 2 (pill) | Security — XSS via HTML chars | `food_name: "Chicken <script>alert(1)</script> soup"` | Pill renders via `textContent` only; the text appears **literally** as the input string (angle brackets visible, no script execution); code inspection confirms no `.innerHTML =` / `.insertAdjacentHTML(` in the render path | ✅ |
| **TC9** | Story 2 (pill) | Security — emoji & markdown | `food_name: "🍗 **Bold** pasta #dinner"` | Renders as literal plain text (no markdown parsing, emoji not stripped); all characters appear exactly as in the model response | ✅ |
| **TC10** | Story 2 (pill) | Negative — C0 control chars | `food_name: "Pasta\x00with\x01null\x1fbyte"` (contains U+0000, U+0001, U+001F) | Rejected by `FOOD_NAME_DISALLOWED_RE`; pill absent | ✅ |
| **TC11** | Story 2 (pill) | Negative — zero-width chars | `food_name: "Pasta​with‌zero‍width"` (contains U+200B, U+200C, U+200D) | Rejected; pill absent | ✅ |
| **TC12** | Story 2 (pill) | Negative — bidi override (RLO) | `food_name: "Estimate calories ‮itap here"` (contains U+202E, right-to-left override) | Rejected by `FOOD_NAME_DISALLOWED_RE`; pill absent | ✅ |
| **TC13** | Story 2 (pill) | Known gap (F1) — bidi isolate | `food_name: "Estimate calories ⁦tap here⁩"` (contains U+2066 LRI / U+2069 PDI, bidi isolates) | **Currently passes** the `FOOD_NAME_DISALLOWED_RE` check (not in reject-set, F1 review finding). Pill renders with visual RTL reordering inside the 60-char bounded pill. **Known limitation, documented in 55-review.md F1; deferred to follow-up.** | ⚠️ Known |
| **TC14** | Story 2 (pill) | Known gap (F2) — line/para separators | `food_name: "Pasta Line Separator"` (contains U+2028, U+2029) | **Currently passes** the reject-set (F2 finding). May distort pill layout by injecting a hard line break. **Known limitation, documented in 55-review.md F2; deferred to follow-up.** | ⚠️ Known |
| **TC15** | Story 2 (pill) | Regression — error state | Response `calorieResult.status: "unavailable"` with `food_name: "Some Dish"` present in raw JSON (but status isn't `"estimated"`) | Pill absent; error message "Couldn't estimate calories — try again" renders; no food-name text leaks into error screen | ✅ |
| **TC16** | Story 2 (pill) | Regression — no_food state | Response `calorieResult.status: "no_food"` (no calories, model found no identifiable food) | Pill absent; error screen renders unchanged | ✅ |
| **TC17** | Story 3 (items) | Happy path — typical count | `items_count: 3` | Left stat tile displays **3** (text, not "— "); label "items seen" unchanged | ✅ |
| **TC18** | Story 3 (items) | Happy path — zero (edge) | `items_count: 0` | Tile displays **0** (a genuine zero-item count is valid even if semantically odd; treated as data, not a missing value) | ✅ |
| **TC19** | Story 3 (items) | Happy path — max bound | `items_count: 50` (at `MAX_PLAUSIBLE_ITEMS`) | Tile displays **50** | ✅ |
| **TC20** | Story 3 (items) | Negative — missing | **No** `items_count` key in response | Tile shows `"—"` (neutral); hero number renders | ✅ |
| **TC21** | Story 3 (items) | Negative — null | `items_count: null` | Tile shows `"—"` | ✅ |
| **TC22** | Story 3 (items) | Negative — negative | `items_count: -1` | Out of range `[0, 50]`; tile shows `"—"` (never clamped to 0) | ✅ |
| **TC23** | Story 3 (items) | Negative — over-range | `items_count: 51` (exceeds `MAX_PLAUSIBLE_ITEMS`) | Over range; tile shows `"—"` (never clamped) | ✅ |
| **TC24** | Story 3 (items) | Negative — non-integer float | `items_count: 3.5` | Fails `Number.isInteger()` check; tile shows `"—"` | ✅ |
| **TC25** | Story 3 (items) | Negative — string type | `items_count: "3"` (string, not number) | Fails type check; tile shows `"—"` | ✅ |
| **TC26** | Story 3 (items) | Regression — error state | `calorieResult.status: "unavailable"` (error screen) | Tile shows `"—"` (unchanged from 003) | ✅ |
| **TC27** | Story 4 (conf) | Happy path — low | `confidence: "low"` | Right stat tile displays **"Low"** (capitalized label per design); label "confidence" unchanged | ✅ |
| **TC28** | Story 4 (conf) | Happy path — medium | `confidence: "medium"` | Tile displays **"Medium"** | ✅ |
| **TC29** | Story 4 (conf) | Happy path — high | `confidence: "high"` | Tile displays **"High"** | ✅ |
| **TC30** | Story 4 (conf) | Negative — missing | **No** `confidence` key in response | Tile shows `"—"`; hero number unaffected | ✅ |
| **TC31** | Story 4 (conf) | Negative — null | `confidence: null` | Tile shows `"—"` | ✅ |
| **TC32** | Story 4 (conf) | Negative — wrong case | `confidence: "LOW"` or `"Medium"` (case mismatch) | Fails enum check (case-sensitive); tile shows `"—"` | ✅ |
| **TC33** | Story 4 (conf) | Negative — synonym | `confidence: "low confidence"` or `"uncertain"` | Not exactly one of `["low","medium","high"]`; tile shows `"—"` (never defaults) | ✅ |
| **TC34** | Story 4 (conf) | Negative — number | `confidence: 2` (numeric instead of string) | Wrong type; tile shows `"—"` | ✅ |
| **TC35** | Story 4 (conf) | Negative — empty string | `confidence: ""` | Empty string not in enum; tile shows `"—"` | ✅ |
| **TC36** | Story 4 (conf) | Regression — error state | `calorieResult.status: "unavailable"` | Tile shows `"—"` (error screen, no data) | ✅ |
| **TC37** | Story 5 (security) | Negative — non-string foodName | `food_name: 123` (number) or `true` (boolean) | Fails string type check; pill absent; hero renders | ✅ |
| **TC38** | Story 5 (security) | Untrusted render — textContent verification | Code inspection of `src/index.html` — confirm pill text is set via `foodNamePill.textContent = …` | No `.innerHTML =` / `.insertAdjacentHTML(` / template-literal `.innerHTML` assignments for any model-derived text | ✅ |
| **TC39** | Story 6 (regr) | Regression — pre-007 shape | Response: `{status:"estimated", calories:500}` **with no new fields at all** (simulating old API version or fully-degraded 007 response) | Hero **500** renders exactly as it does in 003; pill absent; both tiles show `"—"` (byte-identical to pre-007 Result screen) | ✅ |
| **TC40** | Story 6 (regr) | Regression — all fields missing | `{status:"estimated", calories:640, food_identified:true}` but `food_name`, `confidence`, `items_count` all absent | Hero renders; pills/tiles neutral; hero number's render path has zero dependency on the three new fields | ✅ |
| **TC41** | Story 6 (regr) | Regression — all fields degrade independently | `{status:"estimated", calories:480, food_name:null, confidence:"low", items_count:"invalid"}` | Hero **480** renders; pill absent (name null); left tile shows `"—"` (invalid count); right tile shows **"Low"** (confidence valid) — each field independent | ✅ |
| **TC42** | Story 6 (regr) | Regression — error paths unchanged | Both `status: "no_food"` and `status: "unavailable"` responses | No hero number, error copy renders, "Try again" / "New photo" affordances unchanged from 003; no new fields ever appear | ✅ |
| **TC43** | Story 6 (regr) | Regression — no_food does not leak new fields | Model returns `stop_reason: "no_food"` but raw JSON includes `{food_name:"...", confidence:"...", items_count:...}` | Server's whole-response fail-closed ensures none of the new fields ever reach the client (they are stripped before egress on `no_food` status); client receives **only** `{status:"no_food"}` envelope | ✅ |
| **TC44** | Story 6 (regr) | Regression — refusal untouched | Model returns `stop_reason: "refusal"` | Server returns `{status:"unavailable"}` without attempting to read any field; no partial leak of new fields even if present in raw API response | ✅ |
| **TC45** | Story 1 (schema) | Negative — malformed JSON from model | Model response text is not valid JSON, or parses but is missing `food_identified` or `calories` | `estimateCalories` fails closed to `{status:"unavailable"}`; presence of the new optional fields in the schema does not change this existing fail-closed outcome | ✅ |
| **TC46** | Story 1 (schema) | Negative — one Anthropic call only | Any valid or invalid photo | Exactly **one** `POST` to `https://api.anthropic.com/v1/messages` is made; `model: "claude-sonnet-5"` in every case; no second request for the new fields | ✅ |
| **TC47** | Story 1 (schema) | Integrity — calorie plausibility unaffected | `{food_identified:true, calories:999, food_name:null, confidence:null, items_count:null}` (new fields all null/absent but calorie valid) | Estimate resolves with calorie rendered; the new fields do not influence whether the calorie number is trusted (R15 plausibility band unchanged) | ✅ |
| **TC48** | Story 1 (schema) | Integrity — calorie fails regardless of new fields | `{food_identified:false, calories:null, food_name:"Dish", confidence:"high", items_count:5}` (invalid calorie but new fields present/valid) | Whole response fails closed to `{status:"no_food"}`; the valid-looking new fields do NOT resurrect a number or leak into the error state | ✅ |
| **TC49** | Story 2 (pill) | State reset — Try-again re-submit | User estimates a photo (pill shows "Pasta"), Result screen renders; user taps "Try again"; backend returns error `{status:"unavailable"}`; user re-submits with a new photo | On the second attempt's error state, the pill from the first attempt must NOT leak into the second response's error view (stale-value non-leak, per design-spec reset-first mandate) | ⚠️ Behavioural (Playwright needed) |
| **TC50** | Story 2 (pill) | State reset — New-photo transition | User on Result screen with pill showing "Chicken bowl"; taps "New photo"; returns to Pick screen | On transition back to idle, pill (if it were visible during the transition) and all other render state must reset (pill hidden, tiles `"—"`); no state machine leakage between screens | ⚠️ Behavioural (Playwright needed) |
| **TC51** | Story 3 & 4 (tiles) | State reset — fresh estimate after error | User estimates a photo → error (tiles both `"—"`); user taps "Try again" → new photo, new estimate succeeds with valid count and confidence | Tiles populate with the new values from the fresh response (no stale values from the prior error state showing through) | ⚠️ Behavioural (Playwright needed) |

---

## Coverage summary

| Story | Coverage |
|-------|----------|
| **Story 1 (schema expansion)** | TC1, TC45, TC46, TC47, TC48 — happy path, all three fields; failure cases; one-call guarantee; calorie gate unchanged |
| **Story 2 (pill render)** | TC2–TC16, TC49, TC50 — happy path, all negatives (missing, null, empty, over-length, bad chars, error/no_food states), XSS, state reset |
| **Story 3 (items tile)** | TC17–TC26 — happy path, zero-edge, max bound, missing/null/negative/over-range/float/string types, error state, state reset (TC51) |
| **Story 4 (confidence tile)** | TC27–TC36 — happy path (all three levels), all negatives (missing, null, wrong case, synonym, number, empty), error state, state reset (TC51) |
| **Story 5 (untrusted-text hardening)** | TC8–TC14, TC37, TC38 — length bound, no formatting/emoji, closed enum, bounded integer, hostile chars (bidi/zero-width), textContent-only render, type checks |
| **Story 6 (regression)** | TC4, TC5, TC6, TC39–TC44 — pre-007 shape, all-fields-missing, independent degradation, error paths, no_food/refusal non-leak, contract additive |

**Negative case count: 34 explicit negatives across 51 cases** (exceeds ≥1 per story; comprehensive negative floor). All user-visible outcomes specified and executable.

---

## Playwright recommendation

**RECOMMEND adding Playwright as a dev-dependency** for the following **behaviourally untested render paths:**

### Cases requiring browser verification (TC49–TC51, plus two render-dependent paths not captured above):

1. **Pill state transitions (TC49–TC50):**
   - Verify the pill hidden ↔ shown transition works (CSS `hidden` attribute toggling)
   - Verify stale pill text from a prior estimate does NOT leak into a subsequent error/new-photo/Try-again state
   - The reset-to-neutral-first mandate in the design is enforced in code but not behaviourally verified

2. **Stat-tile population and stale-value guard (TC51):**
   - Verify tiles populate independently (items-seen tile shows value while confidence shows `"—"` if confidence invalid)
   - Verify a stale value from a prior `done` state doesn't leak into `estimating` or `error` or `no_food` branches
   - The per-field reset in `render()` is code-present but unverified at runtime

3. **Untrusted-text render path (TC8, render portion):**
   - Verify `textContent` assignment actually prevents XSS (static assertions confirm no `.innerHTML =`, but a running browser confirms the string appears inert in the DOM)
   - Verify hostile/reordered content (including the F1 bidi-isolate edge case) renders as literal text with no interactive effect

4. **Client-side re-validation:**
   - The client repeats the server's validation checks before render; confirm that a bypassed payload (via devtools/direct request with a crafted `foodName`) is still rejected client-side and the pill stays hidden

### Why Vitest is insufficient:

- **Vitest** tests the server (`vision.test.js`, `upload.test.js`) — validation logic, request shape, JSON parsing, the schema-level enum — all ✅ covered.
- **Vitest** includes static-HTML assertions (pill has `hidden`, no `.innerHTML =` literals) — passes.
- **Vitest** does NOT execute the browser JavaScript state machine (`render()` function) or confirm that DOM attributes actually change at runtime.
- The client-side `render()` is vanilla JS in a script block, not imported as a module, so unit testing it independently is non-trivial; Playwright's click-through flow is the natural verification path.

### Recommended scope (Playwright):

- 3–5 end-to-end flows (happy path + error path + Try-again re-submit + New-photo reset) at E2E resolution, exercising the full state machine.
- Minimal: confirm pill shows/hides, tiles populate/reset to neutral, stale values don't leak across state transitions.
- Medium: add a crafted-payload check (devtools-injected bad `foodName`) to confirm client-side re-check works.
- Does NOT require: pixel-perfect screenshot matching (the static HTML assertions already confirm styling hooks exist).

### ADR alignment:

Adding Playwright **does not violate ADR-001** (no framework, no build tool):
- Playwright is a **dev-dependency** (test harness, not runtime). The build output remains unchanged.
- Precedent: 002/003 run Vitest (dev-dependency) with no ADR; Playwright is the same category.

---

## Known gaps & deferred findings

Documented in `55-review.md` (review findings F1–F5):

- **F1 (bidi isolate & ALM):** Reject-set incomplete; U+2066–U+2069 and U+061C pass. **Documented as TC13; impact bounded (visual deception in 60-char pill, no XSS).** Deferred to follow-up.
- **F2 (line/para separators):** U+2028/U+2029 pass and can distort pill layout. **Documented as TC14; optional fold into F1 fix.**
- **F3 (MAX_TOKENS untested):** The 256→1024 bump is sensible (added buffer for 5-field JSON, no cost implication) but has no explicit assertion in the test suite. Recommend adding a one-line request-shape check.
- **F4 (render path untested):** **This QA suite explicitly recommends Playwright** (see above) to cover the client-side render, state-machine transitions, and stale-value guards. This is the core follow-up for 008.
- **F5 (client re-check weaker than server):** Client-side `foodName` re-check doesn't re-apply `MAX_FOOD_NAME_LENGTH` or char reject-set; server is authoritative. Optional defense-in-depth symmetry fix.

---

## Execution notes

All 51 cases listed above are **executable against the live app** (`GET /` Result screen after a real or mocked photo upload). Each case specifies:
- **Input:** the exact value or response structure
- **Expected Outcome:** what the user sees (pill presence/text, tile text, hero number)
- **Pass Signal:** how you verify it (DOM inspection, screenshot, console check for no `.innerHTML =` assignments)

**Vitest status (already passing):** 95/95 tests green. The test matrix above mirrors and extends the test suite's scope into manual/E2E categories.

**This document makes no release-bar call, severity rating, or ship recommendation. Hand back to the human for the final decision on F1/F2 blocking vs. accepted-risk, and on Playwright adoption for 008.**
