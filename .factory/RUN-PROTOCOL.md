# Factory Run Protocol — this project

How a **factory run** builds one feature as metered, isolated subagents. (Scaffold — not yet run.)

## What a run does
0. **Git preflight** (before planning): confirm this is a git repo AND `gh` is authenticated. If both
   are present, the run follows the full **git/CI flow** below. If either is missing, **prompt the human**
   and, on approval, run **`.factory`-only** with every git stage skipped (record it in the run-record).
1. **Pick** a feature by ID from `roadmap.md` — e.g. "run 004".
2. For each step in `subagent-registry.yaml` (skipping conditional steps the feature doesn't need):
   - spawn an **isolated subagent** told to follow that step's `SKILL.md`, read its listed inputs from
     `.factory/`, and write its output file(s);
   - **capture the subagent's token usage** (reported on completion);
   - **the orchestrator performs that stage's git/CI action** (see below) — the subagents never run git;
   - **pause at HITL gates** for a human decision (see cost-guardrails.md).
3. **delivery-pm wraps:** updates `manifest.md` + `build-log.md`, appends per-step tokens to
   `dev-cost.md`, and writes `runs/<id>-run-record.md`.

## Git/CI flow — PART OF THE RUN (not optional)
The per-stage git/CI actions in **`.factory/github.md`** are a first-class part of the pipeline, performed
by the **orchestrator** (not the isolated subagents). They are only skipped when the git preflight fails
and the human approves a `.factory`-only run. The stages:

| Pipeline stage | Orchestrator git/CI action |
|---|---|
| **kickoff** (queued → in progress) | ensure the feature Issue exists + label `in-progress`; cut branch `feature/<id>-<slug>` from `main` |
| **engineering** (code written) | commit code **+ its new test(s)** to the branch; **push** (push auto-triggers CI: lint + full regression) |
| **reviewer** | open a PR (`gh pr create`); reviewer reads the diff |
| **qa gate** | **CI must be GREEN** — merge is blocked until every check passes |
| **delivery-pm / wrap** (in progress → delivered) | commit the manifest/roadmap/doc updates **on the branch**, ensure CI green, `gh pr merge --squash --delete-branch`, then **close the Issue** (`gh issue close <n> -c "delivered in <sha>"`) |

> ⚠️ **`main` is protected (ADR-008)** — never commit to `main` directly; all work lands via a branch +
> green PR. `.factory/` stays the source of truth; GitHub is the mirror (`github.md`).

## Why isolated subagents (the whole point)
Each step runs as its own subagent, so its token usage is **metered** — reported back on completion,
exactly like the reviewer's `34,173` on feature 008. Inline work can't be self-metered by the agent;
isolation is what makes **per-skill dev-cost real**. It also gives the **reviewer** genuine bias-free
isolation (it never sees the builder's reasoning).

## Recipes stay DRY
Subagents do **not** duplicate the recipe — they **read `.claude/skills/<step>/SKILL.md`** and follow it.
The skill file is the single source of truth; "inline via `/skill`" and "isolated via factory" run the
same recipe. (If we later want each step as a first-class Claude Code subagent *type*, we can generate
thin `.claude/agents/<name>.md` wrappers that just point at the skill — not needed for the registry model.)

## Trigger
Run **`/factory-run <feature-id>`** (e.g. `/factory-run 004`). It resolves the feature, **confirms the
plan with you first** (which steps, call count vs. the 12 cap, Haiku vs Opus), then runs on your "go".
Command lives at `.claude/commands/factory-run.md`.

## Engine — two ways to drive it
- **Manual:** dispatch each step with the Agent tool, one subagent per step, following the registry.
- **Automated:** a Workflow script (deterministic multi-agent runner) pipelines the steps and records
  per-agent tokens automatically. This is the modern equivalent of the bootcamp's manual run prompts.

## Guardrails & gates
See `cost-guardrails.md`: call caps, cheapest-capable-model-first, stop conditions, and the HITL gates
where the run pauses for a human (architecture/options pick · review disposition · risk acceptance · QA
release call · roadmap changes).

## Cost honesty
A factory run costs **more** than inline execution — spawn overhead, and each subagent re-reads its
inputs fresh. You pay that premium to buy three things inline can't give: **isolation**, **exact
per-step metering**, and a **bias-free review**. For a trivial change, inline is still fine; use the
factory when cost visibility or rigor is worth it.
