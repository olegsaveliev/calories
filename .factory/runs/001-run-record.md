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
| engineering | Sonnet | 36,174 | ~$0.22 | server.js + index.html + upload.test.js; lint + 11 tests green |
| reviewer | Opus | 35,238 | ~$0.55 | named premium: bias-free isolated review (Tier A); 0 blockers/0 majors/2 minors/3 nits |
| qa | Haiku | 25,669 | ~$0.05 | 18 test cases (8 automated); test-tier trigger rule added to qa skill |
| threat-model | Opus | 33,020 | ~$0.50 | named premium: STRIDE over new upload surface; 8 risks (2H/3M/3L); OWASP-LLM N/A |
| delivery-pm | Sonnet | 47,201 | ~$0.28 | wrap: manifest v0.1.0, build-log, dev-cost, roadmap→delivered |
| **Total** | mixed | **235,380** | **~$2.1** | 8 subagents metered (orchestrator tokens not counted) |

## HITL decisions
- Scope: server included in 001 (human directive) · ux-design skipped (design attached later) · threat-model KEPT (human: "do not skip").
- Architecture 30-options pick → **Option B raw binary POST** (recommended); ADR-002 flipped proposed → accepted.
- Review disposition (0 blockers/0 majors) → **accept & log all**. M1/M2 (MIME allowlist) recorded as a known-limitation for the future vision-model route; N1–N3 accepted as prototype-acceptable.
- CI on branch feature/001-initial-prototype: **green** (`test` check passed on push + PR).
- Threat-model risk acceptance → **accept R1–R8 for the localhost prototype**, with recorded conditions: (a) resolve R1 (concurrency/aggregate memory cap) + R2 (request timeouts) before ANY exposure beyond localhost; (b) R3/M1/M2 MIME allowlist is a HARD pre-condition on the vision-model route. App tested by human — proceed to wrap.

## Guardrail status
- Subagent calls: **8 / 12** · premium-model uses: **3** (architecture, reviewer, threat-model — reasons recorded above) · stops triggered: none · reviewer ran isolated Tier-A ✓

## Outcome
- **delivered** · roadmap row 001 → delivered · manifest v0.1.0 · dev-cost.md updated: yes · PR #2 squash-merged, Issue #1 closed
