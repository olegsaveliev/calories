# ADR-00N — <decision title, start with a verb>

- **Status:** proposed | accepted | superseded
- **Date:** YYYY-MM-DD

## Context
1–3 sentences. The state at decision time and the constraint that forced the call.

## Decision
The option chosen, in 1–2 sentences, with the specific commitment.

## Alternatives considered
1. **<Option A>** — rejected because <specific trade-off, not a platitude>.
2. **<Option B>** — rejected because <specific trade-off>.

## Consequences
- **Positive:** what this enables.
- **Negative:** the concrete cost you're accepting.

## Agent-readable summary
One line a coding agent must not undo — a constraint with a "do-not" clause
(e.g. "All cross-service events go through the queue; do NOT add direct sync calls between services").
