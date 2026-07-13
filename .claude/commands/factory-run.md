---
description: Run this project factory pipeline for one feature — isolated, metered subagents.
argument-hint: <feature id or slug, e.g. 004 or 004-persist>
---

Run this project **factory** for feature: **$ARGUMENTS**

Follow `.factory/RUN-PROTOCOL.md`, `.factory/subagent-registry.yaml`, `.factory/cost-guardrails.md`,
and `.factory/github.md` exactly. This is a metered, isolated-subagent run — not inline execution.
**The git/CI flow in `github.md` is part of THIS pipeline, not an optional add-on** — the orchestrator
performs its per-stage git action at each stage (the isolated subagents never run git; they stay scoped
to their skill + `.factory/` output).

## Do this in order

0. **Git preflight (before the plan).** Check that this is a git repo AND `gh` is authenticated
   (`git rev-parse --is-inside-work-tree` and `gh auth status`). 
   - If BOTH are available → the run follows the full `github.md` flow (branch · commit · push · PR ·
     CI-green · merge · close Issue). Say so in the plan.
   - If git or `gh` is **NOT** available → **prompt me**: report what's missing and ask whether to
     proceed **`.factory`-only (git steps SKIPPED)**. `.factory/` is the source of truth, so a
     `.factory`-only run is fully valid — it just doesn't mirror to GitHub. Record "git: skipped
     (unavailable, human-approved)" in the run-record and OMIT every git stage below.

1. **Resolve the feature.** Find the row for `$ARGUMENTS` in `.factory/roadmap.md`.
   - If `$ARGUMENTS` is empty → list the queued roadmap rows and ask which to run. Stop.
   - If the id isn't on the roadmap, is blocked by an undelivered dependency, is already `delivered`
     in `manifest.md`, or conflicts with `PROJECT.md` non-goals → **STOP and say why** (kickoff guardrails).

2. **Confirm the plan BEFORE spawning anything.** Read the manifest + the roadmap row and tell me:
   - which steps will run (skip conditional `architecture` / `ux-design` / `threat-model` unless the
     feature needs them — data-model/structural change, look-&-feel, or new attack surface / AI);
   - the estimated subagent-call count vs. the **12 cap**;
   - which steps may run on **Haiku** (mechanical: kickoff, QA expansion) vs. **Opus** (reasoning:
     architecture, reviewer, threat-model);
   - **the git mode** from the preflight (full GitHub flow, or `.factory`-only skipped).
   Then **wait for my "go".**

3. **Execute per the registry.** For each step in order, spawn an **isolated subagent** told to:
   - follow that step's `SKILL.md` (read it — don't reinvent it),
   - read its listed inputs from `.factory/`,
   - write its output file(s),
   - return a one-line result + the output path **and its token usage**.
   The **reviewer MUST run isolated** (a fresh subagent, Tier A — never the builder). If the engineering
   step will call Claude/Anthropic, it loads the `claude-api` reference first.
   **After the relevant step, the orchestrator performs that stage's git/CI action** (from `github.md`,
   unless git was skipped at preflight):
   - **kickoff** → ensure the feature's GitHub Issue exists + label it `in-progress`; cut branch
     `feature/<id>-<slug>` from `main`. **All work lands on the branch — `main` is protected (ADR-008).**
   - **engineering** → commit the code + its new test(s) to the branch and **push** (push triggers CI
     automatically: lint + full regression suite).
   - **reviewer** → open a PR (`gh pr create`); the reviewer reads the diff, fresh eyes.
   - **qa gate** → **CI must be GREEN** (all tests pass) before the run may proceed to merge.

4. **Pause at HITL gates** (ask me, don't decide): architecture escalation / `30-options.md` pick ·
   review-finding disposition (fix / accept & log / defer) · risk acceptance (threat-model) · QA release
   call · any roadmap change.

5. **Record telemetry.** Create `.factory/runs/<id>-run-record.md` from `runs/RUN-RECORD-TEMPLATE.md`;
   capture each subagent's tokens there and append per-step rows to `.factory/dev-cost.md`.

6. **Wrap (delivery-pm).** Update `manifest.md` + `build-log.md`, flip the roadmap row to `delivered`,
   and finalize the run-record. **Then the orchestrator's wrap git action** (unless git was skipped):
   commit the doc updates **on the branch**, ensure CI is green, `gh pr merge --squash --delete-branch`,
   then **close the Issue** (`gh issue close <n> -c "delivered in <sha>"`).

7. **Enforce guardrails throughout.** Stop at 12 subagent calls or any hard-stop condition in
   `cost-guardrails.md`. A premium-model use needs a named reason in the run-record. **Never commit to
   `main` directly** — every change lands via a branch + green PR (ADR-008); if you ever find yourself on
   `main` with a feature `in progress`, branch first.

Report a short summary at the end: what shipped, per-step token/$ table, and total run cost.
