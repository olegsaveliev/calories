# 002 — Calorie estimate · Code Review, PASS 2 (the four threat-model fixes)

**Reviewer:** isolated fresh subagent — did NOT write this code, never saw the build reasoning.
**Independence tier: A.**
**Scope:** ONLY the newly-added security code for the R9/R10/R12/R15 fixes —
`src/strip-metadata.js` (NEW), `src/rate-limit.js` (NEW), the strip/plausibility additions in
`src/vision.js`, the rate-limit wiring in `src/server.js`, the egress notice in `src/index.html`, and
`tests/strip-metadata.test.js` / `tests/rate-limit.test.js` / `tests/image-fixtures.js` plus the
extended `tests/vision.test.js` / `tests/upload.test.js`. The first review (`55-review.md`, PASS 1)
covered the original 002 build; this pass does not re-litigate it.
**Method:** read + **executed adversarial probes** against both parsers and the limiter (fuzzing,
truncation, trailing-data, boundary straddle, quota-burn). All 70 tests pass (`vitest run`, 5 files).

**Verdict: 2 MAJOR, 4 MINOR, plus notes. Two of the MAJORs are security-class (a silent R10 bypass
that fails OPEN, and a limiter logic bug that locks out honest users) → per the skill I STOP AND FLAG
them before QA/ship.** R15 is implemented correctly; the MIME narrowing is consistent at the
enforcement layer. Whether any finding blocks ship, and the GIF/WebP scope cut, are the human's calls.

---

## MAJOR findings

### F1 — MAJOR (security / R10 fail-OPEN) · JPEG metadata survives when anything is appended after EOI
**File:** `src/strip-metadata.js:92–98` (the SOS branch: `kept.push(buf.subarray(i))`).
**Category:** security / correctness · **Verdict: CONFIRMED by execution.**

On reaching Start-Of-Scan the code copies **everything from SOS to the end of the buffer, verbatim**,
then stops walking. Any bytes that follow the primary `FFD9` EOI are therefore passed through
**unparsed and unstripped**. This directly contradicts the module's own header claim ("a structural
walk of the container [that] DROPs the metadata-bearing segments") — the trailing region is never
walked at all, and the strip **fails open, not closed.**

This is not theoretical. Samsung/Google **Motion Photo**, **MPF (Multi-Picture Format)**, iPhone
Live-Photo JPEG exports, and many "burn a payload after EOI" tools append a **second, complete JPEG —
with its own APP1/EXIF, GPS included — after the first EOI.** That secondary image egresses to
Anthropic with GPS intact. R10 exists precisely to keep GPS off the wire for phone photos, and this is
exactly the phone-photo case it misses.

**Reproduction (ran it):**
```
primary JPEG (SOI..EOI) + secondary JPEG whose APP1 carries "GPS-LEAK-NEEDLE"
→ stripImageMetadata(...,"image/jpeg")  ⇒  output STILL contains the needle
   (+110 bytes of the secondary image, EXIF and all, egress)
```
A bare trailing string after EOI leaks identically. The PASS-1 fixture only asserts
`stripped.subarray(-2) === FFD9`, which passes solely because *that* fixture has nothing after EOI —
so the whole suite is blind to this.

