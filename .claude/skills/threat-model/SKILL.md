---
name: calories-threat-model
description: For this project (reads PROJECT.md + manifest.md first). Pipeline Step 7 (conditional). First-pass threat model — a small data-flow
  sketch with trust boundaries, a STRIDE-per-element pass, and an L×I-scored risk register. Runs an
  OWASP-LLM Top-10 + lethal-trifecta pass ONLY when an AI/model is in scope (otherwise states it's N/A).
  Identifies + ranks risks; does NOT design controls or sign off risk acceptance. Reads manifest +
  spec + design; writes 70-threats.md.
---

# Threat Model — Calories (pipeline Step 7, conditional)

**Goal.** Answer "how could this be attacked or go wrong, and which risks matter most?" — before ship,
not after an incident. Identify and rank; leave fixing and sign-off to others.

**When to run.** Only when a feature changes the attack surface: new storage (e.g. 004 persist), any
network/server, handling of sensitive data, or **any AI/model** feature. Skip for pure-cosmetic or
pure-logic features whose surface is unchanged.

**Read first (memory):** `.factory/manifest.md` (live surfaces, data model, decisions), the feature's
`20-stories-acs.md` + `30-design.md`. **Write:** `.factory/features/<id>/70-threats.md`.

## What it produces
1. **Data-flow sketch + trust boundaries** — where untrusted input enters (user text, stored data, network).
2. **STRIDE per element** — for each part, note a threat or "n/a": **S**poofing · **T**ampering ·
   **R**epudiation · **I**nformation disclosure · **D**enial of service · **E**levation of privilege.
3. **Risk register** — each risk scored **Likelihood × Impact** (1–3 each), ranked; note the existing
   control if any (e.g. ADR-002 textContent closes injection).
4. **AI pass (conditional)** — if a model/LLM is in scope: OWASP-LLM Top-10 review + the **lethal
   trifecta** check (private-data access + untrusted content + outbound channel — all three = danger).
   If no model is in scope, write exactly: "No model in scope — AI/OWASP-LLM pass N/A."

## Decision rules

| ✅ DO | ❌ DON'T |
|-------|----------|
| Mark every trust boundary where untrusted data enters | Assume input is safe because "it's just internal" |
| Give each element a STRIDE note or explicit "n/a" | Leave an element unassessed |
| Score risks L×I and rank; cite the existing control if one exists | Report an unranked wall of hypotheticals |
| Run the AI/trifecta pass whenever a model is in scope | Skip the AI pass when an LLM is involved |
| State "AI pass N/A" plainly when there's no model | Silently omit the AI section |

**Escalate, never decide (human-owned):** risk acceptance / sign-off · whether a risk blocks ship ·
which controls to build.
**Stop-and-ask when:** a High×High risk has no owner · an AI feature is in scope AND all three trifecta
legs are present (stop + flag) · a feature introduces a new trust boundary (server, network, sensitive
data) that the current decisions don't cover.

**How to check it's working.** Produce `70-threats.md` with ≥1 trust boundary, a STRIDE note per element
(threat or n/a), an L×I-ranked register citing existing controls, and an AI pass that either runs (model
in scope) or states N/A.

## Eval table
| # | Check | Input | Expected | Pass signal |
|---|-------|-------|----------|-------------|
| 1 | STRIDE coverage | spec + design | Each element has a threat or "n/a" | 0 elements unassessed |
| 2 | Ranked register | 70-threats.md | Risks scored L×I and ordered | ranking present; controls cited |
| 3 | AI pass handled | model in scope? | Runs OWASP-LLM + trifecta, else states N/A | section present either way |
| 4 | Identifies, doesn't fix | a real risk | Risk + owner ask, no control designed/accepted | 0 controls built; 0 sign-offs |
