# 002 — Calorie estimate · Stories & Acceptance Criteria

**Builds ON:** the delivered 001 upload path — `POST /upload` (ADR-002 raw-binary transport: image bytes
as the request body, MIME in `Content-Type`), which already returns `200 { ok, size, type }` on success
and defined `400/413/415/404` errors on bad input (see `.factory/manifest.md`). This feature does NOT
respec that endpoint's existing contract; it adds a vision-model call in front of the response the
browser receives, and (per the manifest's noted hard pre-condition) tightens the MIME check the route
uses before any upload is forwarded to a model.

**AI Eval Card (required — this feature calls a vision model):**
- **Confidence threshold:** the server only treats a vision-model response as usable if it contains a
  single, parseable numeric calorie value. Anything else (missing number, non-numeric text, multiple
  conflicting numbers with no clear primary value) is treated as "no usable estimate," not displayed to
  the user. (A user-facing confidence *badge* is out of scope — that's feature 003.)
- **Refusal trigger:** the vision model explicitly declines/cannot identify food in the image, OR returns
  a response that fails the confidence threshold above.
- **Latency ceiling:** the server enforces a maximum wait for the vision-model call. If the call has not
  returned a usable estimate by that ceiling, the request is treated as failed (timeout).
- **Fail-closed fallback:** on refusal, timeout, or any vision-model/network error, the browser shows a
  clear "couldn't estimate" message and displays **no** calorie number — never a fabricated, default, or
  placeholder value.

---

## Story 1 — Get a calorie estimate for an uploaded photo

> As someone using Calories, I want to upload a food photo and get a calorie estimate back, so that I
> know roughly how many calories are in my meal without an account, a history log, or a full nutrition
> breakdown.

**INVEST check:** Independent (extends the existing upload route only) · Negotiable (exact wording of
the displayed number/message is loose) · Valuable (this is the feature's whole reason to exist per
PROJECT.md) · Estimable (one added server-side call + one added UI render path) · Small (call model,
return number, display number — no naming, no confidence badge, no portion math) · Testable (both ACs
below are binary).

### Acceptance criteria

**AC1.1 — Valid photo produces a displayed calorie estimate (happy path)**
- **Given** the app is running and I have a valid food photo selected in the browser,
- **When** I send it via the existing upload flow and the server's call to the vision model returns a
  usable estimate (per the AI Eval Card's confidence threshold) within the latency ceiling,
- **Then** the browser displays a single calorie number to me (e.g. "~450 calories") and does NOT show
  the plain "file received" confirmation from 001 in its place.

**AC1.2 — Vision-model failure shows a clear error, never a fake number (error path)**
- **Given** the app is running and I have uploaded a valid photo,
- **When** the vision-model call fails to produce a usable estimate (network/API error, timeout past the
  latency ceiling, or an unparseable/non-numeric response),
- **Then** the browser shows a clear "couldn't estimate calories, try again" message and displays **no**
  calorie number (fail-closed fallback from the AI Eval Card).

---

## Story 2 — Only supported image types reach the vision model

> As the person running Calories, I want the server to check an uploaded file against a strict
> raster-image allowlist before spending a vision-model call on it, so that ambiguous or unsupported file
> types (e.g. SVG) never get forwarded, per the hard pre-condition the manifest already flags for this
> route.

**INVEST check:** Independent (a validation step ahead of the model call, on the same endpoint) ·
Negotiable (exact allowlist membership beyond JPEG/PNG is loose) · Valuable (closes a known gap — R3/M1/M2
in the manifest — before it becomes a live model-cost/ambiguity problem) · Estimable (one added check) ·
Small (accept/reject branch only) · Testable (both ACs below are binary).

### Acceptance criteria

**AC2.1 — Supported raster image is forwarded (happy path)**
- **Given** a valid JPEG or PNG photo uploaded via `POST /upload`,
- **When** the server checks its `Content-Type` against the supported raster-image allowlist,
- **Then** the server forwards it to the vision model to obtain a calorie estimate.

**AC2.2 — Unsupported/ambiguous image type is rejected before reaching the model (error path)**
- **Given** an uploaded file whose `Content-Type` starts with `image/` but is NOT on the supported
  raster-image allowlist (e.g. `image/svg+xml`, or another non-raster/degenerate `image/` subtype),
- **When** the server evaluates it,
- **Then** the server rejects the request with a defined client error and does **NOT** forward it to the
  vision model, AND the browser shows a clear "unsupported file type" message (not a calorie number, not
  a silent failure).

---

## Story 3 — A photo with no recognizable meal doesn't produce a misleading number

> As a user, when my photo doesn't clearly show a meal, I want a clear message instead of a random-looking
> calorie count, so that I'm never misled into trusting a number the system didn't actually derive from
> food in my photo.

**INVEST check:** Independent (a specific, testable branch of the same vision-model call) · Negotiable
(exact wording of the message is loose) · Valuable (protects user trust in the single number this app
exists to produce) · Estimable (one more branch on the AI Eval Card's refusal trigger) · Small (message
only, no retry/queue logic) · Testable (both ACs below are binary).

### Acceptance criteria

**AC3.1 — Non-food / unidentifiable photo triggers the refusal path (edge/error path)**
- **Given** a photo is uploaded that does not show a recognizable meal/food (or the vision model
  explicitly indicates it cannot identify food in the image),
- **When** the server receives that response from the vision model,
- **Then** the browser displays a "couldn't identify a meal in this photo" message and shows **no**
  calorie number.

**AC3.2 — Repeat uploads are independent, not cached or cross-served (edge path)**
- **Given** I upload the same photo twice, in two separate requests,
- **When** each request is processed by the server,
- **Then** each response comes from its own independent vision-model call for that request — the second
  request's result is never served from a stored/cached copy of the first (consistent with "no
  persistence" — the manifest's data model states uploads are not retained beyond the request).

---

## Notes for the builder

- These ACs extend, not replace, 001's `POST /upload` success/error contract — a request that fails 001's
  existing validation (no file, oversized, empty body, unknown route) still gets those existing responses;
  the vision-model call only happens for requests that already pass that base contract AND the Story 2
  raster-allowlist check.
- The exact wording of user-facing messages ("couldn't estimate...", "unsupported file type...", "couldn't
  identify a meal...") is the builder's choice; the AC is satisfied by any clear, distinct message that a
  human can tell apart from a successful numeric estimate.
- The specific latency ceiling value, the exact allowlist membership beyond JPEG/PNG, and the exact
  vision-model provider/call shape are implementation choices for the architecture/engineering steps, not
  fixed here.
