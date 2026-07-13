# 007 — Food ID + confidence: Stories & Acceptance Criteria

**Builds on:** 002 (`src/vision.js` — single `claude-sonnet-5` call, structured-output schema
`{food_identified, calories}`, fail-closed to `unavailable`/`no_food`) and 003 (`src/index.html`
Result screen — food-name pill and both stat tiles currently neutralised: pill absent, both
tiles literal `"—"`). This feature expands the SAME structured-output schema on the SAME call and
wires the three fields 003 deliberately left inert. No new model call, no new dependency
(ADR-001/ADR-002 both preserved — see `00-feature.md`).

Confirmed out of scope (do not re-litigate): the "± NN" calorie range; feature 004/005/006 work.
See `20-prd.md` for the full out-of-scope list.

---

## AI Eval Card (attached to Story 1 — the only story that touches the model call)

| Element | Spec |
|---|---|
| **Confidence threshold** | N/A for gating the calorie number (unchanged from 002 — the R15 1–5000 plausibility band still governs whether a calorie number renders at all). NEW: the `confidence` field itself is only trusted when it is *exactly* one of `"low" \| "medium" \| "high"`; anything else is treated as not-provided (Story 5). |
| **Refusal trigger** | Unchanged from 002 — `data.stop_reason === "refusal"` fails the WHOLE call closed to `unavailable`. Expanding the schema adds no new refusal path; a refusal never leaks a partial name/confidence/count. |
| **Latency ceiling** | Unchanged — same 30s `AbortController` ceiling on the same single round-trip (no second call added for the new fields). |
| **Fail-closed fallback** | Two layers, not one: (a) whole-response fail-closed is unchanged from 002 (`no_food`/`unavailable` never carry any of the new fields either); (b) NEW per-field fail-closed — an individual new field being missing/invalid degrades ONLY that field to a neutral, non-fabricated state and does **not** fail the calorie estimate itself (Story 6). |

---

## Story 1 — Expand the vision-model structured-output schema

**As a** developer maintaining the vision-model integration,
**I want** the existing `claude-sonnet-5` structured-output contract expanded to also request a
dish name, a confidence level, and an item count,
**so that** the Result screen has real data to show instead of "—" placeholders, without adding a
second model call or a new dependency.

### ACs

- **AC1.1 (happy path):** Given a photo that clearly shows a single identifiable dish, when
  `estimateCalories` completes successfully, then the resolved result includes `foodName` (a
  non-empty string), `confidence` (one of `"low" | "medium" | "high"`), and `itemsCount` (a
  non-negative integer), alongside the existing `calories` integer — all from the ONE existing API
  round-trip (no second `fetch` to `api.anthropic.com`).
- **AC1.2 (existing fields unchanged):** Given the same call, when the response is parsed, then
  `food_identified` and `calories` are extracted and validated exactly as they are today (same
  types, same 1–5000 plausibility band, same fail-closed behaviour) — this story adds fields, it
  does not change the meaning or validation of the existing two.
- **AC1.3 (no second call, no new model):** Given this feature is implemented, when
  `estimateCalories` runs, then it still issues exactly one `POST` to
  `https://api.anthropic.com/v1/messages` with `model: "claude-sonnet-5"` — no additional request,
  no additional model tier.
- **AC1.4 (error path — malformed structured reply):** Given the model's reply text does not parse
  as valid JSON, or parses but is missing `food_identified`/`calories` or has them in the wrong
  shape, when `estimateCalories` processes it, then the whole call fails closed to
  `{status: "unavailable"}` exactly as it does today — the presence of the new optional fields in
  the schema must never change this existing fail-closed outcome.
- **AC1.5 (error path — refusal untouched):** Given `data.stop_reason === "refusal"`, when
  `estimateCalories` handles the response, then it returns `{status: "unavailable"}` without
  attempting to read `content` for ANY field, old or new (unchanged from 002).

---

## Story 2 — Food-name pill on the Result screen

**As a** user who just got a calorie estimate,
**I want** to see the name of the dish the model identified, overlaid on my submitted photo,
**so that** I can confirm the estimate matches what I actually photographed.

### ACs

- **AC2.1 (happy path):** Given a successful estimate (`calorieResult.status === "estimated"`) and
  a valid, non-empty `foodName` within the configured maximum length, when the Result screen
  renders, then a food-name pill is visible, overlaid bottom-left on the photo thumbnail, and its
  displayed text equals `foodName` exactly (no truncation-with-ellipsis, no added decoration).
