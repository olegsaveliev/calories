# Run record — 002 Calorie estimate (2026-07-13)

> One per factory run.

- **Feature:** 002 — Calorie estimate (picked from roadmap.md)
- **Model(s):** default Opus for reasoning steps; Sonnet for build/spec; Haiku for mechanical steps
- **Steps run:** kickoff · prod-ba · architecture · engineering · reviewer · qa · threat-model · reviewer-2 · delivery-pm
  (conditional `ux-design` skipped — no look-&-feel work; `architecture` + `threat-model` RUN because this is the app's first vision-model integration + first outbound data flow)
- **Git mode:** full GitHub flow (git repo + `gh` authenticated at preflight). Issue [#4](https://github.com/olegsaveliev/calories/issues/4), branch `feature/002-calorie-estimate`, PR [#5](https://github.com/olegsaveliev/calories/pull/5).

## Per-step cost (metered from each subagent)
| Step | Model | Tokens | Est. $ | Notes |
|------|-------|--------|--------|-------|
| kickoff | Haiku | 22,226 | ~$0.03 | mechanical — Haiku |
| prod-ba | Sonnet | 37,919 | ~$0.11 | spec |
| architecture | Opus | 248,494 | ~$1.86 | first vision integration; loaded claude-api ref; produced options fork |
| engineering (build) | Sonnet | 295,458 | ~$0.89 | initial build + tests |
| engineering (M1 review fix) | Sonnet | 67,505 | ~$0.20 | disable thinking on Sonnet 5 |
| engineering (R9/R10/R12/R15 fixes) | Sonnet | 150,379 | ~$0.45 | threat-model fixes |
| reviewer (build) | Opus | 269,414 | ~$2.02 | Tier A — bias-free requirement |
| qa | Haiku | 48,198 | ~$0.06 | mechanical — Haiku |
| threat-model | Opus | 69,011 | ~$0.52 | AI in scope → OWASP-LLM pass required |
| reviewer-2 (security fixes) | Opus | 97,507 | ~$0.73 | 2nd Tier A pass over hand-rolled security code |
| delivery-pm | Sonnet | 108,989 | ~$0.33 | wrap; self-metered |
| **Total** | — | **~1,415,100** | **~$7.2** | 11 subagent interactions (9 distinct spawns + 2 engineering resumes) |

_Est. $ are rough — Opus $15/$75, Sonnet $3/$15 (intro), Haiku $1/$5 per MTok, blended on the metered totals; illustrative, not billed._

## HITL decisions
- **Architecture options fork (30-options.md)** → human picked **`claude-sonnet-5`** (over Haiku 4.5 / Opus 4.8) — architect's recommendation; near-Opus vision at ~half the cost, intro pricing.
- **Review finding M1 (major)** → **FIX** before merge (thinking omitted → adaptive thinking on Sonnet 5 → 256-tok budget exhausted → valid photos fail closed). Fixed + pushed, CI green.
- **Review minors m2/m3** → **ACCEPT & LOG**.
- **Threat-model risk gate** → human **BLOCKED the merge**, required R9 + R10 fixed before ship (not accepted for localhost). Also fixed R12 + R15. All landed.
- **Scope change (GIF/WebP → 415, JPEG+PNG only)** → **ACCEPTED** (can't strip GIF/WebP metadata dependency-free). Logged as a known limitation.
- **Second review (reviewer-2) — 2 majors (F1 R10-partial, F2 rate-limit fairness) + 4 minors (F3–F6)** → human **ACCEPTED & LOGGED all**, folded under the existing "must-resolve-before-exposure-beyond-localhost" hard gate. R10 is only partially closed; recorded honestly in the manifest.

## Guardrail status
- Subagent calls: **9 distinct spawns (+2 engineering resumes) = 11** / 12 cap — under cap.
- Premium-model (Opus) uses: 4 (architecture, reviewer, threat-model, reviewer-2) — each a named reasoning/bias-free step; reasons recorded above. No premium polish.
- Reviewer isolation: **held** — both review passes ran as fresh Tier-A subagents, never the builder.
- Stops triggered: none (block-and-fix at the threat gate was a HITL decision, not a guardrail stop).

## Outcome
- **Delivered** · roadmap row 002 → **delivered** · manifest updated (v0.2.0) · dev-cost.md updated: yes · this run-record: complete.
- Merged via squash PR #5 into protected `main`; issue #4 closed with the delivered SHA.
- **Caveat:** happy-path "~N calories" render covered by tests (API mocked) but not demoed live — the dev `ANTHROPIC_API_KEY` hit "credit balance too low" during verification. Not a code defect.
