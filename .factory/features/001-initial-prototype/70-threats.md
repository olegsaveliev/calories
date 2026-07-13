# 001 — Initial prototype · Threat Model (Step 7, first pass)

**Why this ran.** Feature 001 introduces the FIRST real attack surface in Calories: a public Node
`http` server with a `POST /upload` endpoint that reads a **raw request body straight off the network**
into an in-memory buffer, plus a static-file route. Per the skill's "when to run" rule (new
network/server), a threat model is warranted. This is a **first pass** — it identifies and ranks risks
only; it does not design controls and does not accept/sign off any risk. Those are the human's.

**Ground truth read:** `src/server.js`, `src/index.html`, `20-stories-acs.md`, `30-design.md`,
ADR-001 (single Node service, model key server-side, no framework/dep), ADR-002 (raw binary POST
upload), and `55-review.md` (findings M1, M2, N1–N3 folded in below where relevant).

---

## 1. Data-flow sketch + trust boundaries

```
   ┌─────────────┐    (TB-1)      ┌──────────────────────────────────────────────┐
   │   BROWSER   │   network,     │              NODE HTTP SERVER                  │
   │ (untrusted  │   plaintext    │        (built-in http + fs, ESM, ADR-001)      │
   │  client;    │   HTTP  ═════▶ │                                                │
   │  index.html │◀════ (TB-1) ══ │  requestHandler(req,res)  ── routes on         │
   │  runs in    │   responses    │      method + url.pathname                     │
   │  user's DOM)│                │                                                │
   └─────────────┘                │   ┌────────────────────┐  ┌─────────────────┐ │
         ▲                        │   │ E2 POST /upload    │  │ E4 GET / ,      │ │
         │ E5 frontend            │   │  ├ E3 content-type │  │   /index.html   │ │
         │ (served HTML+JS)       │   │  │   validation    │  │  static serve   │ │
         │                        │   │  └ E1 readBodyCapped│ │  (fs.readFile   │ │
         └────────────────────────┼── │     (raw body →    │  │  fixed path)    │ │
                                  │   │     Buffer, 10 MB  │  └─────────────────┘ │
                                  │   │     mid-stream cap)│                      │
                                  │   │        │           │                      │
                                  │   │        ▼           │                      │
                                  │   │  in-memory Buffer  │  ← measured then     │
                                  │   │  (size + MIME       │    DISCARDED         │
                                  │   │   echoed back)      │  (TB-2: process mem) │
                                  │   └────────────────────┘                      │
                                  └──────────────────────────────────────────────┘

  NOT present this feature: no DB / persistence, no disk writes, no outbound calls,
  no vision-model/API route, no secrets (server or client), no auth/session.
```

**Trust boundaries.**
- **TB-1 — Network edge (browser → server).** The only untrusted-input boundary that matters. Everything
  crossing it is attacker-controllable: the HTTP method, URL/path, `Content-Type` header, and the raw
  request body (arbitrary bytes, arbitrary length, arbitrary send-rate). No authentication — the endpoint
  is open to anyone who can reach the port. Transport is plaintext HTTP (no TLS) in the prototype.
- **TB-2 — Process memory.** The uploaded body is buffered in the Node process heap, then measured and
  dropped. No data leaves the process; nothing is persisted (design §"Explicitly out"). The blast radius
  of a bad body is confined to this process's memory/availability.

