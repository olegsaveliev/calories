# 007 — Food ID + confidence: Design (approach + ADRs in force)

> Step 3 (architecture). Short approach + which ADRs govern. Behaviour source of truth:
> `20-stories-acs.md` + `20-prd.md` + `00-feature.md`. Schema/param shapes were verified against the
> claude-api reference (structured outputs) — see §2, not from memory.

**This is an additive schema expansion on the SAME single `claude-sonnet-5` call + a Result-screen
wiring change.** No server, transport, dependency, framework, or model-tier change. Both ADRs hold
unchanged. **No new ADR. No options fork (human pick) needed** — see §6/§7.

---

## 1. Which ADRs govern (reused, not re-decided)

- **ADR-001 (one vanilla Node service, no framework/build tool, key server-side).** Holds. Schema
  change is inside the existing `estimateCalories` `fetch` call; frontend wiring is inline vanilla
  JS/CSS in the one `index.html`. No new dependency (no sanitizer/markdown lib — PRD out-of-scope).
- **ADR-002 (raw-binary `POST /upload`, MIME in `Content-Type`).** Holds and is **untouched** — this
  feature changes the *response body* (`calorieResult` grows), never the request transport. Precedent:
  002 already grew `calorieResult` additively with no ADR; this is the same move (§5/§6).
- **002 model-tier pick (`claude-sonnet-5`).** Reused verbatim — same single round-trip, same 30s
  ceiling, same `thinking:{type:"disabled"}`, same R15 band on `calories`. No cost re-baseline.

## 2. Expanded structured-output schema (verified against claude-api reference)

Reference check (claude-api structured outputs / `output_config.format` + `json_schema`): `enum` and
`anyOf`/`null` **are** supported at the schema level; **numeric (`minimum`/`maximum`) and string
(`minLength`/`maxLength`) constraints are NOT** — the API ignores/strips them, and this app calls raw
`fetch` (not the SDK), so those bounds cannot be relied on in the schema at all. This is exactly why
002 already enforces the 1–5000 `calories` band in JS, not in the schema. The three new fields follow
that same split: **type/enum in the schema (defense-in-depth), numeric/length bounds in JS.**

`RESPONSE_SCHEMA` in `src/vision.js` becomes (mirroring the existing nullable-`calories` pattern):

```js
{
  type: "object",
  properties: {
    food_identified: { type: "boolean" },                         // unchanged
    calories:   { anyOf: [{ type: "integer" }, { type: "null" }] },// unchanged
    food_name:  { anyOf: [{ type: "string" }, { type: "null" }] }, // NEW — no maxLength (unsupported); bounded in JS
    confidence: { anyOf: [{ type: "string", enum: ["low","medium","high"] },
                          { type: "null" }] },                     // NEW — enum IS schema-enforced (AC5.3 satisfied here)
    items_count:{ anyOf: [{ type: "integer" }, { type: "null" }] } // NEW — no min/max (unsupported); bounded in JS
  },
  required: ["food_identified","calories","food_name","confidence","items_count"],
  additionalProperties: false,
}
```

Notes:
- Wire names stay snake_case (matches `food_identified`); they are mapped to the camelCase result keys
  (`foodName`/`confidence`/`itemsCount`) the stories/frontend use.
