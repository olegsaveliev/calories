# Manifest — CURRENT STATE of Calories

> ★ Every skill/agent reads this FIRST, before doing anything. It answers:
> "What already exists? What must I not break?"
> The LAST step of every feature run (delivery-pm / wrap) updates this file.

**Last updated:** 2026-07-13 (onboarded via /setup)
**Current version:** 0.0.0

## Features that exist right now
_None yet. Each delivered feature adds a row (id · name · status · shipped · spec folder)._

| ID | Feature | Status | Shipped | Spec folder |
|----|---------|--------|---------|-------------|
| —  | —       | —      | —       | —           |

## Live surfaces (files that make up the running app)
_No feature shipped yet. Starter scaffold only:_
- `src/index.html` — placeholder frontend (replaced by feature 001).
- `src/calories.js` — starter module (`formatCalories`); proves the toolchain, extended by real features.
- `tests/calories.test.js` — starter Vitest suite (grows per feature).

## Data model
_What the core objects look like. Empty until the first feature defines them._

## Key decisions in force
_(one-liner here → full reasoning + rejected alternatives in `decisions/`)_
- **ADR-001** — Calories is ONE Node service: serves the frontend + owns the only vision-model API route;
  the model API key is server-side only (never in client code / committed files). No framework or build
  tool without a new ADR. → `decisions/001-node-service-stack.md`

## Known limitations / tech debt
_None recorded yet._
