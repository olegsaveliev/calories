# 001 — Initial prototype

**Pulled from:** roadmap row 001

**Request (roadmap one-liner):** Upload a picture of food.

**Why:** This is the first end-to-end slice of Calories — it proves the core plumbing
that every later feature depends on: a browser can pick a food photo and hand it to the
Node service, and the server actually receives it. Without this path working, there is
nowhere for the calorie/vision estimation to plug in later.

## Scope (this feature)

This feature is **NOT client-only** — it stands up the Node server.

- Browser lets the user pick a food photo.
- Browser sends that photo to a Node endpoint.
- The Node server receives the photo and confirms receipt back to the browser.

That's the whole slice: **upload → server receives → confirms.**

## Explicitly deferred (a LATER feature)

- The calorie estimate / vision-model call. Sending the received image to the vision
  model and returning a calorie number is **out of scope here** and belongs to a
  subsequent roadmap feature.

## Notes / alignment

- Aligns with ADR-001 (manifest): Calories is ONE Node service that serves the frontend
  and will own the only vision-model API route. This feature builds that single service
  and the upload path; the model API route is added later.
- No conflict with PROJECT.md non-goals (no accounts, no history, no full nutrition
  breakdown are touched here).
