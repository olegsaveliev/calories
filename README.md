# AI Factory — a reusable "software factory" template

Clone this, run one command, and you have a working assembly line for building software with AI:
role **skills** (spec → design → build → review → QA → wrap), a file-based **memory** that compounds
across features, and an enforced **git / CI / Issues** flow. Point it at *any* project and start shipping.

> **New here? Onboarding takes ~2 minutes.** Jump to **[Quick start](#quick-start)**.

---

## Quick start

**Prerequisites:** [Claude Code](https://claude.com/claude-code), `git`, and (optional) the GitHub CLI `gh`
for the git/Issues flow. Node or Python only if your stack preset needs it.

### The 2-minute path (no questions)
1. **Fill `project-config.yaml`** — name, one-liner, non-goals, stack (`web-vanilla` / `node` / `python`), first features, GitHub.
2. **Run the mechanical setup:**
   ```
   ./setup.sh my-project
   ```
3. **In Claude Code, finish onboarding:**
   ```
   /setup
   ```
   It reads your config → writes `PROJECT.md`, applies your stack, seeds the roadmap, and (if enabled) wires GitHub.
4. **Build your first feature:**
   ```
   /factory-run 001
   ```

Prefer to be asked instead of filling a file? Just run `/setup` — it interviews you. Full detail in **[SETUP.md](SETUP.md)**.

---

## How it works (the 30-second model)

A **feature** travels down a **pipeline**. Each stage is a **skill**. Every stage **reads the memory first**
(`.factory/manifest.md`) and the **last stage writes it back** — so feature N+1 "sees" feature N. Code + tests
land through **branch → PR → CI → merge**, enforced by GitHub.

```
roadmap (pick) ─► kickoff ─► prod-ba ─► [architecture] ─► [ux-design] ─► engineering
                                                                              │
        manifest updated ◄─ delivery-pm(wrap) ◄─ qa ◄─ reviewer ◄────────────┘
        (+ PR merged, Issue closed)              [threat-model runs when AI/attack-surface changes]
```

## Two ways to build · one way to fix
- **Feature (metered, isolated):** `/factory-run <id>` — each step a subagent, token cost recorded, review bias-free.
- **Feature (manual):** trigger a skill inline (`/prod-ba`, `/engineering`, …). Same recipes, cheaper, no metering.
- **Bug:** `/bugfix <BUG-ID>` — out-of-band, **test-first**. (Bugs live in `.factory/bugs.md`, not the roadmap.)

## The 10 skills
`kickoff` · `prod-ba` · `architecture` · `ux-design` · `engineering` · `reviewer` (fresh, bias-free) ·
`qa` · `threat-model` · `delivery-pm` (writes the memory) · `bugfix` (test-first). Each is one `SKILL.md`
in `.claude/skills/` — the single source of truth for that recipe.

## Folder map
```
├── README.md              ← you are here
├── SETUP.md               ← onboarding plan (what /setup does)
├── project-config.yaml    ← fill this in, then /setup
├── setup.sh               ← mechanical setup (git init, placeholders, deps)
├── PROJECT.md             ← your north star (what the app is / isn't)
├── src/                   ← your app (a starter placeholder ships here)
├── presets/               ← stack bundles: web-vanilla · node · python
├── .factory/              ← THE MEMORY / factory brain
│   ├── manifest.md          current state (read first, written last)
│   ├── roadmap.md           the feature board (mirrors GitHub Issues)
│   ├── build-log.md         append-only history
│   ├── handoff-map.md       the pipeline: step order + outputs
│   ├── RUN-PROTOCOL.md      how a metered factory run works
│   ├── github.md            per-stage git/CI/Issues flow
│   ├── subagent-registry.yaml  machine-readable pipeline
│   ├── cost-guardrails.md   call caps · model tiers · human gates
│   ├── decisions/           ADRs (+ TEMPLATE)
│   ├── bugs.md · dev-cost.md · features/ · runs/
├── .claude/
│   ├── skills/<name>/SKILL.md   the 10 recipes
│   └── commands/                /setup and /factory-run
├── .github/workflows/ci.yml + tests/ + tools/  (from the active stack preset)
```

## Make it a template repo (so others onboard in one click)
Push this to GitHub and mark it a **Template repository** (Settings → *Template repository*). Then anyone
clicks **"Use this template"**, runs `./setup.sh <slug>` + `/setup`, and they're building in minutes.

---

*The pipeline, memory, and git flow are stack-agnostic; only the `engineering` skill + CI are stack-specific,
and the `presets/` handle that. See `SETUP.md` to onboard, `.factory/RUN-PROTOCOL.md` to build.*
