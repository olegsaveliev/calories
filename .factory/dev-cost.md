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
