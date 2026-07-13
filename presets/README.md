# Stack presets

The factory pipeline (skills, memory, git flow) is **stack-agnostic**. Only two things are stack-specific:
the **CI workflow** and a few **rules in the `engineering` skill** (language, test runner, "how we build").

A **preset** bundles those. `/setup` asks your stack, then applies the matching preset:
- copies `ci.yml` → `.github/workflows/ci.yml`
- installs the stack's test/lint config + a starter test
- folds the preset's **engineering rules** into `.claude/skills/engineering/SKILL.md` (for you to confirm)

| Preset | Stack | Lint | Tests | CI |
|--------|-------|------|-------|-----|
| `web-vanilla` *(default, active)* | one `index.html`, plain JS, no build | `tools/lint.mjs` (syntax + HTML) | Playwright | on push/PR |
| `node` | Node/TypeScript app or lib | ESLint | Vitest/Jest | on push/PR |
| `python` | Python app/CLI/API | Ruff | pytest | on push/PR |

**Adding your own preset:** copy a folder here, edit its `ci.yml` + `preset.md` (the engineering rules),
and point `/setup` at it. Nothing else in the factory changes.

> **Honest note:** applying a preset gets you a working CI + the right engineering rules, but the *first*
> real test for your stack is yours to write — the starter test only proves the toolchain is green.
