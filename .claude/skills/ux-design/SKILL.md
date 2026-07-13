---
name: {{PROJECT_SLUG}}-ux-design
description: For this project (reads PROJECT.md + manifest.md first). Improve the LOOK & FEEL (typography, spacing, colour, layout) without
  changing behaviour. Offers the human 2-3 visual directions to pick from, applies CSS-only changes
  (no framework, per ADR-001), then confirms in two lanes — behaviour preserved (re-run QA) +
  accessibility (contrast/focus/targets) are the skill's to prove; the aesthetic "does it look good"
  call is the HUMAN's. Reads manifest + ADRs + current index.html; writes 40-design-changes.md.
  NOT for the taste sign-off, brand identity, or anything needing a framework/new files.
---

# UX / Visual Design — {{PROJECT_NAME}}

**Goal.** Make the app feel modern and accessible while leaving every feature working exactly as before.
Propose the look; prove it's safe; hand the taste call to the human.

**Read first (memory):** `PROJECT.md`, `.factory/manifest.md` (live surfaces + decisions in force),
`.factory/decisions/001-vanilla-no-build.md` (CSS-only, no framework), the current `src/index.html`,
and the QA suites of shipped features (the behaviour that must survive). **Write:** the restyled
`src/index.html` (CSS only) and `.factory/features/<id>/40-design-changes.md` (direction chosen +
before/after + confirmation results).

## How it works (the flow)

1. Present **2-3 short visual directions** (name + one line each). Do NOT pick — the human picks.
2. On the human's pick, apply **CSS-only** changes. Touch markup/JS only if styling strictly needs a
   class hook, and never change behaviour.
3. Confirm in two lanes (below), then show **before/after in the browser** for the human's approval.

## Confirmation — two lanes

| Lane | Owner | Bar |
|------|-------|-----|
| Behaviour preserved | skill (objective) | Re-run every existing QA case; **all must still pass**. Zero regressions. |
| Accessibility | skill (objective) | Text contrast ≥ 4.5:1 · visible keyboard focus state · tap targets ≥ ~40px · not colour-alone · honour `prefers-reduced-motion` |
| Taste ("looks good/modern?") | **human** | Skill presents before/after; human approves. Skill never self-certifies aesthetics. |

## Decision rules

| ✅ DO | ❌ DON'T |
|-------|----------|
| Offer 2-3 directions and let the human choose | Impose one look as "the modern one" |
| Keep it CSS-only, inline, no dependency (ADR-001) | Add a CSS framework, CDN, font URL, or build step |
| Preserve all behaviour; re-run QA and report it | Ship a restyle without re-running the feature tests |
| Meet the accessibility bar and state the contrast numbers | Claim "accessible" without checking contrast/focus |
| Record the chosen direction + before/after in 40-design-changes.md | Leave no trace of what changed or why |

**Hand back to a human, never decide:** the aesthetic sign-off (does it look good) · brand/identity ·
anything needing a framework or new files (that needs a superseding ADR via the architecture skill).
**Stop-and-ask when:** a look would require changing behaviour or breaking a feature · the accessibility
bar can't be met · the human hasn't picked a direction yet · a direction implies a dependency/framework.

## AI features (only if the feature involves an AI/model — else write "N/A: no AI")
For an AI feature, write **AI-aware acceptance criteria** — what the user sees when the model is unsure,
wrong, slow, or refuses — and surface the **feasibility verdict** ("does AI even belong here?") to the
human. The AI go/no-go is human-owned, not the skill's. _No AI today → N/A._

**How to check it's working.** Given a restyle request, present 2-3 directions; after a pick, produce a
CSS-only restyle where all existing QA cases still pass, the accessibility bar is met (numbers stated),
and `40-design-changes.md` records the direction + before/after + a human-approval line.

## Eval table
| # | Check | Input | Expected | Pass signal |
|---|-------|-------|----------|-------------|
| 1 | Behaviour preserved | restyled index.html | Every existing QA case still passes | 0 regressions |
| 2 | Accessibility floor | restyled index.html | Contrast ≥4.5:1, visible focus, targets ≥~40px | checklist all pass; numbers stated |
| 3 | Defers taste to human | "make it modern" | Presents directions + before/after; no self-certified "looks great" | explicit human sign-off recorded |
| 4 | No framework added | restyled index.html | CSS-only, no CDN/deps (ADR-001 upheld) | 0 external resources added |
