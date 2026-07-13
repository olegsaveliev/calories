# Run record — 001 Initial prototype (2026-07-13)

> One per factory run. Filled as the run proceeds.

- **Feature:** 001 — Initial prototype (upload a picture of food → Node server receives it) — picked from roadmap.md
- **Model(s):** default Sonnet for build/spec/wrap; **Haiku** for kickoff + qa; **Opus** for architecture, reviewer, threat-model (reasoning-heavy)
- **Steps run:** kickoff · prod-ba · architecture · engineering · reviewer · qa · threat-model · delivery-pm (conditionals skipped: ux-design)
- **Git mode:** full GitHub flow — branch `feature/001-initial-prototype`, PR into protected `main`, CI must be green, squash-merge, close #1.

## Per-step cost (metered from each subagent)
| Step | Model | Tokens | Est. $ | Notes |
|------|-------|--------|--------|-------|
| kickoff | Haiku | 15,581 | ~$0.03 | brief + roadmap flip |
| prod-ba | Sonnet | 18,224 | ~$0.10 | 2 stories, ACs + PRD |
| architecture | Opus | 24,273 | ~$0.40 | named premium: first server-endpoint structural + upload-transport/dependency call; ADR-002 (proposed) |
| engineering | Sonnet | | | |
| reviewer | Opus | | | named premium: bias-free isolated review (Tier A) |
| qa | Haiku | | | |
| threat-model | Opus | | | named premium: STRIDE over new upload attack surface |
| delivery-pm | Sonnet | | | |
| **Total** | | | | |

## HITL decisions
- Scope: server included in 001 (human directive) · ux-design skipped (design attached later) · threat-model KEPT (human: "do not skip").
- Architecture 30-options pick → **Option B raw binary POST** (recommended); ADR-002 flipped proposed → accepted.

## Guardrail status
- Subagent calls: 0 / 12 · premium-model uses: 3 planned (architecture, reviewer, threat-model — reasons recorded above) · stops triggered: none

## Outcome
- _in progress_ · roadmap row → in progress · dev-cost.md updated: pending
