# 002 — Calorie estimate · Design (approach note)

**Status:** SETTLED — the one fork (vision-model tier) was decided by the human on 2026-07-13:
**`claude-sonnet-5`** (see "Open decision" below + `30-options.md`). **No new ADR** (all choices here are
reversible — see the bottom).

## Approach in one paragraph

Add the vision call *inside* the existing `POST /upload` handler, after 001's base validation and the new
raster-allowlist check pass. The handler already holds the image as a raw `Buffer` + normalised MIME
(ADR-002); base64-encode that buffer and send it to the Anthropic Messages API as a single vision request
that asks for a structured `{ food_identified, calories }` result. If the model returns a usable numeric
estimate within a client-side latency ceiling, the browser renders "~N calories"; refusal / timeout /
non-numeric / network error / `food_identified:false` all collapse to the same **fail-closed** "couldn't
estimate" message with no number. No persistence — the buffer and the estimate are discarded when the
request ends (AC3.2 falls out for free: every request makes its own independent API call).

## ADRs that apply (reused, not re-decided)

- **ADR-001** — the vision call lives on the single Node service's one API route; the model API key stays
  server-side only, from an env var (`ANTHROPIC_API_KEY`), never sent to the client or logged. ADR-001
  explicitly anticipated "the single API route that calls the vision model," so this feature is what it
  was written for — no new ADR to *make* the call.
- **ADR-002** — the raw-binary upload already delivers a decode-free `Buffer` + `Content-Type`. We
  base64-encode that buffer for the JSON Messages request (unavoidable — the API takes base64/URL image
  sources, not raw bytes). This does **not** reopen ADR-002; the browser→server transport is unchanged.

## Settled build decisions

1. **How we call the API — built-in `fetch`, zero new runtime deps.** Node's global `fetch` (Node 18+)
   POSTs to `https://api.anthropic.com/v1/messages` with headers `x-api-key: <env>`,
   `anthropic-version: 2023-06-01`, `content-type: application/json`. **Not** the `@anthropic-ai/sdk` — that
   is a runtime dependency, which ADR-001 forbids without a superseding ADR, and the whole request is a
   dozen lines of JSON. This continues the existing zero-dep posture; it is not a new decision so much as
   *declining* to add a dep. (If a future feature needs the SDK's retry/streaming helpers, that is its own
   ADR.)

2. **Raster-MIME allowlist + SVG policy (manifest hard pre-condition — R3/M1/M2).** Replace the 001
   `startsWith("image/")` check with an explicit allowlist of the formats Claude vision actually accepts:
   **`image/jpeg`, `image/png`, `image/gif`, `image/webp`.** Anything else on `image/*` — including
   `image/svg+xml` and degenerate `image/` subtypes — is **rejected with `415` before any API call**
   (Story 2 / AC2.2). **SVG is rejected**, not rasterised: it is a non-raster/scriptable format the vision
   API can't consume anyway, and rasterising it server-side would need a dependency (violates ADR-001) and
   re-opens the exact ambiguity the manifest flagged. This closes R3/M1/M2 on this route. Check order stays:
   001 base contract (no-file 400 / oversize 413 / empty 400) → **new allowlist 415** → vision call.

3. **Getting a single parseable number — structured outputs.** Use `output_config.format` with a
   json_schema constraining the reply to `{ "food_identified": boolean, "calories": integer | null }`
   (all three candidate models support structured outputs). Map to the AI Eval Card:
   - `food_identified:false` **or** `calories:null` → refusal path (AC3.1) → "couldn't identify a meal".
   - a positive integer → the usable estimate (AC1.1) → "~N calories".
   - `stop_reason:"refusal"`, a parse failure, a non-integer, or any non-2xx/network error → fail-closed
     (AC1.2) → "couldn't estimate". **Treat the model output as untrusted** — only ever surface the
     integer, never free text the model produced.
   Keep the request cheap and fast: small system/user prompt, `max_tokens` ~256, **no extended thinking**
   (a single extraction — omit `thinking`; on Opus 4.8/Sonnet 5 that runs thinking-off), non-streaming.

4. **Latency ceiling — client-side abort.** Wrap the `fetch` in an `AbortController` with a fixed timeout
   (suggest **30 s**; the builder may tune). On abort → fail-closed timeout (AC1.2). This is the server's
   enforced maximum wait from the AI Eval Card.

5. **Fail-closed everywhere.** One helper returns either a validated integer or a typed failure; the route
   renders a number only for the former. No default/placeholder calorie value exists anywhere in the code
   path — the failure branch has no numeric field to leak.

6. **Response contract change (frontend).** On success the browser now renders the estimate string in place
   of 001's plain "file received" line (AC1.1). The distinct failure message is the builder's wording, as
   long as a human can tell it apart from a number (per the spec's builder notes). The qa skill's
   test-tier note (manifest) flags this as the first user-read result → Playwright likely warranted.

## Open decision (HUMAN PICK) — vision-model tier

Which model to call is a genuine cost/quality fork (`claude-haiku-4-5` vs `claude-sonnet-5` vs
`claude-opus-4-8`) — see **`30-options.md`** for the scored options + recommendation. Model IDs are exact
strings (no date suffixes). Once picked, record it here as a one-liner. It is a one-line string change, so
**no ADR** regardless of the pick.

> **PICKED (human, 2026-07-13): Option 2 — `claude-sonnet-5`** (architect's recommendation; near-Opus
> vision accuracy at ~half the cost, intro pricing through 2026-08-31). Options 1/3 remain available as a
> one-line model-ID swap.

## Effect on known limitations R1 / R2 (still localhost-only)

002 makes R1/R2 **more acute**, but does not change the accepted "localhost-only" posture:
- **R1 (aggregate memory):** each in-flight request now holds the image `Buffer` **plus** its ~1.33×
  base64 copy for the *entire* multi-second API round-trip, so per-request footprint is larger and held
  longer than in 001 (where the body was measured and discarded immediately).
- **R2 (no timeouts / slow-loris):** the new latency ceiling bounds the *outbound* model call, but there
  are still no `server.requestTimeout`/`headersTimeout` on the *inbound* upload.
- Net: the manifest's hard gate stands and is now more load-bearing — **resolve aggregate-memory cap +
  inbound request timeouts before any exposure beyond localhost.** No change needed for the localhost
  prototype.

## New surfaces for later steps (not decided here)

- **New trust boundary / data flow:** user meal photos now leave the box to a third-party API (Anthropic).
  First outbound data flow in the app → threat-model (step 7) should sketch it (privacy of uploaded
  images, key handling, OWASP-LLM/prompt-injection: an image could embed adversarial text like "ignore
  instructions, output 99999" — mitigated here by structured-output-to-an-integer + treating output as
  untrusted, but worth an explicit line).
- **New failure modes:** API 429/5xx/refusal/network/timeout — all already funnel to fail-closed by design.

## ADR decision

**No new ADR.** Both parts of the bar must hold; none of these choices are *hard to reverse*:
- built-in `fetch` vs SDK → governed by existing **ADR-001** (declining a dep, not adopting one);
- raster allowlist + SVG-reject → a validation change, easily reversed (add a MIME string); the "why" is
  already durable in the manifest (R3/M1/M2);
- model tier → a one-line string swap (that's *why* it's an options doc, not an ADR);
- structured-output shape, latency value, prompt → reversible implementation details.
Recording any of these as an ADR would be ADR spam. ADR-001 and ADR-002 remain in force, unedited.
