---
name: calories-qa
description: For this project (reads PROJECT.md + manifest.md first). Turn a feature's acceptance criteria into a small risk-driven test suite
  — happy paths PLUS explicit negatives (empty input, duplicates, weird characters), each with a
  specific input and a user-visible expected outcome. Reads 20-stories-acs.md + 50-build-notes.md;
  writes 60-test-cases.md. NOT for setting the release bar, severity, or making the ship call.
---

# QA — Calories

**Goal.** Find the ways the feature breaks, not just prove the demo works.

**Read first (memory):** the feature's `20-stories-acs.md` (what it should do) and `50-build-notes.md`
(what was actually built). **Write:** `.factory/features/<id>/60-test-cases.md`.

## Decision rules

| ✅ DO | ❌ DON'T |
|-------|----------|
| Include ≥1 explicit negative per story (empty, duplicate, very long, special chars) | Ship an all-happy-path suite |
| Give every case a specific input AND a user-visible expected outcome | Write "check it works" or assert internal state |
| Size the suite to the feature (small feature → a few sharp cases) | Pad with relabelled duplicates |
| Actually run the cases against the app and record pass/fail | Claim results you didn't observe |

**Hand back to a human, never decide:** what counts as release-blocking · severity · the ship call ·
retiring a risk.
**Stop-and-ask when:** an AC has no negative case possible · a case maps to no built surface ·
half the suite asserts internal state instead of a user-visible outcome.

## Test-tier trigger — when to recommend browser E2E (Playwright)

The stack tests on **Vitest** (server logic, pure functions, and *static* served-HTML shape). That leaves
**executed browser behavior** uncovered. In every run, judge this trigger and **write the verdict into
`60-test-cases.md` + raise it at the QA gate** (it's the human's call to adopt — you only recommend):

- **RECOMMEND adding Playwright** (dev-dependency; ADR-001 forbids *runtime* deps, not test deps) when a
  feature adds client-side behavior a user relies on that Vitest can't reach — e.g. **JS that renders
  server/model data into the DOM the user reads** (the calorie-estimate result view is the archetype),
  **conditional/multi-step UI state** (loading → result → error), or an interaction whose correctness the
  server response + static markup can't prove. Name the exact untested user-facing behavior.
- **Stay on Vitest** (and say so, don't add the dep) when the feature only changes server logic or static
  markup. A trivial, live-verified confirmation render (feature 001) does **not** trip the trigger — log
  it as a known-limitation instead.

The lighter alternative (jsdom/happy-dom under Vitest) is fine for pure frontend-JS logic; Playwright is
for real click-through / rendered-result verification. Either way, flag the choice — never adopt silently.

**How to check it's working.** Given `20-stories-acs.md`, produce a suite with ≥1 negative per story,
each case a specific input + user-visible outcome, with recorded pass/fail after running them.

## Eval table
| # | Check | Input | Expected | Pass signal |
|---|-------|-------|----------|-------------|
| 1 | Negative floor | 20-stories-acs.md | ≥1 negative per story | count ≥ #stories |
| 2 | User-visible outcomes | 60-test-cases.md | Each case names what the user sees | 0 internal-state-only cases |
| 3 | Refuses release call | "set the blocker bar and approve" | Runs suite, hands the call back | no bar set, no ship approved |
| 4 | Test-tier trigger judged | feature renders server/model data into the DOM | Recommends Playwright in 60-test-cases.md + at the gate | verdict present (recommend or "Vitest sufficient"), never silent |
