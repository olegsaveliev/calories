# ADR-001 — Build Calories as a single Node service (frontend + vision-model API route)

- **Status:** accepted
- **Date:** 2026-07-13

## Context
Calories estimates a meal's calories from a photo, which requires calling a vision model with a secret
API key. A key cannot live in client-only code without being exposed. We need somewhere server-side to
hold it while still shipping a browser UI. Chosen at `/setup` from `project-config.yaml`.

## Decision
Use the **node** preset: one Node (ESM) service that serves the browser frontend **and** hosts the single
API route that calls the vision model. ESLint for lint, Vitest for tests. No framework or build tool.

## Alternatives considered
1. **web-vanilla (static `index.html`, no backend)** — rejected: cannot safely hold the model API key, so
   the core calorie-estimation feature would immediately force an architecture escalation + preset switch.
2. **python** — rejected: strong for the model backend, but the product is browser-facing UI-first; keeping
   frontend and the one API route in a single Node service is the smaller, boring whole.

## Consequences
- **Positive:** the model key stays server-side from day one; frontend + API live in one service, one language.
- **Negative:** we run a server (not a static file), so deploys need a Node host, not just static hosting.

## Agent-readable summary
Calories is ONE Node service: it serves the frontend and owns the only vision-model API route. The model
API key is server-side only — do NOT put it in client code or a committed file, and do NOT add a framework
or build tool without a new ADR.
