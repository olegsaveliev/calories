# Dev cost — per-step token usage (factory runs)

> Each isolated subagent reports its token usage on completion → one row here. Lets you see the real
> cost of each skill/step per feature. Only factory runs (`/factory-run`) produce these; inline runs don't self-meter.

| Date | Feature | Step (skill) | Model | Tokens | Notes |
|------|---------|--------------|-------|--------|-------|
| 2026-07-13 | 001 | kickoff | Haiku | 15,581 | brief + roadmap flip |
| 2026-07-13 | 001 | prod-ba | Sonnet | 18,224 | 2 stories, ACs + PRD |
| 2026-07-13 | 001 | architecture | Opus | 24,273 | first server-endpoint structural + upload-transport call; ADR-002 (proposed) |
| 2026-07-13 | 001 | engineering | Sonnet | 36,174 | server.js + index.html + upload.test.js; lint + 11 tests green |
| 2026-07-13 | 001 | reviewer | Opus | 35,238 | isolated Tier-A review; 0 blockers/0 majors/2 minors/3 nits |
| 2026-07-13 | 001 | qa | Haiku | 25,669 | 18 test cases (8 automated); test-tier trigger rule added |
| 2026-07-13 | 001 | threat-model | Opus | 33,020 | STRIDE over new upload surface; 8 risks (2H/3M/3L); OWASP-LLM N/A |
| 2026-07-13 | 001 | delivery-pm | Sonnet | 47,201 | wrap: manifest v0.1.0 + build-log + dev-cost + roadmap→delivered |
| 2026-07-13 | 001 | **TOTAL** | — | **235,380** | 8 subagents (metered); orchestrator tokens not included |
| 2026-07-13 | 002 | kickoff | Haiku | 22,226 | brief + roadmap flip |
| 2026-07-13 | 002 | prod-ba | Sonnet | 37,919 | 3 stories (incl. AI Eval Card), ACs + PRD |
| 2026-07-13 | 002 | architecture | Opus | 248,494 | vision-call design + 30-options.md (3-way model scoring); no new ADR |
| 2026-07-13 | 002 | engineering (build) | Sonnet | 295,458 | vision.js + server.js/index.html changes + vision.test.js + upload.test.js extension; 37 tests green |
| 2026-07-13 | 002 | engineering (M1 review fix) | Sonnet | 67,505 | explicit `thinking:{type:"disabled"}` fix + request-shape test |
| 2026-07-13 | 002 | engineering (R9/R10/R12/R15 fixes) | Sonnet | 150,379 | rate-limit.js + strip-metadata.js + .gitignore + plausibility band; 70 tests green |
| 2026-07-13 | 002 | reviewer (build) | Opus | 269,414 | isolated Tier-A review; 1 major (M1) + 2 minor |
| 2026-07-13 | 002 | qa | Haiku | 48,198 | 13 test cases across 3 stories; Playwright tier recommended |
| 2026-07-13 | 002 | threat-model | Opus | 69,011 | STRIDE + OWASP-LLM + trifecta pass over new vision/egress surface; 13 open risks (5H/3M/5L) |
| 2026-07-13 | 002 | reviewer-2 (security fixes) | Opus | 97,507 | isolated Tier-A adversarial review of R9/R10/R12/R15 fixes; 2 major (F1, F2) + 4 minor, executed probes |
| 2026-07-13 | 002 | delivery-pm | Sonnet | ~90,000 (est.) | wrap: 99-status.md + manifest v0.2.0 + build-log + dev-cost; not precisely self-metered, estimated from context volume (read 5 large docs incl. 70-threats.md + both reviews) |
| 2026-07-13 | 002 | **TOTAL** | — | **~1,396,000** | 11 subagents (10 metered + 1 estimated); orchestrator tokens not included |
| 2026-07-13 | 003 | kickoff | Haiku | 30,697 | brief + roadmap flip |
| 2026-07-13 | 003 | prod-ba | Sonnet | 49,474 | 8 stories, ACs + PRD; scope confirmed (007 fields neutralized, not faked) |
| 2026-07-13 | 003 | architecture | Opus | 57,010 | confirmed ADR-001/ADR-002 hold unchanged; no new ADR; approach note only |
| 2026-07-13 | 003 | engineering | Sonnet | 111,120 | full `src/index.html` rewrite (Pick+Result, 5-state machine) + upload.test.js shape-assertion extension; 73 tests green |
| 2026-07-13 | 003 | ux-design | Sonnet | 88,795 | fidelity check vs. handoff tokens; fixed a real AA contrast fail + a border-token mismatch; added prefers-reduced-motion guard |
| 2026-07-13 | 003 | reviewer | Opus | 76,306 | isolated Tier-A review; 0 major, 1 minor (F1 no client timeout) + 2 nits |
| 2026-07-13 | 003 | qa | Haiku | 48,415 | risk-driven test cases; 24-case Playwright tier specified, not implemented this run |
| 2026-07-13 | 003 | delivery-pm | Sonnet | ~55,000 (est.) | wrap: 99-status.md + manifest v0.3.0 + build-log + dev-cost; not precisely self-metered, estimated from context volume (read the full feature folder incl. 55-review.md + 60-test-cases.md + 40-design-changes.md) |
| 2026-07-13 | 003 | **TOTAL** | — | **~516,800** | 8 subagents (7 metered + 1 estimated); orchestrator tokens not included |

**Running comparison across features:** 001 ≈235k tokens (8 subagents, new service from scratch) →
002 ≈1.40M tokens (11 subagents, vision-model integration + 2 rounds of security-driven fixes/re-review
— by far the most expensive feature so far) → 003 ≈517k tokens (8 subagents, frontend-only visual
rebuild — roughly a third of 002's cost, consistent with "no server/API change, no new ADR, single
review pass with 0 majors").
