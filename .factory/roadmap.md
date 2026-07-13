# Roadmap — upcoming features (the board)

> The queue of features you pick from to start a pipeline run. Intent, not commitment — reorder freely.
> To start one: say **"pick &lt;ID&gt;"** or run **`/factory-run &lt;ID&gt;`**. Kickoff opens the feature.
> A feature travels: here (queued) → in progress → delivered (moves to `manifest.md`).

| ID  | Feature | One-liner | Size | Status | Blocked by |
|-----|---------|-----------|------|--------|-----------|
| 001 | Initial prototype | Upload a picture of food. | S | delivered | — |
| 002 | Calorie estimate | Send the uploaded photo to a vision model and show an estimated calorie count. | M | delivered | 001 |
| 003 | Redesign | Full UI rebuild — a new layout & visual design for the upload + estimate experience (design assets to be supplied). | M | delivered | 002 |
| 004 | Portion adjuster | Scale the calorie estimate by portion (½× / 1× / 2× or a slider) — recomputed in the browser. | S | queued | 002 |
| 005 | Camera & drag-drop | Snap a photo from the device camera or drag-and-drop an image onto the page to upload. | S | queued | 001 |
| 006 | Shareable calorie card | Render a downloadable result card (the photo + its calorie estimate) to save or share. | M | queued | 002 |
| 007 | Food ID + confidence | Name the detected dish and show a low/med/high confidence badge next to the estimate. | S | in progress | 002 |
| 008 | Browser E2E + estimate timeout | Add a Playwright browser-E2E tier for the client-side state machine, and implement the client-side estimate timeout (review F1, deferred from 003). | M | queued | 003 |

## GitHub Issues (mirror — see `.factory/github.md`)
Repo: `olegsaveliev/calories` · main is **protected** (PR + green CI to merge).

| Feature | Issue |
|---------|-------|
| 001 Initial prototype | [#1](https://github.com/olegsaveliev/calories/issues/1) |
| 002 Calorie estimate | [#4](https://github.com/olegsaveliev/calories/issues/4) |
| 003 Redesign | [#8](https://github.com/olegsaveliev/calories/issues/8) |
| 008 Browser E2E + estimate timeout | [#10](https://github.com/olegsaveliev/calories/issues/10) |

## Parked (needs a decision first)
_Ideas that conflict with `PROJECT.md` non-goals, or need a call before queuing._

<!-- Status values: queued · in progress · delivered.
     Kickoff flips queued→in progress. Delivery/Wrap flips in progress→delivered (+ adds to manifest.md). -->