- `confidence` enum lives in the schema **and** is re-checked in JS (AC5.3 = defense-in-depth, not
  either/or). `food_name`/`items_count` bounds live only in JS (schema can't express them).
- `PROMPT_TEXT` must be extended to describe the three new fields honestly (short plain dish name; the
  model's own low/med/high confidence; count of distinct visible food items) — but the prompt is
  **never** a safety control; the JS validation + `textContent` are.
- **Build flag (not an ADR): watch `MAX_TOKENS` (currently 256).** The enlarged JSON object is bigger;
  256 is still comfortable for a short dish name + enum + int, but engineering should confirm a real
  photo can't hit `stop_reason:"max_tokens"` (→ parse fail → *false* fail-closed on a valid photo) and
  bump modestly if needed.

## 3. Untrusted-text validation contract (the crux — server-side, authoritative)

All three new fields are validated in `src/vision.js` **before** they leave the server, so the frontend
only ever receives a safe, bounded value or nothing. Whole-response fail-closed is unchanged (a
refusal / bad `food_identified` / null `calories` / out-of-band `calories` still yields
`unavailable`/`no_food` carrying **none** of the new fields — AC1.4/AC1.5/AC2.5). The new fields are
validated only on the `estimated` path, each **independently** (per-field degrade, never fails the
calorie number — AC-Story-6).

Precedent for every rule below: **reject-to-neutral, never rewrite** — the same posture R15 already
takes on `calories` ("we do NOT clamp… rewriting the model's answer would be fabricating it"). Prod-ba's
"never truncate/clamp" rule and AC2.3/AC5.1 all point the same way, so this is the one sensible approach
(not an options fork).

**`food_name` → `foodName` (first free-text this app ever surfaces):**
- New constant `MAX_FOOD_NAME_LENGTH` (recommend **60**; final value is threat-model's per `00-feature.md`
  — long enough for real dish names, short enough to bound the string + fit the pill). Named alongside
  the existing `MIN/MAX_PLAUSIBLE_CALORIES`.
- Rule: take the value; if not a string → **omit**. Trim edge whitespace only (the sole allowed
  normalization — surrounding-whitespace trim is not a semantic rewrite; no internal edit, no
  truncation). If the trimmed string is empty → **omit** (AC2.2). If its length **>**
  `MAX_FOOD_NAME_LENGTH` → **omit entirely** (AC2.3/AC5.1 — reject, never truncate-and-show; a truncated
  string still puts rewritten untrusted text on screen).
- Character policy = **reject, don't strip** (stays consistent with never-rewrite and closes AC5.5's
  deception vectors): if the trimmed string contains any C0/C1 control character, zero-width character,
  or bidirectional-override code point → **omit**. Otherwise pass the value through **verbatim**. No
  sanitizer, no emoji handling, no markdown parsing (AC5.2) — emoji/markdown are harmless opaque text
  once the render path is `textContent`-only and the length is bounded. (The precise reject-set is a
  named regex constant, e.g. `FOOD_NAME_DISALLOWED_RE`; threat-model finalizes its exact membership.)

**`confidence` (closed enum):**
- New frozen constant `CONFIDENCE_LEVELS = ["low","medium","high"]`. Trusted only if the value is
  **exactly** one of those (case-sensitive, no synonyms, no numbers). Anything else → **omit** (AC4.2 —
  never default to "medium"). Schema enum is the first line; this JS check is the backstop.

**`items_count` → `itemsCount` (bounded non-negative integer):**
- New constants `MIN_PLAUSIBLE_ITEMS = 0` and `MAX_PLAUSIBLE_ITEMS` (recommend **50**; final value
  threat-model's — a generous ceiling above which the count is a hallucination/injection). Mirrors the
  `calories` check exactly: `Number.isInteger(v) && v >= MIN_PLAUSIBLE_ITEMS && v <= MAX_PLAUSIBLE_ITEMS`
  → keep; else → **omit** (AC3.2 — never clamp, never fall back to `0`). Edge note for engineering: a
  genuine `items_count: 0` on an identified meal is contradictory-but-valid per the schema; ux may
  choose to treat 0 as neutral — that's a display nuance, not a validation change.

## 4. `CalorieResult` shape (server) — omit-on-absent

`EstimatedResult` grows; the two failure results are **unchanged** (never carry new fields):

```js
// estimated only — each new key present ONLY if it passed §3 validation, else the key is ABSENT
{ status: "estimated", calories, foodName?, confidence?, itemsCount? }
{ status: "no_food" }        // unchanged
{ status: "unavailable" }    // unchanged
```

**Omit absent keys (do not send `foodName: null`).** This makes the pre-007 wire shape byte-identical
to a 007 response where all three degraded, which is precisely AC6.1's regression scenario ("no keys
present at all"). `src/server.js` line ~155 already rebuilds `calorieResult` for the `estimated` branch —
it spreads whichever validated fields `estimateCalories` returned; `ok`/`size`/`type` untouched (AC6.4).

## 5. `POST /upload` response contract change

`calorieResult` (nested in the `200 {ok,size,type,calorieResult}` envelope) gains three **optional**
fields on the `estimated` status only:
- `foodName` — bounded plain string (≤ `MAX_FOOD_NAME_LENGTH`), or **absent**.
- `confidence` — `"low"|"medium"|"high"`, or **absent**.
- `itemsCount` — integer in `[MIN_PLAUSIBLE_ITEMS, MAX_PLAUSIBLE_ITEMS]`, or **absent**.

`ok`, `size`, `type`, the `no_food`/`unavailable` shapes, all error codes, the check order, the size cap,
and the JPEG/PNG allowlist are **byte-for-byte unchanged** (AC6.4/AC6.5). Delivery-pm updates the
manifest's contract block with these optional fields at wrap.

## 6. ADR decision: **no new ADR** (justified)

The ADR bar is *hard to reverse AND likely to be questioned*. This change is neither in a way that
clears it:
- **Additive + reversible + backward-compatible** — new keys are optional, omitted-when-absent, and
  removing them restores the exact prior shape. Old clients/tests that read only `calories` are
  unaffected.
- **Direct precedent** — 002 added `calorieResult` to the same envelope with **no ADR** (manifest calls
  it an "additive field"); 003 shipped with no ADR. Adding optional fields to an already-additive result
  is the same low-commitment move, not a new interface commitment.
- **ADR-002 is untouched** — it governs the raw-binary *request transport*, which does not change. The
  *response body* it does not fix.
The choice is recorded here; the durable interface record is the manifest contract block (updated at
wrap). Re-open only if a future field needed a non-additive/breaking change to the envelope.

## 7. Options fork check — none needed (recommendations, proceed)

- **Model-self-reported vs. derived confidence** — **already decided by the human** (`00-feature.md`
  scope CONFIRMED: `confidence` is an enum from the expanded schema on the same call). Deriving it (e.g.
  from band width) would be a different feature and collides with the out-of-scope "± range." Not open.
- **Reject vs. truncate over-length `foodName`** — one sensible answer (reject/omit), forced by the
  R15 never-rewrite precedent + AC2.3/AC5.1 + prod-ba's rule. Not a genuine trade-off fork.
- **Omit-absent vs. explicit-`null` keys** — omit wins on the AC6.1 regression criterion; reversible
  either way. Not worth a human gate.

None clears the "≥2 viable approaches the human must arbitrate" bar → **no `30-options.md`, no STOP.**
Exact numeric constants (`MAX_FOOD_NAME_LENGTH`, `MAX_PLAUSIBLE_ITEMS`, the reject-set) are deliberately
recommended-here / finalized-by-threat-model per `00-feature.md`.

## 8. Frontend wiring (`src/index.html`, vanilla, `textContent`-only)

Extend the existing `render()` (the `!isPick` / `done` branch), independently per field; every path
**resets to neutral first** so a stale value from a prior "done" never lingers into estimating/error/
no_food or a Try-again re-run (AC2.5/AC6.2):
- **Food-name pill** — new DOM node inside `.photo-thumb`, overlaid bottom-left, `hidden` by default.
  On `done`: if `typeof cr.foodName === "string" && cr.foodName` → set `pill.textContent = cr.foodName`
  and unhide; else keep hidden (omitted — no placeholder). Server already bounded/validated it; the
  client re-check is defensive. **`textContent` only — never `innerHTML`/`insertAdjacentHTML`** (AC2.4/
  AC5.2/AC5.5; preserves the 001/002 XSS posture).
- **Left tile `items seen`** — on `done`: if `Number.isInteger(cr.itemsCount) && cr.itemsCount >= 0` →
  `statValue1.textContent = String(cr.itemsCount)`; else `"—"` (AC3.1/AC3.2). Label/position unchanged
  (AC3.3).
- **Right tile `confidence`** — on `done`: if `cr.confidence` is one of `"low"|"medium"|"high"` →
  render it (exact visual — text/badge/dot — is ux-design's call, `textContent` for any text);
  else `"—"` (AC4.1/AC4.2). Label/position unchanged (AC4.3).
- **estimating / error / no_food** — pill hidden, both tiles `"—"`, no number — unchanged from 003
  (AC2.5/AC6.2). The hero-number path has zero dependency on the new fields (AC6.1).

Existing `tests/upload.test.js` negative assertion ("none of the 007 demo values appear") is the one
assertion engineering is expected to revise (it was always scoped "until 007 wires these fields",
AC6.3) — no other existing assertion should need to change.
