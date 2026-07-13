# 003 Redesign — design drop-zone

**Put the new design here.** This folder is where the owner supplies the redesign, and where the
`ux-design` / `engineering` steps read from when `/factory-run 003` runs.

## What to drop in

Anything that communicates the target look & feel and layout — as much or as little as you have:

- **Mockups / screenshots** — PNG/JPG of the intended screens (name them e.g. `01-home.png`, `02-result.png`).
- **A reference** — a link file or note pointing at a Figma/site/inspiration (`references.md`).
- **Exported CSS / tokens** — a stylesheet, or colour + type + spacing specs (`tokens.md` or `styles.css`).
- **Copy** — any new wording for the page (keep the data-egress notice + the fail-closed messages).
- **Layout notes** — what moves where, new screens/flow, responsive behaviour.

## Ground rules the design must respect (per the manifest + ADRs)

- **One Node service, no framework/build tool** (ADR-001) — the redesign lands in `src/index.html` as
  plain HTML/CSS (and vanilla JS if needed). A framework/build step would need a new ADR + a human call.
- **Behaviour preserved** unless you say otherwise: the `POST /upload` contract, upload validation +
  error messages, the `~N calories` / "couldn't estimate" render, JPEG/PNG-only handling, and the
  **notice that the photo is sent to Anthropic** all stay.
- **Accessibility** still gets checked at build (contrast, focus, tap targets).

_Once the assets are here, run `/factory-run 003` — kickoff will open the feature and the pipeline will
include the architecture + ux-design steps for a rebuild of this size._
