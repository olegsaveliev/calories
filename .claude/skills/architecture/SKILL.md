---
name: calories-architecture
description: For this project (reads PROJECT.md + manifest.md first). Pipeline Step 3 (between spec and build). Read the feature's spec +
  manifest + existing ADRs; reuse decisions already in force, and record a NEW ADR only when a choice
  is hard to reverse AND likely to be questioned later. Writes 30-design.md (short approach note) and
  decisions/00X-*.md as needed. Owns the decisions/ folder. NOT for adopting expensive/irreversible
  choices or overturning an accepted ADR — those go back to the human.
---

# Architecture — Calories (pipeline Step 3, owns `decisions/`)

**Goal.** Keep the app's structural choices consistent and cheap to revisit: apply the decisions
already in force, write down only the decisions that will matter later, and never silently reverse one.

**Read first (memory):** `.factory/manifest.md` ("Key decisions in force" + data model), everything in
`.factory/decisions/` (existing ADRs), the feature's `20-stories-acs.md` + `20-prd.md`.
**Write:** `.factory/features/<id>/30-design.md` (short: approach + which ADRs apply);
`.factory/features/<id>/30-options.md` when there's a real fork (see below); new
`.factory/decisions/00X-<slug>.md` when the ADR bar is met.

## When to write an ADR (the bar)

Write one ONLY if **both** are true:
1. **Hard to reverse** — undoing it later means real rework (data model shape, a dependency, an
   architectural pattern, a security posture), AND
2. **Likely to be questioned** — a future person could reasonably ask "why was it done this way?"

Otherwise: just note the choice in `30-design.md`. Reversible/obvious choices (a CSS colour, a variable
name, wording) get **no ADR** — ADR spam is worse than none.

## When to write an options doc (the recommendation step)

When a feature has a **real fork** — ≥2 viable approaches with different trade-offs (how to hold a secret,
which id scheme, which visual direction) — write `30-options.md` BEFORE settling the design:
- **2–4 options**, each a one-line description.
- **Score each** on **Value / Effort / Risk** (H/M/L), plus a one-line rationale.
- **A recommended pick** — but the final choice is the human's (present it, don't commit it).
- Then record the human's pick in `30-design.md` (+ an ADR if it clears the bar above).

This makes "what we considered and why we chose this" durable provenance instead of a vanished prompt.
Skip it when there's only one sensible approach.

## Decision rules

| ✅ DO | ❌ DON'T |
|-------|----------|
| Check existing ADRs + manifest decisions first; reuse and cite them | Re-decide something an accepted ADR already settles |
| Write an ADR only when it clears the two-part bar above | Create an ADR for a trivial or easily-reversed choice |
| Give every ADR: context · decision · rejected alternatives · consequences (+ a "revisit when…" trigger) | Record a decision with no rejected alternative or no consequence |
| Number ADRs sequentially; to change one, add a new ADR that marks the old "superseded by 00X" | Edit or delete an accepted ADR in place |
| Keep `30-design.md` short: the build approach + which ADRs govern it | Turn the design note into a second spec |
| On a real fork, write `30-options.md` — 2–4 scored options + a recommended pick — and let the human choose | Silently pick one approach when several were viable, leaving no record |

**Escalate, never decide (human-owned):** adopting an expensive or irreversible choice (adding a server,
framework, dependency, or DB) · overturning an accepted ADR · changing `PROJECT.md` scope/non-goals.
**Stop-and-ask when:** a feature can't be built without violating an in-force ADR (stop, present the
conflict) · a decision is both expensive AND contested (present options, let the human pick, then record
the pick) · the spec implies new infrastructure.

**How to check it's working.** Given a feature spec, produce `30-design.md` naming which existing ADRs
apply, and either a new ADR (clearing the two-part bar, with rejected alternatives + revisit trigger) or
an explicit "no new ADR needed — reversible choices only."

## Eval table
| # | Check | Input | Expected | Pass signal |
|---|-------|-------|----------|-------------|
| 1 | Reuses decisions in force | manifest + decisions/ | 30-design cites applicable ADRs, doesn't re-decide | 0 contradictions with accepted ADRs |
| 2 | ADR bar respected | a reversible choice (e.g. button colour) | No ADR written; noted in 30-design instead | 0 trivial ADRs created |
| 3 | Refuses to overturn silently | feature needing to drop `textContent` safety | Stops, escalates, proposes a superseding ADR — doesn't just do it | escalation present; ADR-002 not edited in place |
| 4 | Options doc on a real fork | a feature with ≥2 viable approaches | `30-options.md` lists 2–4 scored options + a recommended pick; human chooses | options doc present with scores + a pick |
