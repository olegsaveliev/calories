# 002 — Calorie estimate · Options (HUMAN PICK)

**The one open fork:** which Anthropic vision model the `/upload` route calls to estimate calories.
Everything else in the design (`30-design.md`) is settled; this is the only decision that needs the human.

**Why it's a real fork, not a default:** this is the app's *first* vision call and its core, recurring,
paid operation — every estimate is one vision request. The tiers differ ~5× in price and in
vision/accuracy headroom, so the choice sets a cost-and-quality precedent worth recording. It is **not**
ADR-worthy either way: the call site is a single model-ID string, trivially reversible.

Model IDs and prices below are from the claude-api reference (cached 2026-06-24); IDs are exact — never
append a date suffix. Per-estimate cost is dominated by the **image** tokens (a food photo is roughly
~1.5–5K input tokens depending on resolution; prompt + JSON output add only ~250). Figures are ballpark
for one estimate.

| # | Option | Model ID | Price (in/out per MTok) | ~Cost / estimate | Value | Effort | Risk | Rationale |
|---|--------|----------|-------------------------|------------------|-------|--------|------|-----------|
| 1 | Cheapest | `claude-haiku-4-5` | $1.00 / $5.00 · 200K ctx | ~$0.002 | **M** | **L** | **M** | Vision-capable and by far the cheapest. Food ID is mainstream vision, but Haiku is the weakest tier — higher chance of shaky calorie estimates, which our fail-closed threshold turns into more "couldn't estimate" refusals rather than wrong numbers. Fine if cost/latency dominate. |
| 2 | **Balanced (recommended)** | `claude-sonnet-5` | $3.00 / $15.00 — **intro $2.00 / $10.00 through 2026-08-31** · 1M ctx | ~$0.006–0.01 | **H** | **L** | **L** | First Sonnet-tier model with **high-resolution vision** (2576px), near-Opus accuracy on vision at roughly half Opus's price, and intro pricing active today (2026-07-13). Best accuracy-per-dollar for "identify the meal, estimate calories." |
| 3 | Best / skill default | `claude-opus-4-8` | $5.00 / $25.00 · 1M ctx | ~$0.015–0.025 | **H** | **L** | **L** | Highest capability and the claude-api skill's default. Marginal accuracy gain over Sonnet 5 on a bounded "single number" task, at ~2.5× the cost. Pick if maximum estimate accuracy outweighs per-call cost. |

All three support the design's required features (base64 image input, structured outputs). Effort is **L**
for every option — the only code difference is the model-ID string.

## Recommendation: Option 2 — `claude-sonnet-5`

Best value for this specific job: high-res vision materially helps read a plate, accuracy is near-Opus,
cost is ~half of Opus with intro pricing live now, and risk is low. Opus 4.8 (Option 3) is the safe
upgrade if the human wants the skill default / maximum accuracy and accepts ~2.5× cost; Haiku (Option 1)
only if cost/latency is the overriding constraint and more refusals are acceptable.

**Final call is the human's.** Once picked, record the one-liner in `30-design.md` under "Open decision"
and proceed to build. No ADR needed for any option.
