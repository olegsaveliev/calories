# Handoff Map — the pipeline

> The order skills run in for each feature, and what file each produces. Every output lands in
> `.factory/features/<id>/`. Each step reads the previous step's output PLUS the project `manifest.md`.
> "Installed?" tells you which steps this project actually has a skill for — no phantom steps.

| #   | Step         | Skill            | Installed?                  | Produces |
|-----|--------------|------------------|-----------------------------|----------|
| 0   | Kickoff      | `kickoff`        | ✅                          | `00-feature.md` (from a roadmap pick) + flips roadmap status |
| 1   | Opportunity  | `consulting-sme` | ⚪ optional (not installed)  | `10-opportunity-brief.md` — the business-case step; skip for a personal app, add if wanted |
| 2   | Spec         | `prod-ba`        | ✅                          | `20-stories-acs.md`, `20-prd.md` (+ AI Eval Card if AI in scope) |
| 3   | Architecture | `architecture`   | ✅ (conditional)            | `30-design.md` + ADRs; **`30-options.md`** (2–4 scored options + a recommended pick) when there's a real fork — run when a structural / hard-to-reverse choice is made |
| 4   | Design / UX  | `ux-design`      | ✅ (conditional)            | `40-design-changes.md` — run for look-&-feel or UX features |
| 5   | Build        | `engineering`    | ✅                          | code in `src/`, `50-build-notes.md` |
| 5.5 | Review       | `reviewer`       | ✅                          | `55-review.md` — **run in a fresh subagent (Tier A)**; findings go back to engineering |
| 6   | QA           | `qa`             | ✅                          | `60-test-cases.md` + results |
| 7   | Threat model | `threat-model`   | ✅ (conditional)            | `70-threats.md` — run when the attack surface changes or AI is in scope |
| —   | Data         | `data`           | ⛔ N/A                      | no data pipeline in a this project — not installed |
| —   | Ops          | `ops`            | ⛔ N/A                      | app opens as a local file; no deploy/infra — not installed |
| 10  | Wrap         | `delivery-pm`    | ✅                          | `99-status.md` + **updates `manifest.md`, appends `build-log.md`, appends a row to `dev-cost.md`** (+ runtime AI adoption/cost if the feature ships a model) |

**The memory rule:** steps 1–7 READ the manifest to inherit prior state. Step 10 WRITES the manifest +
build-log so the NEXT feature inherits this one.

## Running the pipeline
- **Lite subset** (trivial feature) = steps 0, 2, 5, 5.5, 6, 10.
- **Insert Step 3 (architecture)** when a feature makes a structural / hard-to-reverse choice (new
  data-model shape, a dependency, a security posture) — records an ADR if the choice clears its bar.
- **Insert Step 7 (threat-model)** when the attack surface changes (new storage / network / sensitive
  data) or any AI/model is in scope. Skip for cosmetic or pure-logic features.
- **Step 5.5 (Review) runs in isolation** — a fresh subagent given only the spec + finished code, never
  the build reasoning. Record the independence tier (A / Limited) in `55-review.md`.
- **Full run** for anything substantial.
- **Factory mode (metered, isolated):** instead of running steps inline, run each as a subagent per
  `subagent-registry.yaml` — see `RUN-PROTOCOL.md` + `cost-guardrails.md`. Costs more, but captures exact
  per-skill tokens in `dev-cost.md` and gives a bias-free review. **Scaffolded, not yet run.**

## AI features (dormant across skills until a model is in scope)
this project has **no AI today**. If an AI/model feature is ever added, these built-in checks activate:
- `prod-ba` → **AI Eval Card**: confidence threshold · refusal trigger · latency ceiling · fail-closed fallback.
- `ux-design` → **AI-aware acceptance criteria** + the **feasibility verdict** ("does AI belong here?", human-owned).
- `threat-model` → **OWASP-LLM Top-10 + lethal-trifecta** pass.
- `delivery-pm` → track **AI adoption + AI cost**.

## Bug flow (out-of-band, not a numbered step)
A bug can surface anytime (review, QA, post-ship). Handled by the `bugfix` skill (test-first) and logged
in `.factory/bugs.md`. Flow: log → reproduce → **failing test first** → minimal fix → prove (new test +
existing QA green) → close + build-log entry.
