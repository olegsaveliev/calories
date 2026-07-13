# Cost Guardrails — this project factory run

A bounded, per-feature run — not an open-ended agent swarm.

## Default boundary (per feature)
- **One feature per run.**
- **One pass per subagent** — no polish reruns.
- **Subagent-call cap:** lite feature ≈ 4 (prod-ba · engineering · reviewer · qa) + wrap; full ≈ 9.
  **Hard cap: 12** subagent calls per run.
- **Cheapest capable model first:** mechanical steps (kickoff, QA case-expansion) may run on **Haiku**;
  reasoning-heavy steps (architecture, reviewer, threat-model) run on the **default Opus**.
- **Reviewer ALWAYS runs isolated** — its own subagent, never the builder. That isolation is the
  metered, bias-free requirement, not an optimization to skip.
- No background teams · no parallel autonomous agents · no recursive subagents · no portfolio planning.

## Model rule
- The most-capable/premium model is used only for a **named** decision, with the reason recorded in the
  run-record. Don't use it to polish every step.

## Stop conditions
Stop after the hard cap, or on the first hard stop. Also stop when a subagent:
- asks for secrets, credentials, or production data;
- attempts a live write outside `src/` or `.factory/`;
- tries to make a **human-owned** decision;
- needs repeated reruns to look polished;
- can't explain its current step and named output.

## HITL gates (run pauses; the human decides)
- architecture escalation / `30-options.md` pick
- review-finding disposition (fix / accept & log / defer)
- risk acceptance (threat-model top risks)
- QA release call
- any roadmap change

## Telemetry
Every run records per-step tokens in `dev-cost.md` and a full `runs/<id>-run-record.md`. A premium-model
use without a recorded reason is a guardrail breach.