- **AC2.2 (edge — no name identified):** Given a successful estimate where `foodName` is `null`,
  missing, or an empty/whitespace-only string, when the Result screen renders, then the pill
  element is not rendered at all (no empty pill, no placeholder text like "Unknown dish") — matches
  the `00-feature.md` requirement "omitted if null/empty (no placeholder/fallback text)".
- **AC2.3 (negative — untrusted text length bound):** Given `foodName` exceeds the configured
  maximum length (a named constant, analogous to the existing `MIN/MAX_PLAUSIBLE_CALORIES` pattern
  in `vision.js`; exact number finalized by engineering/threat-model per `00-feature.md`), when the
  Result screen renders, then the pill is omitted entirely — the string is never truncated and
  displayed, since silently rewriting untrusted model text is treated the same as fabricating it
  (consistent with the existing R15 "never clamp, fail closed" precedent for calories).
- **AC2.4 (negative — render path, XSS):** Given any value of `foodName` (including one containing
  `<`, `>`, `&`, or HTML-looking substrings), when the pill is rendered, then the text reaches the
  DOM via `element.textContent` only — never `innerHTML`, never `insertAdjacentHTML`, never a
  template-literal assignment to `.innerHTML` — verified by code inspection (ties to the
  XSS-audit AC in `00-feature.md`).
- **AC2.5 (edge — no estimate at all):** Given `calorieResult.status` is `"no_food"` or
  `"unavailable"` (the error screen), when the Result screen renders, then no food-name pill is
  shown under any circumstances, even if the raw API response happened to include a `foodName` —
  fail-closed on the calorie number means the whole result is untrusted, not just the number.

---

## Story 3 — "Items seen" stat tile

**As a** user reviewing my result,
**I want** the left stat tile to show how many food items the model saw,
**so that** I get a sense of what was on the plate, not just a placeholder dash.

### ACs

- **AC3.1 (happy path):** Given a successful estimate with a valid `itemsCount` (non-negative
  integer within the configured plausibility bound), when the Result screen renders, then the left
  stat tile's value shows the integer (e.g. `3`) and its label remains "items seen" (unchanged
  copy/position from 003).
- **AC3.2 (negative — invalid/out-of-range):** Given `itemsCount` is missing, `null`, negative,
  not an integer, or exceeds the configured plausibility bound (an explicit upper bound, analogous
  to the existing calorie plausibility band, to catch a hallucinated/injected absurd count), when
  the Result screen renders, then the tile shows the same neutral `"—"` it shows today — never `0`,
  never a clamped/rewritten number.
- **AC3.3 (regression — tile always present):** Given any Result-screen state that already renders
  today (estimating/done/error), when this feature ships, then the stat-tiles row's structure,
  spacing, and "items seen" label are unchanged from 003 — only the tile's value content changes
  based on data availability.

---

## Story 4 — Confidence stat tile

**As a** user reviewing my result,
**I want** the right stat tile to show how confident the model was in its identification,
**so that** I can judge how much to trust the estimate.

### ACs

- **AC4.1 (happy path):** Given a successful estimate with `confidence` exactly equal to `"low"`,
  `"medium"`, or `"high"`, when the Result screen renders, then the right stat tile displays that
  level (visual treatment — text/badge/dot — is ux-design's call per `00-feature.md`, not
  prescribed here) and its label remains "confidence".
- **AC4.2 (negative — off-enum/missing):** Given `confidence` is missing, `null`, an empty string,
  or any value other than exactly `"low" | "medium" | "high"` (wrong case, a synonym, free text,
  a number), when the Result screen renders, then the tile shows the existing neutral `"—"` state —
  never a best-guess default (e.g. never silently defaulting to "medium").
- **AC4.3 (regression — tile always present):** Given any Result-screen state that already renders
  today, when this feature ships, then the stat-tiles row's structure and "confidence" label are
  unchanged from 003 — only the tile's value content changes.

---

## Story 5 — Untrusted model-text hardening (cross-cutting security)

**As a** maintainer of an app that has never before shown model-generated free text to users,
**I want** every new field to be validated against a strict, narrow contract before it ever reaches
the DOM,
**so that** `foodName` (the first free-text field this app has ever surfaced) cannot be used to
inject, deceive, or corrupt the page, and the other two new fields cannot be spoofed into showing
fabricated data.

### ACs

