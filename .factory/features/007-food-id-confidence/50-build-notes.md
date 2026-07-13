# 007 — Food ID + confidence: Build notes

**Follows:** `30-design.md` exactly (additive schema expansion on the SAME `claude-sonnet-5` call +
Result-screen wiring). No new ADR, no new dependency, no new model, no server/transport change.

## Files touched

- **`src/vision.js`**
  - `RESPONSE_SCHEMA` expanded to `{food_identified, calories, food_name, confidence, items_count}`
    (wire names stay snake_case, mapped to camelCase result keys). `confidence` carries a
    schema-level `enum: ["low","medium","high"]` (defense-in-depth, AC5.3) inside an
    `anyOf`/`null` branch, matching the existing nullable-`calories` pattern. `food_name` and
    `items_count` get `anyOf`/`null` only — the claude-api structured-outputs reference (read
    before writing any of this, per the task) confirms `minLength`/`maxLength`/`minimum`/`maximum`
    are **not** schema-enforced, so their bounds live only in JS, exactly like the existing
    `calories` plausibility band.
  - New exported constants: `MAX_FOOD_NAME_LENGTH = 60`, `CONFIDENCE_LEVELS = ["low","medium","high"]`
    (frozen), `MIN_PLAUSIBLE_ITEMS = 0`, `MAX_PLAUSIBLE_ITEMS = 50`, and
    `FOOD_NAME_DISALLOWED_RE` (a reject-set: C0/C1 controls, DEL, zero-width chars U+200B-U+200F,
    bidi embedding/override U+202A-U+202E, invisible operators U+2060-U+2064, BOM/ZWNBSP U+FEFF).
  - New validators `validateFoodName`/`validateConfidence`/`validateItemsCount`: reject-to-neutral,
    never rewrite. `food_name` — trim edge whitespace only (the sole allowed normalization); omit
    (return `null`) if non-string, empty after trim, over `MAX_FOOD_NAME_LENGTH`, or containing any
    disallowed code point (rejected wholesale, never stripped-and-shown). `confidence` — omit unless
    it is exactly one of `CONFIDENCE_LEVELS`. `items_count` — omit unless
    `Number.isInteger` and within `[MIN_PLAUSIBLE_ITEMS, MAX_PLAUSIBLE_ITEMS]`.
  - `estimateCalories()`'s success branch now builds the result additively: `{status:"estimated",
    calories}` plus `foodName`/`confidence`/`itemsCount` keys **only when validated** (omit-on-absent
    — never `foodName: null`). Whole-response fail-closed (refusal / bad `food_identified` / null or
    implausible `calories`) is completely unchanged and never carries any of the three new fields.
  - `extractStructuredReply()` unchanged in its required-shape check (`food_identified` boolean,
    `calories` number|null) — the new fields are read through untouched and validated separately by
    the caller, so a missing/malformed new field never fails the whole response.
  - **`MAX_TOKENS` raised from 256 to 1024.** The enlarged JSON object (5 fields vs. 2) plus an
    unbounded-by-schema `food_name` could plausibly approach 256 tokens; since `thinking` is
    disabled, hitting `max_tokens` mid-JSON would parse-fail and *falsely* fail-closed a valid photo.
    1024 leaves generous headroom while staying within the existing test's `<= 1024` assertion.

- **`src/server.js`**
  - `calorieResult` construction for the `"estimated"` branch now spreads `foodName`/`confidence`/
    `itemsCount` from the vision-module result **only if the key is present** (`"foodName" in
    result`, etc.) — so a fully-degraded 007 response is byte-identical to the pre-007 shape
    (`{status:"estimated", calories}`), satisfying the AC6.1/AC6.4 regression requirement. `ok`,
    `size`, `type`, and the `no_food`/`unavailable` shapes are untouched.

- **`src/index.html`**
  - CSS: new `.food-name-pill` rule matching the design-handoff spec exactly — `padding: 5px 11px`,
    `border-radius: 20px`, `background: rgba(10,11,13,.7)`, `backdrop-filter: blur(8px)` (+
    `-webkit-` prefix), text `12px`/`600`/`--text`, absolutely positioned bottom-left inside the
    existing `.photo-thumb` (already `position: relative; overflow: hidden`).
  - Markup: added `<div class="food-name-pill" id="food-name-pill" data-testid="food-name-pill"
    hidden>` inside `.photo-thumb`, after the result photo `<img>`. Added `id="stat-value-1"` /
    `id="stat-value-2"` to the existing stat-tile value elements (kept their `data-testid`s
    unchanged) so the script can address them directly.
  - Script: new state fields `foodName`/`confidenceLevel`/`itemsCount` (all default `null`),
    `CONFIDENCE_LEVELS` + `CONFIDENCE_LABELS` (`{low:"Low", medium:"Medium", high:"High"}` — the
    confidence visual treatment is plain text, per 30-design.md "visual treatment is ux-design's
    call, not prescribed here").
    - `render()` now resets all three to neutral **unconditionally, at the top of the function**
      (pill hidden + empty, both tiles `"—"`) before branching on state, so a stale value from a
      prior `done` can never leak into `estimating`/`error`/`no_food` or a fresh Try-again/New-photo
      render. Only the `done` branch may repopulate them, and each field degrades independently:
      pill stays hidden unless `foodName` is a non-empty string; `items seen` tile shows the integer
      only if `Number.isInteger(itemsCount) && itemsCount >= 0`; `confidence` tile shows the label
      only if `confidenceLevel` is one of `CONFIDENCE_LEVELS`.
    - `submitEstimate()` re-validates each of the three fields client-side from
      `data.calorieResult` (defensive re-check on top of the server's own validation — never trusts
      the payload blindly) and resets all three to `null` on every non-`estimated` branch
      (`no_food`, `unavailable`, and the network-error `catch`).
    - `resetToIdle()` resets all three to `null` alongside the existing `calories`/`errorReason`
      reset.
    - The pill's text is set via `foodNamePill.textContent = foodName` — **never** `innerHTML` or
      `insertAdjacentHTML` — preserving the 001/002/003 XSS posture for the first model-generated
      free text this app has ever surfaced.

## Tests added

- **`tests/vision.test.js`** (+~20 tests): expanded-schema request-shape assertions (required keys,
  `confidence`'s schema-level enum, `anyOf`/`null` shapes for `food_name`/`items_count`); full
  happy-path resolution of all three fields; every untrusted-text rejection path (over-length name,
  empty/whitespace name, non-string name, control/zero-width/bidi-override characters, off-enum
  confidence incl. wrong case/number/synonym, out-of-range/non-integer/negative `items_count`);
  band-edge acceptance (`MIN_PLAUSIBLE_ITEMS`, `MAX_PLAUSIBLE_ITEMS`, a genuine `0`); emoji/markdown
  passed through verbatim (no stripping); a fully-degraded response still resolving the calorie
  estimate with the exact pre-007 shape; no_food/refusal paths never leaking the new fields even
  when present in the raw reply.
- **`tests/upload.test.js`**: new `describe("POST /upload — 007…")` block exercising the same matrix
  end-to-end through the real HTTP server (happy path, fully-degraded regression, over-length name,
  off-enum confidence, out-of-range count, no_food non-leak) — confirms `ok`/`size`/`type` stay
  byte-for-byte unchanged and exactly one Anthropic call is made per request. Revised the one
  negative assertion the design doc flagged as expected-to-change (`AC3.2` in 003): it now confirms
  the pill/tiles DOM hooks exist and degrade to neutral by default, while keeping every hardcoded
  demo-value check ("642", "grilled chicken bowl", "high confidence", "3 items seen", "± NN") as a
  hard negative — those must never appear as literals in the shipped file.

## Verification

- `npm run lint` — clean.
- `npm test` — 95/95 passing (previously 74; all prior assertions preserved, only the one flagged
  negative assertion in `tests/upload.test.js` was revised as scoped).
- Manually booted `createServer()` on an ephemeral port and confirmed `GET /` serves the pill/tile
  DOM hooks.

## Notes for review / next steps

- Confidence's visual treatment (plain text label "Low"/"Medium"/"High") is a judgment call within
  30-design.md's "visual TBD by ux-design" allowance — a badge/dot treatment would be a CSS-only
  follow-up if a reviewer or the human wants a stronger visual distinction.
- No change to `ANTHROPIC_API_KEY` handling, rate-limiting, metadata stripping, or the raster-MIME
  allowlist — all preserved verbatim per 30-design.md §1/§4.