**Fix direction (engineering's call):** stop the JPEG copy at the EOI boundary rather than copying to
`buf.length` — i.e. locate EOI within/after the scan and drop anything past it (or fail closed if no
EOI is present), so the output is guaranteed to be `SOI … kept segments … SOS … scan … EOI` and
nothing else.

### F2 — MAJOR (security / limiter logic) · A concurrency-denied request still burns the per-IP window, letting an attacker lock out honest users
**File:** `src/rate-limit.js:51–65` (per-IP count is incremented in step 1 **before** the global
in-flight check in step 2; on a concurrency denial the increment is never rolled back).
**Category:** security / correctness · **Verdict: CONFIRMED by execution.**

`acquireVisionSlot` charges the caller's per-IP window **first**, then checks the global in-flight cap
and may return `{allowed:false, reason:"concurrency"}`. That denied request **made no model call** yet
**permanently consumed one of the caller's 10/min tokens.** Because the global cap is only **2**, an
attacker holding 2 slow (up-to-30 s) calls open makes *every other IP's* requests hit
`reason:"concurrency"` — and each such denial silently eats that victim's window. A handful of denied
attempts and a legitimate user is `reason:"rate"` locked out for the rest of the minute **without ever
having reached the model once.** The control meant to protect availability becomes a lever to *deny*
it.

**Reproduction (ran it):**
```
attacker holds both in-flight slots → victim fires 10 requests
→ all 10 return reason:"concurrency" (0 model calls made for victim)
→ attacker releases slots → victim's NEXT request: DENIED reason:"rate"  (quota already burned)
```

**Fix direction:** only debit the per-IP window when a slot is actually granted — do the concurrency
check *before* incrementing the window count, or decrement the window on a concurrency denial. (Note
this trades against the comment's stated intent at `rate-limit.js:61–62`; the intent and this bug are
in tension and the human/eng should reconcile them.)

---

## MINOR findings

### F3 — MINOR (R10 guarantee is false) · PNG keeps ANY uppercase-first chunk, including unknown ones — the "keep-list" is really "keep-list + all critical"
**File:** `src/strip-metadata.js:176–179` (`isCritical = (buf[i+4] & 0x20) === 0` → kept
unconditionally).
**Category:** security / correctness · **Verdict: CONFIRMED by execution.**

The header comment promises: "we KEEP an explicit set and drop every other ancillary chunk — so a
chunk type we've never heard of cannot smuggle data out." That is only true for *ancillary*
(lowercase-first) chunks. **Any chunk whose first byte is uppercase is treated as critical and kept
unconditionally**, even a completely unknown type. A fabricated chunk like `ZzZz` (uppercase `Z` →
"critical") passes straight through with its payload:
```
PNG with chunk type "ZzZz" carrying the needle ⇒ output STILL contains the needle
```
In practice all *standard* PNG metadata (eXIf/tEXt/zTXt/iTXt/tIME) is ancillary and **is** correctly
dropped (probe confirmed zTXt/iTXt are stripped), so real phone/screenshot PNGs are handled. But the
documented invariant ("cannot smuggle data out") is false, and a hand-crafted PNG is a working
pass-through. Because the uploader controls their own image this is self-targeting for privacy today,
but it fails the module's own stated bar. Fix: don't blanket-keep unknown criticals — keep only the
four known criticals (IHDR/PLTE/IDAT/IEND) plus the ancillary keep-list, and fail closed (or strip) on
an unknown critical, matching the comment.

### F4 — MINOR (R10 completeness) · JPEG uses a DENYLIST (drop APPn+COM), so metadata in any other length-prefixed marker survives
**File:** `src/strip-metadata.js:111–116`.
**Category:** security / correctness · **Verdict: CONFIRMED by execution.**

The JPEG path keeps every length-prefixed segment that is **not** APP0–APP15 or COM. That is the
inverse of the PNG path's keep-list philosophy. Anything a decoder-irrelevant but data-bearing marker
smuggles (e.g. a reserved `FFC8`/JPGn marker) is retained:
```
JPEG with a reserved FFC8 segment carrying the needle ⇒ output STILL contains the needle
```
EXIF/GPS is APP1 (dropped), so this isn't the primary R10 miss (F1 is). But the comment claims it
keeps "every segment a decoder needs (DQT/SOF/DHT/DRI/…)" when it actually keeps *all* non-APPn/COM
markers, known or not — inconsistent with the PNG keep-list rationale and a residual smuggling channel.

### F5 — MINOR (memory, ironic vs R9/R1) · The per-IP `windows` Map is unbounded and never evicted
**File:** `src/rate-limit.js:27, 52–59` — entries are created per distinct `clientId` and only ever
*overwritten* when that same IP returns; expired windows are never swept.
**Category:** security / resource · **Verdict: CONFIRMED by execution.**

The R9 fix is meant to bound resource consumption, yet it introduces a new unbounded one keyed on the
client address. Distinct source IPs each add a permanent Map entry:
```
300,000 distinct client IPs ⇒ heap +64 MB, 0 entries ever freed
```
Over IPv6 a caller has effectively unlimited source addresses, so this is a slow memory-exhaustion
vector — the same R1 class the project already tracks. Moot on localhost (few IPs) and gated by the
manifest's "resolve before exposure" line, but it should be an explicit known-limitation, not a
surprise. Fix: sweep/expire stale windows (e.g. lazy purge on access, or cap the Map size).

### F6 — MINOR (limiter accuracy) · Fixed-window edge allows ~2× the nominal rate across a window boundary
**File:** `src/rate-limit.js:53` (fixed-window reset).
**Category:** correctness · **Verdict: CONFIRMED by execution.** Standard fixed-window burst:
```
10 calls at t=59.99s + 10 calls at t=60.00s ⇒ 20 calls inside a ~10 ms span (nominal cap 10/min)
```
Acceptable for a cost-guard prototype (the concurrency cap still bounds instantaneous spend), but the
"10/min" is really "up to 20 per rolling minute." Worth a one-line note; a sliding window or token
bucket would remove it.

---

## Lens coverage (all six)

1. **Correctness / logic** — **F1, F2, F3, F4, F6.** Positives verified: both parsers are
   **loop-safe and never throw** — I fuzzed 40k random buffers + every truncation prefix of a valid
   JPEG/PNG; **0 throws, 0 hangs, 0 out-of-bounds** (truncated inputs return `null`). JPEG bogus/lying
   segment lengths and PNG lying chunk lengths both fail closed (`strip-metadata.js:109,170`). The
   30 s `AbortController` + `finally clearTimeout` and `release()`-in-`finally` are intact.
2. **Security** — **F1, F2, F3, F4, F5.** **R15 is correct — no bypass found:** the band check
   (`vision.js:182`) runs before `status:"estimated"`, `server.js:155–158` forwards a calorie number
   *only* for `"estimated"`, and the UI renders `cr.calories` only on that branch — so no out-of-band,
   non-integer, negative, or `NaN` value can reach the DOM; all fail closed. **Client IP is taken from
   `req.socket.remoteAddress` (`server.js:131`), NOT `X-Forwarded-For`** — good, not header-spoofable
   (caveat in Notes). No API-key leakage (still env-only, never logged, `catch {}` swallows without
   `err.message`). No untrusted model text reaches the DOM (`textContent` only). `release()` is
   idempotent and always in `finally`; I could not leak or wedge the global in-flight counter via
   throw/abort/double-release/timeout paths — **inFlight leak: none found.**
3. **Regression (001 + manifest contract)** — **none found.** `POST /upload` success envelope is
   unchanged (`{ok,size,type}`) with `calorieResult` still additive; `size` echoes the *original*
   `body.length` while only the *stripped* buffer egresses (correct). Check order preserved:
   400 no-type → 415 allowlist → 413 oversize → 400 empty → **429 rate/concurrency (new, correctly
   placed after validation so a rejected request spends nothing)** → model call. No new runtime
   dependency (`strip-metadata.js` and `rate-limit.js` are pure Node) → **ADR-001 upheld**; ADR-002
   transport untouched.
4. **Edge cases** — **F1 (trailing-after-EOI), F3 (unknown critical PNG chunk), F4 (non-APPn marker),
   F6 (window boundary).** Handled well: empty/undersized buffers, truncated segments, `FF`-fill
   bytes, `FF00`, RST/TEM standalone markers, missing EOI/IHDR/IEND all fail closed.
5. **Simplicity / dead code** — **none found.** Frozen constants, small pure functions, no copy-paste;
   `inFlightVisionCalls`/`resetRateLimits` are test-only but clearly labelled.
6. **ADR / decision drift** — **none found.** Zero new runtime deps (ADR-001); the GIF/WebP → 415
   narrowing is a validation change (design says it needs no ADR). Model ID, structured-output param
   unchanged. **The narrowing itself is a scope cut from the design's jpeg/png/gif/webp allowlist — the
   accept/reject of that is explicitly the human's call, not mine** (see Notes for consistency check).

## MIME-narrowing consistency (jpeg/png only; GIF/WebP → 415) — as requested

Consistent at every enforcement point: `strip-metadata.js:27` (`STRIPPABLE_MIME_TYPES`) →
`vision.js:46` (`SUPPORTED_RASTER_MIME_TYPES` aliases it) → `server.js:104` (`isSupportedRasterMime`
gates before body read). Tests assert gif/webp → 415 in both `vision.test.js:62` and
`upload.test.js:287`, and that they never reach the model. **One cosmetic mismatch (not security):**
`index.html:30` still advertises `accept="image/*"` and the copy says "Pick a food photo," so a user
can pick a GIF/WebP/HEIC in the picker and only discover it's unsupported via a 415 → "Unsupported
file type." The UI never states the jpeg/png-only limit up front. Minor UX; flag for the human with
the scope decision.

## Test blind spots (what the 70 tests do NOT cover)

- **F1:** no fixture with trailing bytes / a secondary image after EOI — the exact real-world R10 miss.
- **F2:** no test where a concurrency denial is checked against the *victim's later per-IP budget*; the
  concurrency test releases and re-acquires but never asserts the denied IP's window was left intact.
- **F3/F4:** no PNG with an unknown uppercase-first chunk; no JPEG with a non-APPn/COM data marker.
- **F5:** no assertion that the `windows` Map is bounded/evicted.
- **F6:** no window-boundary straddle test.
- Every Anthropic response is still mocked (unchanged from PASS 1); the browser
  click→fetch→render path is still only shape-asserted (manifest already flags Playwright).
- The strip runs only on tiny synthetic fixtures — no large/real photo, and (per PASS-1 m2) the
  base64-size-vs-API-limit interaction is still unexercised.

## Notes / positives worth recording

- **R15 fully correct, IP-from-socket correct, parsers crash-proof under fuzzing, in-flight counter
  un-leakable, no key/secret leak, no untrusted text to DOM, no new dep.** These are real and
  load-bearing.
- **IP source caveat for the exposure gate (not a bug now):** because the key is the raw socket
  address, (a) on localhost all callers collapse to one IP, so the per-IP 10/min is effectively a
  *global* 10/min, and IPv4-`127.0.0.1` vs IPv6-`::1` are two separate buckets; (b) behind any future
  reverse proxy every request shares the proxy's IP and the per-IP limiter becomes global. Fine under
  the manifest's localhost posture; must be revisited at the "before exposure" gate alongside R1/R2.

**Handoff:** findings returned to engineering; reviewer made no code edits, no git/gh actions.
**Stop-and-flag:** F1 (R10 fail-open) and F2 (limiter locks out honest users) are security-class —
raised here, not buried. Ship/accept decisions are the human's.
