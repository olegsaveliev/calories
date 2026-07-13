# 007 — Food ID + confidence: Code Review

**Reviewer independence tier: A** — reviewed by a fresh subagent that never saw the code being
written; inputs were the spec (`20-stories-acs.md`), design (`30-design.md`), build notes, manifest,
ADRs, and the finished diff only. No author context.

**Verdict: SHIP-ready with minor fixes recommended.** The crux — untrusted model text reaching the
DOM — is handled correctly in its core posture (`textContent`-only render, server-authoritative
validation, per-field fail-closed that never touches the calorie guard, omit-on-absent wire shape).
One security-class gap in the character reject-set is flagged below per the skill's stop-and-flag
rule, but its blast radius is bounded (no injection possible; length-capped visual-deception only).
The **human owns the ship/block call** on it.

Test result at review time: **95/95 green** (`npm test`), matching the build notes.

**Findings: 1 minor (security) · 3 minor · 1 nit.** None are correctness/regression blockers.

---

## Lens-by-lens

### 1. Correctness / logic — one edge finding
The fail-closed ordering in `estimateCalories` is intact and correctly sequenced: refusal →
`extractStructuredReply` (still only requires `food_identified` boolean + `calories` number|null,
AC1.2/AC1.4) → `food_identified===false || calories===null` → `no_food` → `Number.isInteger` + sign
→ R15 band → *only then* build the estimate and attach the three new fields. The new fields are
validated **after** the calorie guard and can only ever be omitted, never flip a good estimate to
`unavailable`/`no_food` (AC-Story-6 satisfied). `render()` resets all three to neutral
unconditionally at the top before branching, and `submitEstimate`/`resetToIdle` reset on every
non-`estimated` branch — no stale value can leak across estimating/error/no_food/Try-again/New-photo.
See finding **F2** for one control-char edge the reject-set misses.

### 2. Security — see F1 (the crux) and F5
Core posture is correct: the pill text is set via `foodNamePill.textContent` only; the static test
now hard-asserts no `.innerHTML =` / `.insertAdjacentHTML(` anywhere in the shipped file
(`tests/upload.test.js`). Validation is server-authoritative and runs **before** egress of the field
to the client; the client re-check is defensive-only. No raw model field is ever used before
validation (server uses the validated `result.*`; client uses `cr.*` only after its own re-check).
Off-enum confidence and out-of-range `itemsCount` cannot reach the UI. **But** the `foodName`
character reject-set is incomplete (F1), and the client re-check is weaker than the server's (F5).

### 3. Regression — none found
`calorieResult` is grown additively with omit-on-absent (`"foodName" in result` spreads), so a
fully-degraded 007 response is byte-identical to the pre-007 `{status:"estimated",calories}` shape —
proven by both `tests/vision.test.js` (`Object.keys(result).sort()` equals `["calories","status"]`)
and the end-to-end `tests/upload.test.js`. `ok`/`size`/`type` and the `no_food`/`unavailable` shapes
are untouched (AC6.4). All 001/002/003 assertions still pass; only the one 003 negative assertion the
design flagged as expected-to-change was revised, exactly as scoped (AC6.3). Metadata strip, MIME
allowlist, rate-limit, privacy notice all untouched.

### 4. Edge cases — see F2, F5
Empty/whitespace/non-string name, over-length, off-enum confidence (incl. wrong case), and
negative/non-integer/out-of-range/`NaN` `itemsCount` are all covered by tests and reject-to-neutral
correctly. A genuine `itemsCount: 0` and both band edges are accepted. Gaps: bidi isolates (F1),
U+2028/U+2029 (F2).

### 5. Simplicity / dead code — none found
No unused exports or dead branches. Constants (`MAX_FOOD_NAME_LENGTH`, `CONFIDENCE_LEVELS`,
`MIN/MAX_PLAUSIBLE_ITEMS`, `FOOD_NAME_DISALLOWED_RE`, `CONFIDENCE_LABELS`) are all referenced.

### 6. ADR / decision drift — none found
No new dependency, no framework/build tool, no second model call, no transport change. The schema
expansion rides the SAME single `POST` (AC1.3 asserted: `toHaveBeenCalledTimes(1)`, same
`claude-sonnet-5`). ADR-001/ADR-002 both hold; the design's "no new ADR" call is justified (additive,
reversible, omit-on-absent). Response body grew; request transport (ADR-002) untouched.

---

## Findings (ranked)

### F1 — [Minor, security] Bidi **isolate** + ALM spoofing code points slip through the `food_name` reject-set
**`src/vision.js:85-87`** (`FOOD_NAME_DISALLOWED_RE`).

The reject-set covers bidi *overrides/embeddings* (U+202A–U+202E) and LRM/RLM (in U+200B–U+200F),
but **not** the bidi *isolate* controls **U+2066–U+2069** (LRI / RLI / FSI / PDI), nor **U+061C**
(Arabic Letter Mark). These are the other half of the Trojan-Source / bidi-spoofing family
(CVE-2021-42574) and produce the *same* visual RTL/LTR reordering the design explicitly claims to
block — 30-design.md §3 lists "bidirectional-override code point (RTL/LTR spoofing)" as a reject
target, and the test suite deliberately exercises RLO (`‮`) for exactly this reason, so isolates
are an equivalent bypass of the stated contract.

