---
description: Onboard a NEW project onto the AI Factory — scaffold PROJECT.md, stack, roadmap, memory, and (optionally) GitHub.
argument-hint: (optional) path to a filled project-config.yaml
---

Onboard this repository as a fresh project on the **AI Factory**. Follow these steps exactly. Confirm the
plan with the user before any GitHub push. **Goal: get them from clone → ready-to-build with minimal friction.**

## 0. Get the answers
- If **`project-config.yaml` is filled in** (not the template defaults) → use it. **No questions.**
- Else → **interview** the user briefly (one message, all at once):
  1. Project name + one-liner (what it does, for whom)
  2. Primary user
  3. Non-goals (what it won't do yet)
  4. Stack preset: `web-vanilla` | `node` | `python`
  5. First 1–3 features (id + one-liner)
  6. GitHub: wire it now? remote URL? protect the branch?
  Then write their answers into `project-config.yaml` so it's recorded.

## 1. Personalise the template (mechanical — you may call `./setup.sh <slug>`)
- Replace `Calories` and `calories` everywhere: `PROJECT.md`, `.factory/manifest.md`,
  `src/`, `package.json`, and each `.claude/skills/*/SKILL.md` `name:` line.
- Write `PROJECT.md` from the config (what / who / non-goals / tech).

## 2. Apply the stack preset
- Read `presets/<preset>/preset.md`.
- Copy `presets/<preset>/ci.yml` → `.github/workflows/ci.yml`.
- Install that stack's test/lint config + starter test (web-vanilla is already active).
- Fold the preset's **engineering rules** into `.claude/skills/engineering/SKILL.md` — **show the user the diff and confirm.**

## 3. Seed the roadmap + reset memory
- Write `first_features` into `.factory/roadmap.md` (all `queued`).
- Confirm the memory is blank-state: `manifest.md` v0.0.0, empty `build-log.md` / `dev-cost.md` / `bugs.md` / `features/`.

## 4. GitHub (only if `github.enable: true`) — PAUSE for their login
- Confirm `gh auth status`. If not logged in, **ask them to run `gh auth login`** (you can't do it for them).
- `git init` (if needed), set `github.md`'s remote/branch, first commit, `git push -u origin <branch>`.
- Create an Issue per roadmap feature (label `feature`); record the mirror in `roadmap.md`.
- If `protect_branch: true`, enable branch protection (require a PR + the CI check). Note: needs a public repo or GitHub Pro.

## 5. Verify + hand off
- Run the stack's lint + tests locally (or in CI) → confirm **green**.
- Print a short summary + the next command: **`/factory-run 001`** (or `/factory-run <first id>`).
- Remind: features → `/factory-run <id>` · bugs → `/bugfix <BUG-ID>`.

## Guardrails
- Never push to GitHub or create issues without the user's confirmation.
- The stack retune (step 2) is a judgement call — **draft it and confirm**, don't silently guess.
- If anything conflicts with `PROJECT.md` non-goals later, the pipeline stops and asks (that's by design).
