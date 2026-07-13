# 002 — Calorie estimate

**Pulled from:** roadmap row 002

**Request (roadmap one-liner):** Send the uploaded photo to a vision model and show an estimated calorie count.

**Why:** This is the core value-add that makes Calories useful. Feature 001 proved the upload path works; now we plug in the vision model to extract an estimate. This is the minimal slice that turns "a server that accepts images" into "a tool that tells you how many calories are in your meal."

## Scope (this feature)

This feature adds the vision-model integration to the existing Node service.

- Browser sends a photo to the Node server (using the upload path from 001).
- The Node server forwards that photo to a vision model API.
- The vision model returns a calorie estimate.
- The server returns the estimate to the browser.
- The browser displays the calorie count to the user.

That's the whole slice: **receive upload → call vision model → return estimate → display.**

## Explicitly deferred (LATER features)

- **Food identification** (003): naming the detected dish and a confidence badge — out of scope here.
- **Portion adjustment** (004): scaling the estimate by portion — out of scope here.
- **Camera & drag-drop** (005): alternate upload methods — out of scope here.
- **Shareable card** (006): downloadable result card — out of scope here.

## Notes / alignment

- Depends on 001 (upload path) being delivered; 001 is already done.
- Aligns with ADR-001 (manifest): the vision-model API key stays server-side only in this service; no client-side exposure.
- No conflict with PROJECT.md non-goals (no accounts, no history, no full nutrition breakdown are touched here).
