# Onboarding a new project — the plan

This is the *what & why* behind onboarding. The **`/setup`** command executes it; **`./setup.sh`** does the
mechanical bits. You only need one of the two paths below.

## Fastest path (no questions) — config file
1. Edit **`project-config.yaml`** (name, slug, one-liner, non-goals, stack preset, first features, GitHub).
2. Run **`./setup.sh <slug>`** — git init, placeholder replacement, install dev tooling.
3. Open Claude Code, run **`/setup`** — it reads your config and finishes: writes `PROJECT.md`, applies the
   stack preset, seeds the roadmap, and (if enabled) wires GitHub. No interview needed.
4. Start building: **`/factory-run 001`**.

## Guided path — let it interview you
Skip the config. Just run **`/setup`** in Claude Code; it asks ~5 questions and scaffolds everything.

## What onboarding produces (either path)
| Step | Result |
|------|--------|
| Personalise | `{{PROJECT_NAME}}` / `{{PROJECT_SLUG}}` replaced everywhere; `PROJECT.md` written |
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
