# 003 — Redesign ("Midnight Lime") — Code Review

> Pipeline Step 5.5. Independent, skeptical read of the frontend rebuild of `src/index.html`
> (markup + inline CSS + vanilla JS state machine) plus the extended `tests/upload.test.js`.
> Source of truth: `20-stories-acs.md` (ACs/state machine), `30-design.md` (approach/ADRs),
> `.factory/manifest.md`, `.factory/decisions/` (ADR-001, ADR-002).

## Independence tier

**Tier A** — reviewed by a fresh subagent that did not write the code and never saw the build
reasoning as it was produced. Inputs were the spec + the finished diff only.

## Scope reviewed

- `git diff main...HEAD` (886-line rewrite of `src/index.html`; +63 lines in `tests/upload.test.js`).
- Full current `src/index.html` (markup, inline `<style>`, inline `<script>` state machine).
- Confirmed **no server file changed** (`server.js`, `vision.js`, `rate-limit.js`, `strip-metadata.js`
  are not in the diff) — the `POST /upload` contract is untouched.

## Verdict

**No blocking (major) defect found.** The state machine is fail-closed on the integrity dimension
that matters most — no fabricated calorie number can reach the hero, and the neutralised 007 fields
are static `—`/omitted markup that JS never writes to. Two minor findings and two nits below, plus a
clearly-stated behavioural-test blind spot QA must rule on. Ship call is the human's.

---

## Findings by lens

### 1. Correctness / logic

**F1 (minor) — No client-side request timeout; a stalled fetch traps the user in `estimating`
with no reachable escape control.** `src/index.html:757-798` (`submitEstimate`).
The client `fetch('/upload', …)` has **no `AbortController`/timeout**. During `estimating`,
`render()` (`src/index.html:726-730`) hides *every* interactive control — `backButton.hidden`,
`newPhotoButton.hidden`, and `tryAgainButton.hidden` are all true, and the Pick screen is hidden.
So the only states that exit `estimating` are a `fetch` that resolves or rejects.
- Normal failures are fine: a refused/reset connection rejects → `catch` → `error` (AC4.2 holds), and
  a live-but-slow server self-aborts at its 30s ceiling and returns `unavailable` → `error`.
- The gap: a **half-open / stalled socket** (server process dies mid-response, connection black-holes)
  produces neither event promptly. The fetch hangs until the browser's own network timeout (minutes),
  during which the skeleton pulses with no back/New-photo/Try-again affordance — a temporary dead-end
  recoverable only by page reload.
- **Repro:** select a photo, tap Estimate, then kill the server (or drop the TCP connection) after the
  request headers are sent but before the response body. UI stays on the pulsing skeleton with no
  control to leave until the browser eventually errors the fetch.
- AC4.2 explicitly names "the request timed out" as an `error` trigger, but no client timeout
  implements it — the transition is only reachable via the browser's default timeout, not the app's.
