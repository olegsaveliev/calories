# Onboarding a new project — the plan

This is the *what & why* behind onboarding. The **`/setup`** command executes it; **`./setup.sh`** does the
mechanical bits. You only need one of the two paths below.

## Fastest path — `./setup.sh` asks you
1. Run **`./setup.sh`**. It:
   - **asks you** the questions (name, slug, one-liner, non-goals, stack preset, first feature, GitHub) and writes `project-config.yaml`,
   - **auto-installs prerequisites** (git / node / python / gh via brew/apt/dnf),
   - does `git init` + placeholder replacement + installs dev tooling.
2. Open Claude Code, run **`/setup`** — reads your answers and finishes: writes `PROJECT.md`, applies the
   stack preset, seeds the roadmap, and (if enabled) wires GitHub.
3. Start building: **`/factory-run 001`**.

## Already know the config?
Pre-fill `project-config.yaml`, then run **`./setup.sh --yes`** to skip the questions.

## What onboarding produces (either path)
| Step | Result |
|------|--------|
| Personalise | `Calories` / `calories` replaced everywhere; `PROJECT.md` written |
| Stack preset | `presets/<preset>/ci.yml` → `.github/workflows/ci.yml`; engineering rules set for your stack |
| Roadmap | your first features seeded in `.factory/roadmap.md` (all `queued`) |
| Memory | blank-state `manifest.md` (v0.0.0) + empty `build-log` / `dev-cost` / `bugs` / `features/` |
| GitHub *(optional)* | repo wired, CI on push/PR, Issues per feature, branch protection |
| Verify | lint + tests run green; you get the "ready → `/factory-run 001`" hand-off |

## What each part does (so nothing is a mystery)
- **`PROJECT.md`** — north star; every feature is checked against it.
- **`.factory/`** — the memory: `manifest.md` (read first / written last), `roadmap.md` (the board),
  `build-log.md` (history), `decisions/` (ADRs), `bugs.md`, `features/<id>/` (per-feature spec chain),
  `handoff-map.md` + `RUN-PROTOCOL.md` + `subagent-registry.yaml` (the pipeline), `github.md` (git flow).
- **`.claude/skills/`** — the 10 role skills (kickoff · prod-ba · architecture · ux-design · engineering ·
  reviewer · qa · threat-model · delivery-pm · bugfix).
- **`.claude/commands/`** — `/setup` (onboard) and `/factory-run` (build a feature).
- **`presets/`** — stack bundles (web-vanilla / node / python) the setup applies.

## After onboarding
- Build a feature: **`/factory-run <id>`** (metered, isolated) — or trigger skills manually.
- Fix a bug: **`/bugfix <BUG-ID>`** (test-first).
- Everything flows: branch → commit → CI → PR → green → merge → wrap, mirrored to Issues.
