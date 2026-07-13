# 002 — Calorie estimate · PRD

**Summary (one paragraph).** Feature 002 plugs a vision model into the existing Calories upload path
(`POST /upload`, ADR-002 raw-binary transport, delivered in 001) to turn "a server that accepts images"
into "a tool that tells you how many calories are in your meal": the browser sends the user's food photo
through the same upload flow, the Node server (owning the model call server-side, per ADR-001, so the API
key never touches client code) forwards the image to a vision model, and — if the model returns a usable
numeric estimate within a defined latency ceiling — the browser displays a single calorie number in place
of the plain "file received" confirmation. Per the manifest's already-flagged hard pre-condition for this
route, the server also tightens the upload check to an explicit raster-image allowlist (rejecting
ambiguous types like `image/svg+xml` before they reach the model) and treats vision-model refusal, timeout,
non-numeric response, or an unidentifiable/non-food photo as a fail-closed case: a clear message, never a
fabricated or placeholder calorie number. This is the minimal slice PROJECT.md calls for — a picture in, a
single calorie number out — with no naming of the dish, no confidence badge, no portion scaling, and no
persistence of the photo or the estimate.

## Out of scope (explicitly deferred)

- **Food identification + confidence badge** (roadmap 003) — naming the detected dish and showing a
  confidence indicator to the user. Not built here; this feature's confidence threshold is an internal
  fail-closed check only, never surfaced to the user as a badge/score.
- **Portion adjustment** (roadmap 004) — scaling the estimate by portion size. Not built here.
- **Camera capture & drag-and-drop upload** (roadmap 005) — alternate ways to get a photo into the app.
  Not built here; the existing file-picker upload flow from 001 is the only path this feature uses.
- **Shareable result card** (roadmap 006) — a downloadable/shareable card of the result. Not built here.
- **User accounts / login** — none (PROJECT.md non-goal).
- **Meal history / long-term tracking** — none (PROJECT.md non-goal); no estimate or photo is persisted
  beyond the single request (Story 3, AC3.2).
- **Full nutrition breakdown** (protein/fat/carbs) — none (PROJECT.md non-goal); a single calorie number
  is the whole job.
- **Retry/queueing logic, rate limiting, or multi-photo batching** — a single photo in, a single estimate
  (or a single clear failure message) out; no retry orchestration is specified here.
- **The exact vision-model provider, prompt, latency-ceiling value, and full raster-MIME allowlist
  membership** — these are architecture/engineering decisions, not fixed by this spec.