- *Not a fabrication/integrity issue* (no number is ever shown here), so severity is minor; worth an
  `AbortController` with a bounded timeout (e.g. 35s, just past the server's 30s) → `errorReason =
  'unavailable'`, given the reset controls are deliberately hidden mid-flight.

**Everything else in this lens is sound (verified by trace):**
- Double-submit guarded twice: `submitEstimate` early-returns on `state === 'estimating'`
  (`:759`) and the CTA handler returns on `cta.disabled` (`:826`); Try-again is hidden while
  estimating. At most one `POST` per attempt (AC2.2). ✔
- Object-URL lifecycle is leak-free: `selectFile` revokes the prior URL before creating a new one
  (`:739-741`, AC1.5), and `resetToIdle` revokes on every reset (`:747`). The live URL during
  `done` is intentionally retained (it is the result photo `src`) and revoked on the next reset. ✔
- No stuck states other than F1: `estimating` always resolves via the try/catch (JSON-parse failure
  is caught at `:772-776`); `done`/`error` exit only via reset/try-again. ✔
- No slow-response-vs-reset race: reset is unreachable while `estimating` (all reset controls
  `hidden`), so a late response can never overwrite a reset (AC5.4 enforced by UI, not just by
  inspection). ✔
- CTA enabled/disabled tracks `state === 'selected'` correctly in `render()` (`:703-705`). ✔

### 2. Security

**None found.** All model/response-derived text reaches the DOM via `textContent` only —
`heroValue.textContent = String(calories)` (`:723`) and `errorText.textContent =
errorMessageFor(errorReason)` (`:724`); `errorMessageFor` returns only two hardcoded string literals,
never response text. No `innerHTML`, no `eval`, no template injection anywhere in the script. Image
`src` values (`dropzonePreview.src`, `resultPhoto.src`) are local `URL.createObjectURL` blobs, not
attacker-controlled URLs; the user filename is never written to the DOM. ADR-002 / the server-side
API key posture is untouched (no secret in client code — the AC2.5 scan test still guards this).
XSS posture from 001/002 is preserved (30-design.md §2 honoured).

### 3. Regression

**None found.** Server files are byte-for-byte unchanged (not in the diff); the `POST /upload`
request (raw body + `Content-Type`) and the `{ ok, size, type, calorieResult }` envelope are read
exactly as `src/server.js` returns them. The two 002 test assertions that were changed
(`accept="image/*"` → `accept="image/jpeg,image/png"`; `"metadata are removed"` → the restyled
privacy copy) are **legitimate, not weakenings**: the narrowed `accept` closes the manifest's known
`accept="image/*"` cosmetic debt (AC1.4), and the privacy-notice test still asserts the same three
substantive claims — names the third party (`/sent to Anthropic/i`), states metadata is stripped
before egress (`/metadata is\s+stripped/i`), states nothing is stored (`/is stored here/i`) — per
AC7.3. All server-behaviour suites are untouched.

### 4. Edge cases

**F2 (nit/low) — 415 (client-guard bypass) renders the generic "unavailable" message, not a distinct
"unsupported file type" message.** `src/index.html:785-790`. `30-design.md` §3's mapping table calls
for a "Honest 'unsupported file type' message" on a 415, but any non-`estimated`/non-`no_food`
response (including 415 and 429) falls into the single `else` → `errorReason = 'unavailable'` →
"Couldn't estimate calories — try again." No AC strictly requires distinct 415 copy (AC7.2 only
requires the *server* still returns 415, which it does), and this path is only reachable by bypassing
the narrowed client `accept` via devtools — so this is a fidelity deviation from the design note, not
an AC failure. Flagging so it is a conscious choice, not an oversight.

**Other edges verified OK:** wrong file type rejected client-side with no state change (`selectFile`
early-returns via `isAllowedFile`, `:737`, AC1.4); Space key handled across browsers
(`' '`/`'Spacebar'`, `:803`) with `preventDefault` to stop page scroll; empty `dataTransfer` guarded
(`:816`); `fileInput.value = ''` cleared on reset so re-picking the same file re-fires `change`
(`:753`). Fail-closed integrity: `done` requires
`cr.status === 'estimated' && Number.isFinite(cr.calories)` (`:779`) — `no_food`/`unavailable`/
non-2xx/unparseable can never reach the hero number (AC2.4/AC3.3/AC4.4). The stat tiles are literal
`—` in static markup that no JS ever writes to; the food-name pill and "± NN" range are absent from
the DOM entirely — confirmed no fabricated demo value can render (AC3.2). ✔

### 5. Simplicity / dead code

**F3 (nit) — `role="button"` on the dropzone container, which wraps a focusable `<input type="file">`
and an `<img>`.** `src/index.html:526-554`. Nesting content inside an element with `role="button"` is
non-idiomatic ARIA (a button should not contain other structural/interactive descendants). In
practice it is benign here because the input is `tabindex="-1" aria-hidden="true"` (removed from the
AT tree and tab order) and the dropzone is the intended focusable proxy (AC8.2). Not a functional bug;
noting for awareness only. No dead code, unused vars, or copy-paste found — every `getElementById`
handle is wired, `errorReason`/`calories`/`previewUrl`/`currentFile` are all read and cleared.

### 6. ADR / decision drift

**None found.** No framework, no build tool, no new runtime dependency — a single inline `<style>` +
inline `<script>` in the one server-served `index.html`, exactly within ADR-001's one-service shape.
The Google Fonts `<link>` is a static asset load (not a runtime dep/framework) with a system-font
fallback stack, as reasoned in `30-design.md` §6; the third-party-IP-leak trade-off is already
documented and accepted there. ADR-002 (raw-binary `POST /upload`, MIME in `Content-Type`) is
preserved verbatim (`:765-769`). Server surface untouched — no new route was added (the
single-document two-`<section>` toggle avoids needing a second static route).

---

## Contrast claims — spot-checked (40-design-changes.md §2)

Independently recomputed the WCAG relative-luminance ratios the ux-design pass claims, to confirm the
one token that deviates from the handoff hex is justified, not fabricated:
- `#6B7280` (old `--dim`) on `#0A0B0D`: **≈4.05:1** — matches the doc's 4.07:1; genuinely **fails** the
  4.5:1 AA bar for the small/normal-weight text (11–13px) it is used on.
- `#7A808D` (shipped `--dim`, `src/index.html:32`) on `#0A0B0D`: **≈4.95:1** — matches the doc's
  4.97:1; **passes** with margin.

The `--dim` nudge is a legitimate, AC8.5-authorized fidelity exception, and the arithmetic backing it
is accurate. (Full per-background table not re-derived; the two load-bearing values check out.)

---

## Test blind spots — for QA to rule on (NOT tested here)

The extended `tests/upload.test.js` blocks are **entirely static-HTML string assertions** (element
presence, `accept` value, disabled attribute, stat-tile `—`, absence of 007 demo strings). They are a
good structural guard, but the **behavioural state machine is not exercised at all**. Nothing in the
suite drives a browser or the script. Explicitly UNTESTED:

- The `idle → selected → estimating → done | error → idle` transitions and every `render()` branch.
- The double-submit guard (AC2.2) and the Try-again re-submit path (AC4.3).
- The `calorieResult` → view mapping (`estimated`/`no_food`/`unavailable`/non-2xx/unparseable → the
  right screen and message) — i.e. the exact contract-reading logic at `:778-795`.
- Object-URL create/revoke lifecycle (leak-freeness, AC1.5/AC5.1).
- Drag-and-drop, keyboard dropzone activation (Enter/Space), and disabled-CTA inertness (AC1.3).
- The F1 stalled-fetch dead-end (no test could catch it — there is no timeout to assert).
- The ring/skeleton animation states and `prefers-reduced-motion` guard.

This matches the "frontend behaviour still not E2E-tested" debt already carried in the manifest and
flagged in `50-build-notes.md`. The redesign adds real interaction complexity (drag-drop, keyboard,
animated multi-state result) beyond 001/002, so the Playwright decision is now more warranted — QA's
call, not this review's.

---

## Summary

| Lens | Result |
|------|--------|
| 1. Correctness / logic | **F1 (minor)** — no client fetch timeout → stalled-socket dead-end in `estimating` |
| 2. Security | none found |
| 3. Regression | none found |
| 4. Edge cases | **F2 (nit/low)** — 415 shows generic message vs. design's distinct 415 copy |
| 5. Simplicity / dead code | **F3 (nit)** — `role="button"` wraps focusable descendants (benign) |
| 6. ADR / decision drift | none found |

**Findings handed back to engineering; no code changed by this review.** Whether F1 blocks ship,
whether the untested behavioural surface is acceptable for this release, and the merge/ship call
itself are human-owned decisions.