**Assets in scope.** Service **availability** (the process staying up / responsive) is the primary asset
— there is no stored data, no secret, and no privileged action to protect yet. Data confidentiality and
integrity are near-nil this feature (nothing is stored or returned but the caller's own size/MIME echo).

---

## 2. STRIDE per element

Elements: **E1** raw-body reader + 10 MB cap · **E2** `POST /upload` endpoint (routing + orchestration)
· **E3** content-type validation · **E4** static-file route (`GET /`, `/index.html`) · **E5** frontend
(served HTML/JS).

| Element | S (Spoofing) | T (Tampering) | R (Repudiation) | I (Info disclosure) | D (Denial of Service) | E (Elevation) |
|---|---|---|---|---|---|---|
| **E1 raw-body reader + cap** (`readBodyCapped`, server.js:41–78) | n/a (no identity) | Body bytes fully attacker-controlled — but only measured/discarded, so tampering has no downstream effect *this feature*; becomes live when the model route consumes the buffer | n/a (no log/audit exists — see E2·R) | n/a (body isn't stored or reflected except its length) | **YES — primary.** (a) Many concurrent 10 MB uploads → up to N×10 MB heap pressure / OOM (no concurrency cap). (b) Slow-loris: trickle-fed body holds a connection + partial buffer open indefinitely (no `requestTimeout`/`headersTimeout` set) — **review N1**: even the post-cap `req.resume()` drain has no time bound. | n/a |
| **E2 `POST /upload` endpoint** (routing + handler, server.js:86–123, 150–164) | **Weak.** No auth/rate-limit/origin check — any client may invoke; no CSRF-relevant state, but the endpoint is fully open (an asset only once it does real work) | Attacker controls method+path+headers; unknown routes fall through to a clean `404 {"error":"not found"}` (N3: `405` would be marginally more correct, not a risk) | **YES (accepted-gap).** No request logging at all → an abusive caller leaves no trace; can't attribute a flood. Low impact in a prototype | Error bodies are fixed, generic strings (`"could not read upload"`, `"internal error"`) — **no stack/internal leak** (good). `500 "could not load page"` on index read failure is generic too | Amplifies E1 DoS: no rate limit / no per-IP cap means one host can open unlimited concurrent uploads | **No path→privilege**: no shell-out, no eval, no dynamic require, no privileged op reachable |
| **E3 content-type validation** (server.js:96–99) | n/a | **YES (spoofable by design).** MIME is taken from the client `Content-Type` header (ADR-002 ground truth) — not sniffed from bytes; a client can label anything `image/jpeg`. **Review M1:** `image/svg+xml` passes `startsWith("image/")` (SVG is script-capable). **Review M2:** degenerate `image/` / `image/;charset=x` pass and get echoed as `type:"image/"`. Harmless now (body discarded), **latent** for the model route | n/a | The echoed `type` can be a non-canonical/mislabelled MIME (M2) — cosmetic this feature | A rejected type short-circuits *before* reading the body (fast 415), so validation itself is not a DoS lever | Only relevant if a later consumer trusts this MIME to pick a parser (e.g. renders SVG) — **elevation risk deferred to the model feature**, flagged here |
| **E4 static-file route** (`serveIndex`, server.js:130–141, 153) | n/a | Path is **not** derived from user input — `INDEX_HTML_PATH` is a hardcoded, `__dirname`-joined constant; only `/` and `/index.html` map to it, everything else 404s. **Path traversal is structurally impossible** — reviewer's claim **validated**: `GET /../server.js` normalises via `new URL(...).pathname` and 404s (review §2, live-confirmed) | n/a | Serves only the intended `index.html`; on read failure returns generic `500` (no path/errno leak). **No security headers** set (no CSP, `X-Content-Type-Options`, `Referrer-Policy`, HSTS) — thin surface today, matters more once dynamic content/model output is rendered | fs read of one small local file per `GET /`; negligible | n/a |
| **E5 frontend** (index.html) | n/a | Server responses rendered via **`textContent` only** — never `innerHTML`/`eval` (index.html:37; ADR-noted, review §2). **XSS from server-echoed data is closed by construction.** `data.size`/`data.type` interpolated into a template string then assigned to `textContent` → inert | n/a | **No secret in client** (AC2.5; test-scanned + manual read). Model key does not exist yet (route deferred). Nothing sensitive shipped to the browser | Client-side only; a hostile page can't DoS the server beyond what E1/E2 already cover | Runs in the user's own origin; no privileged browser capability invoked |

**Coverage:** all 5 elements assessed; every non-applicable cell marked `n/a` with reason.

---

## 3. Risk register (Likelihood × Impact, 1–3 each; sorted by score)

Scoring: L and I each 1 (low) / 2 (med) / 3 (high); **Score = L × I**. Bands: **High 6–9 · Med 3–4 ·
Low 1–2.** "Existing control" cites what already limits the risk in the shipped code/ADRs.

| # | Risk (scenario) | L | I | Score | Band | Existing control | Suggested mitigation *direction* (not a decision) |
|---|---|---|---|---|---|---|---|
| **R1** | **Memory-exhaustion DoS via many concurrent uploads.** Attacker fires many parallel `POST /upload`s each near 10 MB; N in-flight buffers = N×10 MB heap → GC pressure / OOM / process kill. No concurrency or per-IP cap; each request may buffer up to the full cap. | 3 | 3 | **9** | **High** | Per-request 10 MB cap (server.js:50) bounds *one* body — but nothing bounds *how many* at once. | Direction: cap total in-flight upload memory and/or concurrent uploads per client; consider streaming-to-sink instead of full-buffer once a real consumer exists. |
| **R2** | **Slow-loris / socket-drain exhaustion (review N1).** A client trickles the body (or, post-413, keeps the drained socket open) with no server-side time bound — `server.requestTimeout`/`headersTimeout` are unset. Enough slow connections exhaust the socket/handler pool → availability loss. | 2 | 3 | **6** | **High** | Mid-stream cap frees *bytes* on oversize (chunks.length=0) and drains cleanly (no reset) — but imposes **no time limit** on the connection (N1). | Direction: set `server.requestTimeout` + `headersTimeout` (and/or `req.destroy()` after the 413 flushes) so a connection can't be held open indefinitely. |
| **R3** | **Content-type spoofing / SVG accepted (review M1 + M2).** Client labels arbitrary bytes `image/*`; `image/svg+xml` (script-capable) and degenerate `image/` pass validation. No effect today (body measured then discarded), but the **later vision-model route will consume whatever this endpoint admits**, and any place that renders SVG inherits a live XSS/parse risk. | 2 | 2 | **4** | **Med** | `startsWith("image/")` blocks non-image types (AC2.2); body is **discarded**, so no live execution this feature. | Direction: allowlist explicit raster MIME types (`image/jpeg|png|webp|heic…`) and reject empty/degenerate subtypes; decide SVG's fate *before* the model route ships. Record the choice. |
| **R4** | **Plaintext HTTP (no TLS).** Upload bytes + all traffic travel unencrypted; a network attacker can read/modify the food photo in transit and there's no server authentication. Low sensitivity today (a food photo, no secret/PII/auth), but the transport is trivially MITM-able. | 2 | 2 | **4** | **Med** | None in-app (prototype scope; ADR-001 doesn't mandate TLS). Data sensitivity is currently low. | Direction: terminate TLS (front with a reverse proxy or serve HTTPS) before any sensitive data, auth, or the model API key path exists. |
| **R5** | **No rate limiting / open unauthenticated endpoint.** The endpoint is reachable by anyone with no throttle → free amplifier for R1/R2 and, later, a way to burn paid vision-model quota once that route lands. | 2 | 2 | **4** | **Med** | Routing is tight (only 2 routes; unknown → 404); per-request cap limits a single call. No throttle across calls. | Direction: add per-IP rate limiting / basic abuse controls, especially before the metered model route is added. |
| **R6** | **Missing security response headers.** No CSP, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, or HSTS on served responses. Thin risk while the page renders only its own static HTML + `textContent`, but the safety net is absent for when model output / richer content is rendered. | 2 | 1 | **2** | **Low** | Frontend uses `textContent` only (XSS closed by construction, E5); static route serves one fixed file. | Direction: add a baseline security-header set (CSP + nosniff at minimum) when responses start carrying dynamic/model-derived content. |
| **R7** | **No request logging → unattributable abuse (E2·R).** No access/audit log; a flood or abusive caller leaves no trace, hampering detection and attribution. | 2 | 1 | **2** | **Low** | None; prototype has no logging beyond a startup line. | Direction: add minimal structured request logging (method, path, status, size) when operability matters. |
| **R8** | **Error-response information disclosure.** Risk that failures leak stack traces / internal paths. **Assessed and currently NOT present** — all error bodies are fixed generic strings and the top-level catch returns `{"error":"internal error"}` with no internals (server.js:111,139,173). Logged as a watch-item so it stays that way. | 1 | 1 | **1** | **Low** | Generic fixed error bodies everywhere; no `err.message`/stack echoed to the client. | Direction: keep client-facing errors generic as the code grows; never echo `err.message`/stack to the wire. |

**Band tally:** High **2** (R1, R2) · Med **3** (R3, R4, R5) · Low **3** (R6, R7, R8) — **8 risks total.**

---

## 4. Top risks — flagged for the human's risk-acceptance decision

Per the skill, the threat model **ranks and recommends; it does not accept risk or decide ship.** These
need an explicit human call:

1. **R1 — concurrent-upload memory exhaustion (9, High).** The single most serious risk: the per-request
   10 MB cap does not bound *aggregate* in-flight memory, and there is no concurrency/rate cap, so N
   parallel near-cap uploads can OOM the process. **A High×High risk with no owner → the skill says
   stop-and-flag.** Decision needed: accept for the prototype, or bound concurrent/aggregate upload
   memory before exposure beyond localhost.
2. **R2 — slow-loris / unbounded connection hold (6, High; review N1).** No `requestTimeout`/
   `headersTimeout`; a handful of slow connections can tie up the server. Decision needed: accept for
   prototype, or set request timeouts.
3. **R3 — content-type spoofing / SVG (4, Med; review M1+M2).** Benign *now* (body discarded) but a
   **latent** trap the moment the vision-model route consumes this endpoint's output. Recommend the
   human decide the MIME allowlist / SVG policy **before** that route ships, not after.

**New trust boundary flagged (skill stop-and-ask):** Feature 001 introduces **TB-1, the network edge**
— the first untrusted-input boundary in the project. The decisions in force (ADR-001/002) cover the
*shape* of the transport but not DoS/rate-limiting/TLS posture; R1, R2, R4, R5 sit in that uncovered
gap and are surfaced here for the human.

---

## 5. AI / OWASP-LLM Top-10 + lethal-trifecta pass

**No model in scope — AI/OWASP-LLM pass N/A.**

No AI/model/tool-use exists in Feature 001: the vision-model API route is explicitly deferred (ADR-001,
PRD out-of-scope, spec "AI Eval Card: N/A"), and this endpoint only measures and discards the uploaded
bytes. The OWASP-LLM Top-10 review and the **lethal-trifecta** check (private-data access + untrusted
content + outbound channel) therefore do not apply here.

**Activation note.** This pass **must run** when the vision-model route is added (a later feature). At
that point: (a) untrusted content is the uploaded image — R3's content-type spoofing / SVG becomes a
live prompt-/parser-injection vector; (b) a server-side model **API key** appears (private credential);
(c) the **outbound call** to the model provider is the exfil channel. That is potentially **two of the
three trifecta legs plus a secret** — per the skill, an AI feature with all three legs present is a
stop-and-flag. Re-run this threat model then.

---

*Step 7 output. Identifies + ranks risks and cites existing controls; designs no controls and accepts
no risk — control choice and risk acceptance / ship call are the human's.*
