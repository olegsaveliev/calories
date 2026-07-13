# 003 — Redesign

**Pulled from:** roadmap row 003
**Status:** SCAFFOLD (pre-kickoff) — folder created ahead of the run so the design assets can be dropped in. Roadmap row is still `queued`; a `/factory-run 003` will formally kick it off (→ in progress).

**Request (roadmap one-liner):** Full UI rebuild — a new layout & visual design for the upload + estimate experience (design assets to be supplied).

**Why:** _(to fill in)_ — the current UI (`src/index.html`) is a functional-but-plain single page from 001/002. This feature is a full visual + layout rebuild of that experience.

## Scope (this feature) — DRAFT, owner to confirm

A **full UI rebuild** of the existing single-page experience: file picker → send → the `~N calories` / fail-closed result render. New layout and visual design; **behaviour and the `POST /upload` contract stay the same** unless explicitly noted.

- Target surface: `src/index.html` (the only frontend; ADR-001 = one Node service, no framework/build tool without a new ADR).
- The new design lives in **`design/`** in this folder (see `design/README.md`) — drop mockups / references / assets there.
- Preserve every existing behaviour the manifest lists: upload validation + error messages, the calorie estimate render, the data-egress notice, JPEG/PNG-only handling.

## Design assets

➡️ **Put the new design in [`design/`](./design/).** Mockups, screenshots, exported CSS, a Figma export, colour/type specs — whatever you have. The engineering/ux-design step will read from there.

## Open questions for the owner (fill before kickoff)

- Is this **CSS-only restyle** or a **structural rebuild** (new screens/flow)? Roadmap says full rebuild → likely a structural change, so the run should include the **architecture** and **ux-design** steps.
- Any behaviour changes, or is this **strictly visual with behaviour preserved**?
- Does it introduce anything ADR-001 forbids (a framework, a build step, new deps)? If so that's an ADR + a human decision, not a default.

## Notes / alignment

- Depends on 002 (the estimate UI it redesigns) — delivered.
- Must not break the manifest's `POST /upload` contract or the accepted security posture (data-egress notice, JPEG/PNG allowlist, fail-closed rendering).
- No conflict with PROJECT.md non-goals (no accounts / history / macro breakdown introduced by a visual rebuild).
- Note (roadmap): this row was inserted as the next feature; the former 003 "Food ID + confidence" moved to **007**.