**Concrete repro** (verified by executing the regex against these code points):
`food_name: "⁦Estimate calories ▶ tap here⁩"` → `validateFoodName` returns the string
intact → it reaches `foodNamePill.textContent`. LRI/RLI/FSI/PDI, ALM, and also U+2028/U+2029 all
return "PASSES" against `FOOD_NAME_DISALLOWED_RE`; only 202A–202E, 200B–200F, and FEFF are rejected.

**Why it matters / blast radius:** This is precisely the AC5.5 "string crafted to look like a UI
element" deception vector. **Impact is bounded and does NOT reach injection:** render is
`textContent`-only (no HTML/script execution possible) and the string is hard-capped at 60 chars, so
the ceiling is visual reordering/deception *within the dish-name pill* — not XSS, not code exec, not
data exfil. That is why this is rated **minor**, not major. But it is a security-class gap that
contradicts the design's own §3 reject contract, so it is flagged (not buried) per the skill rule.

**Suggested fix (engineering's call):** extend the class to
`…‪-‮⁦-⁩؜…` (and optionally `  `, see F2). Add a test row for a
bidi-isolate name mirroring the existing RLO row.

### F2 — [Minor, correctness/edge] U+2028 / U+2029 line & paragraph separators pass the reject-set
**`src/vision.js:85-87`.** These are not in `\x00-\x1F` and are not otherwise listed, so an *internal*
occurrence survives (`String.prototype.trim` only strips them at the edges). In `textContent` they can
inject a hard line break into the single-line pill, distorting layout. No security impact (opaque
text, length-bounded). Fold into the F1 regex fix.

### F3 — [Minor, test-coverage] `MAX_TOKENS` 256→1024 is coherent but untested, and the build note cites a test that does not exist
**`src/vision.js:32`; `50-build-notes.md`.** The bump itself is sound: `thinking:{type:"disabled"}`
reserves the whole budget for the answer, `max_tokens` is a ceiling (not billed unless emitted), and a
short structured-JSON reply won't approach 1024 — so **no material cost implication** (the enlarged
5-field JSON is still tiny; the headroom only prevents a `max_tokens` truncation → false fail-closed
on a valid photo, which is the correct motivation). However: `grep` across `tests/` finds **no
assertion on `max_tokens` at all**, yet the build note claims the change stays "well inside the
existing test's `<= 1024` bound." That assertion does not exist — the value is unguarded against
future regression and the note is inaccurate. Low severity; recommend adding a one-line request-shape
assertion (`JSON.parse(init.body).max_tokens` is a sane bound) rather than relying on the prose.

### F4 — [Minor, test blind-spot] The first untrusted-text **render path** has zero behavioural test
**`src/index.html` `render()` / `submitEstimate()`.** Field *validation* is thoroughly covered in
`vision.test.js` + `upload.test.js`, but the DOM wiring that actually surfaces the untrusted string —
pill unhide via `textContent`, tile population, the "reset-to-neutral-first" stale-value guard across
estimating/error/no_food/Try-again/New-photo, and the client re-validation — is verified **only by
static-HTML string assertions** (pill ships `hidden`; no `.innerHTML =`/`.insertAdjacentHTML(`
literals). No running browser confirms that (a) a hostile `foodName` renders inert, (b) the pill
degrades to hidden on a Try-again following a prior `done`, or (c) a stale tile value never leaks.
This is the pre-existing known limitation (client state machine untested; Playwright deferred to
roadmap 008) now extended to the app's first untrusted-text surface. **Unverified behavioural paths
for the new fields:** pill show/hide transitions, per-field neutral-reset on state change, stale-value
non-leak on re-submit, and client-side re-validation of a crafted payload. Not a blocker given the
static checks + server-side authority, but the highest-value follow-up test target.

### F5 — [Nit, defense-in-depth] Client-side `foodName` re-check is weaker than the server's
**`src/index.html:867`.** The client "defensive re-check" tests only
`typeof cr.foodName === 'string' && cr.foodName.length > 0` — it does **not** re-apply
`MAX_FOOD_NAME_LENGTH` or the disallowed-char set the server enforces. Acceptable in practice (the
server is the authoritative bound, same-origin, and render is `textContent` so nothing can inject),
but the "never trusts the payload blindly" comment slightly oversells it. Optional: mirror the length
bound client-side for symmetry.

---

## Escalation (human-owned, per skill)
- **F1 is security-class** → flagged here, not buried; whether it blocks ship or is an accepted
  bounded risk is the **human's** call (render is `textContent`-only and length-capped, so the risk is
  visual deception in a 60-char pill, not injection).
- No code was modified by this review (reviewer reports; engineering fixes).
