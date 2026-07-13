# 002 — Calorie estimate · Status

**Status: DELIVERED** (2026-07-13) · v0.2.0 · PR #5, branch `feature/002-calorie-estimate`.

## What shipped

Photo → server-side Anthropic vision call (`claude-sonnet-5`, human-picked from `30-options.md`) →
structured `{ food_identified, calories }` → UI renders "~N calories" or a distinct fail-closed message
("couldn't estimate", "couldn't identify a meal", "unsupported file type"). Zero new runtime
dependencies (ADR-001 upheld — built-in `fetch`, no `@anthropic-ai/sdk`); `ANTHROPIC_API_KEY` is
env-only, never logged, never client-side; the browser→server raw-binary transport is unchanged
(ADR-002). New modules: `src/vision.js`, `src/rate-limit.js`, `src/strip-metadata.js`.

## SCOPE CHANGE (human-accepted): supported image types narrowed

The design's original allowlist (`jpeg/png/gif/webp`) narrowed to **JPEG + PNG only**. GIF and WebP now
return **415**, because they can't be metadata-stripped dependency-free (see R10 below). This is
reflected in the manifest's `POST /upload` contract and known limitations.

## Security fixes that landed (threat-model gate)

- **R9** — per-IP cap (10/min) + global in-flight concurrency cap (2), both checked before the paid
  model call; over-limit returns 429, no `calorieResult`.
- **R10** — EXIF/GPS stripped from the image before it egresses to Anthropic, plus a UI notice that the
  photo is sent to Anthropic's model. **Only partially closed — see known limitations.**
- **R12** — `.env` / `.env.*` added to `.gitignore` (was missing; the key is now structurally
  un-committable via the obvious local-dev path).
- **R15** — a 1–5000 kcal plausibility band on the model's returned integer; out-of-band values fail
  closed ("couldn't estimate"), never clamped to the boundary (clamping would be fabricating a number).

## Verified good (review-2, adversarial probing incl. 40k fuzzed inputs)

R15 is fully correct — no out-of-band, non-integer, or negative value can reach the DOM. Client IP is
read from the raw socket (`req.socket.remoteAddress`), not a spoofable header. Both the JPEG and PNG
metadata parsers are crash-proof under fuzzing and truncation (0 throws across 40k random buffers + every
truncation prefix of a valid file). No API key/secret leak anywhere, including error paths. No model free
text ever reaches the DOM (`textContent` only).

## Known limitations — left open, all human-accepted at the review/threat gates

These fold under the **existing hard gate** ("must resolve before any exposure beyond localhost"),
alongside carried-forward R1/R2:

- **R10 only PARTIALLY closed (review-2 finding F1, major).** The primary JPEG/PNG segment is correctly
  stripped of EXIF/GPS (the common case), but data appended after the first JPEG's EOI marker — Motion
  Photos, MPF, Live Photo exports, or any "payload after EOI" trick — still egresses with GPS intact.
  Confirmed by execution (a synthetic secondary-JPEG-after-EOI fixture leaked its embedded GPS needle).
- **Rate-limit fairness bug (review-2 F2, major).** The per-IP window is charged before the global
  in-flight check and is not refunded on a concurrency denial. Two attackers holding both in-flight slots
  can lock out honest users (429, reason: rate) after zero model calls were ever made for those users.
- **F3/F4 (minor).** The "can't smuggle data out" guarantee is not fully true: PNG keeps any unknown
  chunk whose type byte is uppercase ("critical"), not just the four true critical types; JPEG uses a
  denylist (drop APPn+COM) rather than a keep-list, so an unrecognized non-APPn marker would survive.
  Both are self-targeting today (the uploader controls their own image) but the module's own "cannot
  smuggle data out" claim is not literally true.
- **F5 (minor).** The per-IP rate-limit `Map` is never evicted — unbounded memory growth over many
  distinct source IPs (the same resource-exhaustion class as R1).
- **F6 (minor).** Fixed-window rate limiting allows ~2x the nominal rate briefly across a window
  boundary (10 calls at t=59.99s + 10 at t=60.00s = 20 in ~10ms).
- **UI copy (cosmetic).** `index.html` still has `accept="image/*"` on the file input and doesn't state
  the JPEG/PNG-only limit up front — a user can pick a GIF/WebP/HEIC and only discovers it's unsupported
  via the 415 response.
- **R1/R2 carried forward, now MORE ACUTE** — each in-flight request holds the image buffer + its
  base64 copy + serialized JSON for the whole multi-second API round-trip (~3x the image size, up to
  30s), vs. milliseconds in 001. Still must resolve (aggregate memory cap + inbound request timeouts)
  before any exposure beyond localhost.
- **R3/M1/M2 — CLOSED** on this route by the raster-MIME allowlist (SVG and degenerate `image/*`
  subtypes now 415 before any body read or model call).

## AI adoption / runtime AI cost

Used as intended: every accepted upload makes exactly one `claude-sonnet-5` vision call with structured
outputs, no persistence, no caching (AC3.2 verified independent per request). No usage/gateway log exists
in this prototype to report actual runtime spend from; per-call estimate from `30-options.md` is
**~$0.006–0.01/estimate** (image-token dominated). Recommend adding basic call/cost logging (also flagged
as risk R7 in the threat model) before relying on this estimate for budgeting.

## Note for the team

The dev `ANTHROPIC_API_KEY` hit "credit balance too low" during live verification (documented in
`50-build-notes.md`). The happy-path "~N calories" render is covered by tests (Anthropic API mocked) and
was verified live once earlier in the build with a synthetic image, but the full happy-path was **not**
re-demoed live end-to-end after the credit ran out. This is not a code defect — top up the key's balance
before a live demo.

## Tests

70 passing (was 37 before this feature; up from the 3 in 001). CI green on PR #5. New suites:
`tests/vision.test.js`, `tests/rate-limit.test.js`, `tests/strip-metadata.test.js`,
`tests/image-fixtures.js`; extended `tests/upload.test.js`.

## Follow-ups worth queuing (not roadmap edits — flagging for the human/orchestrator)

- Full R10 fix (walk past JPEG EOI / properly bound PNG critical-chunk handling) or an ADR to adopt an
  image-processing dependency, then restore GIF/WebP support.
- Fix the rate-limit fairness bug (don't debit the per-IP window on a concurrency denial) and add Map
  eviction (F5) and a sliding window or token bucket (F6).
- All of the above are prerequisites the manifest already gates before any exposure beyond localhost —
  none block continued localhost-only iteration on features 003–006.
