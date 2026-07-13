# 007 — Food ID + confidence: PRD

## Summary

Feature 003 rebuilt the Result screen around three fields the "Midnight Lime" design mock
specifies but the redesign deliberately left neutral — an overlaid food-name pill on the photo
thumbnail, and two stat tiles labeled "items seen" and "confidence" that today render a literal
`"—"` — because at the time the vision-model call (feature 002) only returned
`{food_identified, calories}` and nothing was available to show honestly. Feature 007 closes that
gap by expanding the structured-output schema on the SAME existing `claude-sonnet-5` call (no
second model round-trip, no new model tier, no new dependency) to additionally return a dish name
(`foodName`), a discrete confidence level (`confidence`, one of low/medium/high), and an item count
(`itemsCount`), then wires all three into the Result screen exactly where 003's design already
reserved space for them. Because `foodName` is the first piece of model-generated free text this
app has ever surfaced to a user, it is treated as untrusted end to end: length-bounded, rendered
via `textContent` only (never `innerHTML`), and omitted entirely — never truncated or defaulted —
when it is absent, empty, or over-length. The same fail-closed discipline already governing the
calorie number is extended, but per-field: the calorie estimate still renders on its own merits
even if one of the three new fields is missing or invalid, in which case that individual field
degrades to a neutral state (pill omitted, tile shows `"—"`) rather than showing a fabricated or
default value, and none of the three new fields is ever shown when the estimate itself fails
closed (`no_food`/`unavailable`). Every existing 002/003 guarantee — the `POST /upload` contract,
server-side EXIF/GPS metadata stripping, the JPEG/PNG-only allowlist, the data-egress privacy
notice, and the rate-limit/concurrency guards — is preserved unchanged; this is purely an additive
schema expansion plus a Result-screen wiring change, in vanilla HTML/CSS/JS per ADR-001.

## Out of scope

- **The "± NN" calorie range** shown under the total in the design mock — still omitted from the
  Result screen; not part of this feature (explicit carry-forward from 003).
- **Portion adjuster** (feature 004).
- **Camera capture / drag-and-drop upload** (feature 005) — beyond the drag-and-drop already
  shipped in 003's dropzone.
- **Shareable result card** (feature 006).
- **A second/independent model call** for food ID — this feature reuses the single existing vision
  call; it does not add a dedicated food-identification API request.
- **A new or different vision-model tier** — `claude-sonnet-5` stays the human-picked tier from
  002; no cost re-baseline is in scope here.
- **User accounts, meal history, or full nutrition breakdown** (protein/fat/carbs) — unchanged
  PROJECT.md non-goals; `foodName`/`confidence`/`itemsCount` are single-estimate, non-persisted
  fields like everything else in this app.
- **A general-purpose text sanitizer/markdown renderer** for model output — the untrusted-text
  posture here is satisfied by a length bound + `textContent`-only rendering (Story 5), not by
  introducing a sanitization library or markdown support.
- **Retrying or re-querying the model** if only a secondary field (name/confidence/count) is
  missing/invalid while the calorie estimate itself succeeded — the spec calls for graceful
  per-field degradation, not an automatic retry.
- **Choosing the exact numeric bounds** (max `foodName` length, max plausible `itemsCount`) — per
  `00-feature.md` these are explicitly "TBD by engineering, per threat-model"; this PRD specifies
  the required *behaviour* at each bound (reject/omit, never truncate or clamp) and leaves the
  precise constants to the architecture/engineering/threat-model steps that follow.
- **Visual design of the confidence badge** (text vs. color-coded dot vs. both) — explicitly
  ux-design's call per `00-feature.md`, not decided here.
