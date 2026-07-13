# 001 — Initial prototype · PRD

**Summary (one paragraph).** Feature 001 stands up the Calories Node service for the first time and
proves the core upload path end-to-end: the browser presents a file picker that accepts a food photo,
sends the selected image to a single Node HTTP upload endpoint, and the server receives it and confirms
receipt back to the browser (HTTP 200 with a JSON body that echoes basic file info — size in bytes and
content type). The endpoint also defines predictable behaviour for bad input, rejecting with a defined
JSON error when no file is selected, when the file is not an image, when it exceeds the 10 MB size limit,
or when it is empty (zero bytes). This is the plumbing that later features (the calorie/vision-model
estimation) will plug into; it aligns with ADR-001 (one Node service that will own the only model route,
with the model key server-side — that route is not built here). There is **no AI/model in this feature's
scope**, so no AI Eval Card is required.

## Out of scope (explicitly deferred)

- **Calorie / vision-model estimation** — sending the received image to a vision model and returning a
  calorie number. Deferred to a later roadmap feature.
- **Persistence / database** — the received image is confirmed, not stored beyond the request.
- **User accounts / login** — none (matches PROJECT.md non-goals).
- **Meal history / long-term tracking** — none (matches PROJECT.md non-goals).
- **Full nutrition breakdown** (protein/fat/carbs) — none (matches PROJECT.md non-goals).
- **The model API route itself** — added in a later feature per ADR-001; not built now.
