# Features — per-feature spec chains

Each feature gets its own folder here: `.factory/features/<id>-<slug>/` (created by `kickoff`).
Inside, the pipeline writes a numbered **spec chain** — each step reads the previous file + the project
`manifest.md`, and writes the next:

| File | Written by | What it is |
|------|-----------|------------|
| `00-feature.md` | kickoff | the feature framed in a few lines (from a roadmap pick) |
| `10-opportunity-brief.md` | consulting-sme *(optional)* | business-case step — skip for most apps |
| `20-prd.md`, `20-stories-acs.md` | prod-ba | the spec: INVEST stories + falsifiable acceptance criteria |
| `30-design.md`, `30-options.md` | architecture *(conditional)* | design + scored options; ADRs go to `../decisions/` |
| `40-design-changes.md` | ux-design *(conditional)* | look-&-feel / UX changes |
| `50-build-notes.md` | engineering | what was built (+ code in `src/`, tests in the suite) |
| `55-review.md` | reviewer | independent (fresh-subagent) review findings |
| `60-test-cases.md` | qa | the risk-driven test cases + results |
| `70-threats.md` | threat-model *(conditional)* | threat model when the attack surface changes / AI in scope |
| `99-status.md` | delivery-pm | wrap note; also updates `manifest.md` + `build-log.md` |

Conditional steps are skipped when a feature doesn't need them. See `../handoff-map.md` for the full pipeline.
