---
name: calories-bugfix
description: For this project (reads PROJECT.md + manifest.md first). Handle a reported bug as first-class work — log it in .factory/bugs.md,
  reproduce it, write a FAILING test first, fix minimally, prove the test now passes AND nothing else
  regressed, then update memory. Owns bugs.md. Uses the qa + engineering skills for the test + fix.
  NOT for deciding severity/ship, or fixing beyond the reported bug.
---

# Bugfix — Calories (test-first bug flow, owns `bugs.md`)

**Goal.** Turn "it's broken" into a tracked, reproduced, test-guarded fix that can never silently
come back — and leave a trail in memory.

**Read:** `.factory/manifest.md`, `.factory/bugs.md`, the relevant feature folder + `src/`.
**Write:** `.factory/bugs.md` (the register), a regression test, the fix in `src/`, and a build-log entry.

## The flow (in order — don't skip)
1. **Log** — add a row to `bugs.md` (status `open`): what's wrong, where seen, severity (proposed).
2. **Reproduce** — confirm the bad behaviour with a concrete input. If you can't reproduce, stop and ask.
3. **Failing test FIRST** — add a QA case that FAILS on today's code (proves the bug is real + will
   catch a relapse). Status → `fixing`.
4. **Fix minimally** — smallest change that makes that test pass. Nothing beyond the bug.
5. **Prove** — the new test passes AND the feature's existing QA cases still pass (no new regression).
6. **Close** — `bugs.md` status → `fixed` (link the test + the fix); append a build-log entry; if the
   bug exposed a wrong assumption, correct the manifest.

## Decision rules

| ✅ DO | ❌ DON'T |
|-------|----------|
| Write the failing test BEFORE the fix | Fix first and backfill a test that never failed |
| Keep the fix to the reported bug only | Refactor or add features while "in there" |
| Re-run the whole feature's QA after the fix | Close a bug on the one new test alone |
| Record repro + fix + test link in bugs.md | Mark fixed with no evidence trail |

**Escalate, never decide (human-owned):** severity / is-it-release-blocking · whether to ship the fix ·
accepting a bug as "won't fix".
**Stop-and-ask when:** the bug can't be reproduced · the fix needs an architecture change or a new
dependency (route via architecture skill) · the fix would break a shipped feature · the bug reveals a
spec/ADR conflict.

**How to check it's working.** For a reported bug: a `bugs.md` row that travels open→fixing→fixed, a
regression test that failed before and passes after, existing QA still green, and a build-log entry.

## Eval table
| # | Check | Input | Expected | Pass signal |
|---|-------|-------|----------|-------------|
| 1 | Test-first | a reported bug | A test that failed on old code, passes on fixed code | test exists; failed-before documented |
| 2 | No scope creep | a one-line bug | Fix touches only what the bug needs | diff limited to the bug |
| 3 | Tracked in memory | after fix | bugs.md row = fixed with links; build-log entry added | register + log updated |
