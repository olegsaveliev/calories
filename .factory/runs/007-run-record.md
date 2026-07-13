# Run record — 007 Food ID + confidence (2026-07-13)

> One per factory run.

- **Feature:** 007 — Food ID + confidence (picked from roadmap.md)
- **Model(s):** default Opus for reasoning (architecture, reviewer, threat-model); Sonnet for build/spec/wrap; Haiku for mechanical (kickoff, qa)
- **Steps run:** kickoff · prod-ba · architecture · engineering (ux-design folded in) · reviewer · qa · threat-model · delivery-pm
  (conditional `ux-design` FOLDED into engineering at the human's choice — the pill/tile visuals already exist in the Midnight Lime handoff; `architecture` + `threat-model` RUN — contract change + first model free-text on screen.)
- **Git mode:** full GitHub flow. Issue [#13](https://github.com/olegsaveliev/calories/issues/13), branch `feature/007-food-id-confidence`, PR [#14](https://github.com/olegsaveliev/calories/pull/14).

## Per-step cost (metered from each subagent)
| Step | Model | Tokens | Est. $ | Notes |
|------|-------|--------|--------|-------|
| kickoff | Haiku | 43,503 | ~$0.05 | mechanical — Haiku |
| prod-ba | Sonnet | 70,189 | ~$0.21 | spec — 6 stories, untrusted-text ACs |
| architecture | Opus | 84,229 | ~$0.63 | schema/contract change; verified vs claude-api ref; no fork, no ADR |
| engineering | Sonnet | 361,025 | ~$1.08 | expanded schema + validation + pill/tiles + ~40 tests |
| reviewer | Opus | 92,157 | ~$0.69 | Tier A — found the incomplete bidi reject-set |
| qa | Haiku | 48,792 | ~$0.06 | mechanical — Haiku; 51 cases; recommended Playwright |
| threat-model | Opus | 93,747 | ~$0.70 | AI free-text on screen → required OWASP-LLM pass |
| delivery-pm | Sonnet | 144,332 | ~$0.43 | wrap; self-metered |
| **Total** | — | **~937,974** | **~$3.9** | 8 subagent calls |

_Est. $ rough — Opus $15/$75, Sonnet $3/$15 (intro), Haiku $1/$5 per MTok, blended; illustrative, not billed._

## HITL decisions
- **Plan** → human chose: fold ux-design into engineering; keep threat-model; **include the item-count tile** (beyond the roadmap one-liner's dish-name + confidence).
- **Architecture** → no options fork (confidence source settled; reject-vs-truncate forced by R15 precedent); no new ADR (additive contract, follows 002).
- **Review disposition** → **F1+F2 (incomplete bidi/isolate/separator reject-set) DEFERRED** → follow-up 009; **F3 (max_tokens untested + build-note/comment inaccuracy) + F4 (render behaviourally untested) + F5 (client-bound nit) ACCEPTED & logged**. (Orchestrator corrected the false test-claim in `50-build-notes.md` AND the `src/vision.js` comment.)
- **QA release call** → **SHIP NOW**; Playwright for the new-field render paths folded into existing **008**.
- **Threat-model risk acceptance** → **ACCEPT & LOG all for the localhost prototype** under the existing 'resolve before exposure beyond localhost' gate: R18 (High, overreliance — self-reported confidence), R16 (Med, injection now shows readable text; contained by textContent — **flagged as a pre-condition on 006**), R17 (Low, deferred bidi gap → 009), R19 (Low, max_tokens raise on carried cost-DoS R9). Carried 002 R9/R1/R10 unchanged.

## Guardrail status
- Subagent calls: **8** / 12 cap — under cap.
- Premium-model (Opus) uses: 3 (architecture, reviewer, threat-model) — each a named reasoning/security step; reasons recorded. No premium polish.
- Reviewer isolation: **held** — fresh Tier-A subagent, never the builder.
- Stops triggered: none.

## Outcome
- **Delivered** · roadmap 007 → **delivered**; follow-ups queued: **009** (dish-name spoofing-char hardening, issue #15) + Playwright folded into **008**; R16 pre-condition recorded on **006** · manifest updated (v0.4.0) · dev-cost.md updated: yes · this run-record: complete.
- Merged via squash PR #14 into protected `main`; issue #13 closed with the delivered SHA.
- **Live-verified:** the human confirmed a real photo returned "95 calories" on the running app (dev key now has credit). Reminder logged: the dev server must be RESTARTED to pick up server/vision code changes (Node caches imports; only index.html is re-read per request).
