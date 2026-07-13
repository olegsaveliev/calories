# Run record — 003 Redesign ("Midnight Lime" UI rebuild) (2026-07-13)

> One per factory run.

- **Feature:** 003 — Redesign (picked from roadmap.md)
- **Model(s):** default Opus for reasoning (architecture, reviewer); Sonnet for build/spec/design/wrap; Haiku for mechanical (kickoff, qa)
- **Steps run:** kickoff · prod-ba · architecture · engineering · **ux-design** · reviewer · qa · delivery-pm
  (conditional `threat-model` skipped — no new attack surface or AI; same vision endpoint/egress, frontend-only. `ux-design` RUN as its own step at the human's request.)
- **Git mode:** full GitHub flow (git repo + `gh` authenticated). Issue [#8](https://github.com/olegsaveliev/calories/issues/8), branch `feature/003-redesign`, PR [#9](https://github.com/olegsaveliev/calories/pull/9).

## Per-step cost (metered from each subagent)
| Step | Model | Tokens | Est. $ | Notes |
|------|-------|--------|--------|-------|
| kickoff | Haiku | 30,697 | ~$0.04 | mechanical — Haiku |
| prod-ba | Sonnet | 49,474 | ~$0.15 | spec — 2-screen flow + state machine |
| architecture | Opus | 57,010 | ~$0.43 | structural (2 screens/1 doc) + reaffirm ADR-001; no fork, no new ADR |
| engineering | Sonnet | 111,120 | ~$0.33 | frontend rebuild of index.html; server untouched |
| ux-design | Sonnet | 88,795 | ~$0.27 | visual-fidelity + a11y pass; fixed a real AA contrast failure |
| reviewer | Opus | 76,306 | ~$0.57 | Tier A — isolated, bias-free |
| qa | Haiku | 48,415 | ~$0.06 | mechanical — Haiku; recommended Playwright tier |
| delivery-pm | Sonnet | 95,791 | ~$0.29 | wrap; self-metered |
| **Total** | — | **~557,600** | **~$2.1** | 8 subagent calls |

_Est. $ rough — Opus $15/$75, Sonnet $3/$15 (intro), Haiku $1/$5 per MTok, blended on the metered totals; illustrative, not billed._

## HITL decisions
- **Result data scope (pre-spec)** → human chose **visual-only**: wire the total-calorie number; food-name/confidence/items/± are feature 007 → render neutral ("—") or omit, NEVER faked.
- **Plan** → human chose **ux-design as its own step** (not folded into engineering); threat-model skipped; vanilla per ADR-001.
- **Architecture** → no options fork (framework loses on every axis; vanilla holds); no new ADR.
- **Review disposition** → **F1 (client-side timeout, minor) DEFERRED** to follow-up 008; **F2 (415 generic copy) + F3 (benign ARIA) ACCEPTED & logged**.
- **QA release call** → **SHIP NOW**; queue the Playwright browser-E2E tier as a follow-up. → roadmap **008** added (Browser E2E + estimate timeout, incl. deferred F1).

## Guardrail status
- Subagent calls: **8** / 12 cap — under cap.
- Premium-model (Opus) uses: 2 (architecture, reviewer) — each a named reasoning/bias-free step; reasons recorded. No premium polish.
- Reviewer isolation: **held** — fresh Tier-A subagent, never the builder.
- Stops triggered: none.

## Outcome
- **Delivered** · roadmap 003 → **delivered**; follow-up **008** queued · manifest updated (v0.3.0) · dev-cost.md updated: yes · this run-record: complete.
- Merged via squash PR #9 into protected `main`; issue #8 closed with the delivered SHA.
- **Caveat:** live happy-path "~N calories" render still needs a topped-up `ANTHROPIC_API_KEY`; fail-closed paths verified. Not a code defect.
- **Known debt carried:** browser-E2E gap (suite is static-HTML only) — tracked in 008; 002's localhost/security limitations untouched by this frontend-only change.