- **AC5.1 (length bound enforced, not just documented):** Given `foodName` of any length, when the
  value is processed before render, then there exists an enforced maximum length constant that
  rejects (per AC2.3 — omits, does not truncate) any string exceeding it; this must be a real
  runtime check, not merely a CSS `text-overflow: ellipsis` visual clip (a CSS clip still puts the
  full untrusted string in the DOM).
- **AC5.2 (render path, no formatting/emoji):** Given `foodName` contains emoji, markdown syntax
  (e.g. `**bold**`, `# heading`), or control characters, when it is rendered, then it appears as
  literal plain text via `textContent` (no markdown parsing, no emoji-specific handling/stripping
  required beyond treating it as an opaque string) — ties to `00-feature.md`'s "no emoji injection,
  no user-facing markdown/formatting" line, satisfied by the textContent-only rule (AC2.4) plus the
  length bound (AC5.1); no separate sanitizer is introduced.
- **AC5.3 (confidence is a closed enum, not free text):** Given the structured-output schema for
  `confidence`, when the schema is authored, then it constrains the model to a fixed enumeration at
  the API level (mirroring how `food_identified` is already constrained to boolean) — this is a
  defense-in-depth requirement in addition to, not instead of, the client-side check in AC4.2.
- **AC5.4 (itemsCount is a bounded non-negative integer):** Given the structured-output schema for
  `itemsCount`, when the schema is authored, then it constrains the model to an integer type, and
  the extraction code (mirroring the existing `Number.isInteger` + sign + plausibility-band checks
  already applied to `calories`) rejects negative, non-integer, or absurdly large values before
  they ever reach the DOM.
- **AC5.5 (negative — hostile content in a validated field):** Given a `foodName` value that passes
  the length bound but consists entirely of hostile-looking content (e.g. a long run of zero-width
  characters, or a string crafted to look like a UI element, such as `"Estimate calories ▶ tap
  here"`), when it is rendered via `textContent`, then it displays as inert text with no executable
  or interactive effect — no new AC needed beyond "textContent only" (AC2.4), but this case is
  called out explicitly so QA/threat-model treat it as a required test, not an afterthought.

---

## Story 6 — Regression: existing calorie-only path keeps working

**As an** existing user of the app (or the existing 001/002/003 test suites),
**I want** the calorie-only flow to behave exactly as it did before 007,
**so that** adding three new optional fields never breaks, slows, or changes the behaviour of the
core "photo in, calorie number out" job.

### ACs

- **AC6.1 (regression — old-shaped success response):** Given a `calorieResult` with
  `status: "estimated"` and a valid `calories` integer but no `foodName`/`confidence`/`itemsCount`
  keys present at all (e.g. simulating a pre-007 response shape), when the Result screen renders,
  then the hero number renders exactly as it does today, the food-name pill is omitted, and both
  stat tiles show `"—"` — the calorie number's display path has zero dependency on the new fields
  being present.
- **AC6.2 (regression — error paths untouched):** Given `calorieResult.status` is `"no_food"` or
  `"unavailable"`, when the Result screen renders, then the existing error copy, "Try again"
  affordance, and absence of any number are all unchanged from 003 (see also AC2.5 — no new field
  ever leaks into an error state).
- **AC6.3 (regression — full existing suite green):** Given the 001/002/003 test suites
  (`tests/upload.test.js`, `tests/vision.test.js`, `tests/rate-limit.test.js`,
  `tests/strip-metadata.test.js`), when this feature's code lands, then all of those tests continue
  to pass unmodified in their assertions about existing behaviour — the manifest explicitly notes
  `tests/upload.test.js` currently asserts NONE of the 007 demo values appear; that specific
  negative assertion is expected to be revised by engineering as part of implementing this feature
  (it was always scoped as "until 007 wires these fields"), but no other existing assertion should
  need to change.
- **AC6.4 (regression — contract additive only):** Given the `POST /upload` success response shape
  documented in the manifest (`{ok, size, type, calorieResult}`), when this feature ships, then
  `calorieResult` gains the three new optional fields (nested inside it, alongside `calories`) but
  `ok`, `size`, and `type` are byte-for-byte unchanged, and no existing required field becomes
  optional or changes type.
- **AC6.5 (regression — preserved cross-cutting behaviour):** Given the manifest's existing
  guarantees (JPEG/PNG-only allowlist, server-side EXIF/GPS metadata strip before egress, per-IP
  rate limit + concurrency cap, the data-egress privacy notice copy on the Pick screen), when this
  feature ships, then every one of these is unchanged — 007 touches only the structured-output
  schema and the Result-screen rendering of three previously-neutral fields.
