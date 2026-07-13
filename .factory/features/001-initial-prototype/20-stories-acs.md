# 001 — Initial prototype · Stories & Acceptance Criteria

**Builds ON:** the starter scaffold only (`src/index.html`, `src/calories.js`). No feature exists yet
per `.factory/manifest.md`. This feature stands up the Node service for the first time and creates the
single upload endpoint (aligned with ADR-001: one Node service, model key server-side — that route is
NOT built here).

**AI Eval Card:** N/A — no AI/model is in scope for this feature. The vision-model call is explicitly
deferred to a later feature, so no confidence threshold / refusal / latency / fallback card is needed.

---

## Story 1 — Pick a food photo and send it to the server

> As someone trying Calories, I want to pick a food photo in the browser and send it to the service,
> so that the plumbing that later features (calorie estimation) will plug into is proven to work.

**INVEST check:** Independent (only needs the scaffold) · Negotiable (UI wording is loose) · Valuable
(proves the end-to-end upload path) · Estimable (one endpoint + one form) · Small (upload → receive →
confirm, no model) · Testable (all ACs below are binary).

### Acceptance criteria

**AC1.1 — Page exposes a file picker (happy path setup)**
- **Given** the app is running and I open the app URL in a browser,
- **When** the page loads,
- **Then** a visible file input that accepts image files AND a control to send the selected photo are
  present in the DOM.

**AC1.2 — Valid image upload is received and confirmed (happy path)**
- **Given** the app is running,
- **When** a valid, non-empty image file (e.g. JPEG or PNG) is POSTed to the upload endpoint,
- **Then** the server responds with HTTP 200 and a JSON body indicating success (a success flag/status)
  that includes the received file's size in bytes AND its content type (MIME type).

**AC1.3 — Browser shows the confirmation to the user**
- **Given** AC1.2 returned HTTP 200 with the success body,
- **When** the browser receives that response,
- **Then** the page displays a visible confirmation message to the user that the photo was received
  (the page does NOT remain in its pre-upload state with no feedback).

---

## Story 2 — Reject bad uploads with a clear, defined response

> As the person running Calories, I want the server to reject invalid uploads with a defined error,
> so that the endpoint behaves predictably instead of crashing or silently accepting garbage.

**INVEST check:** Independent (same endpoint as Story 1) · Negotiable (exact size limit / wording is
loose) · Valuable (defines negative behaviour so the path is trustworthy) · Estimable (validation
branches on one endpoint) · Small (four defined rejections, no model) · Testable (each AC is a
specific status + body assertion).

> **Spec constant — max file size:** the endpoint MUST enforce a maximum upload size. **Set the limit
> at 10 MB** (10 × 1024 × 1024 = 10,485,760 bytes). "Oversized" below means strictly greater than this.

### Acceptance criteria

**AC2.1 — No file selected (empty request)**
- **Given** the app is running,
- **When** the upload endpoint is called with no file part / no file selected,
- **Then** the server responds with HTTP 400 and a JSON body containing an error message indicating no
  file was provided, AND does NOT respond with 200.

**AC2.2 — Non-image file rejected**
- **Given** the app is running,
- **When** a file whose content type is not an image (e.g. a `.txt` / `text/plain`, or `application/pdf`)
  is POSTed to the upload endpoint,
- **Then** the server responds with HTTP 400 (or 415) and a JSON body containing an error message
  indicating the file must be an image, AND does NOT respond with 200.

**AC2.3 — Oversized file rejected**
- **Given** the app is running and the max size is 10 MB,
- **When** an image file strictly larger than 10,485,760 bytes is POSTed to the upload endpoint,
- **Then** the server responds with HTTP 413 (or 400) and a JSON body containing an error message
  indicating the file is too large, AND does NOT respond with 200.

**AC2.4 — Empty (zero-byte) file rejected**
- **Given** the app is running,
- **When** a file with size 0 bytes is POSTed to the upload endpoint,
- **Then** the server responds with HTTP 400 and a JSON body containing an error message indicating the
  file is empty, AND does NOT respond with 200.

**AC2.5 — No secret in client (ADR-001 guard)**
- **Given** the delivered feature,
- **When** the client-side files served to the browser are inspected,
- **Then** no vision-model API key or other secret is present in client code (the model route is not
  built in this feature, so there is nothing model-side to expose).

---

## Notes for the builder

- All error responses in Story 2 must be JSON with a machine-checkable shape (e.g. `{ "error": "..." }`),
  so each AC is objectively yes/no.
- The success response (AC1.2) must include both `size` (bytes) and `type` (MIME) of the received file
  so "confirms receipt with basic file info" is verifiable, not just a bare 200.
- The specific HTTP status codes offered as alternatives (e.g. 400 vs 415, 413 vs 400) are the builder's
  choice; the AC is satisfied by any of the listed codes plus the required JSON error body.
