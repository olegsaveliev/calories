# 003 — Redesign

**Pulled from:** roadmap row 003
**Status:** KICKOFF COMPLETE — formally opened, roadmap row → `in progress`.

**Request (roadmap one-liner):** Full UI rebuild — a new layout & visual design for the upload + estimate experience (design assets to be supplied).

**Why:** The current UI (`src/index.html`) is a functional-but-plain single page from 001/002. Feature 003 replaces it with a polished "Midnight Lime" two-screen experience: a Pick screen (upload + privacy notice + CTA) and a Result screen (photo thumbnail + hero calorie number + stat tiles). This establishes the visual foundation for future enhancements (portion adjuster, food ID, confidence, shareable card).

## Scope (CONFIRMED — human decision, not open)

A **structural rebuild** of the frontend: two sequential screens (Pick → Result) with new layout, visual design, and interaction patterns. **Behaviour and the `POST /upload` contract are preserved.**

### What's in this feature
1. **Two-screen UI**: Pick (upload + privacy → send) and Result (photo + estimate → new photo / back).
2. **Wire one datum**: total calories (the only numeric output we produce today).
3. **Visual design**: "Midnight Lime" — near-black background `#0A0B0D`, acid-green accent `#C6FF3D`, Space Grotesk + Manrope typography, high-contrast mobile-first layout (340×720px card in prototype; full viewport in app).
4. **Design source of truth**: `design_handoff_calories_lime/README.md` (confirmed by human; final colors, typography, spacing, and layout to be reproduced pixel-perfectly).
5. **Preserve** from the manifest:
   - `POST /upload` contract (raw binary, MIME in `Content-Type` header, success/error JSON shapes).
   - Metadata stripping (EXIF/GPS) before transmission.
   - JPEG/PNG-only allowlist.
   - Fail-closed error rendering (no fake data).
   - Data-egress + privacy notice on Pick screen.

### What's NOT in this feature (deferred to future features)
- Food-name pill + confidence badge (feature 007).
- Items-seen tile (feature 007).
- ± range under the total (feature 007 — "Food ID + confidence").
- Portion adjuster UI (feature 004).
- Camera/drag-drop (feature 005).
- Shareable result card (feature 006).

**Result screen honest rendering**: the design mock shows these fields; this feature will either omit them or render them in a neutral/empty state (no fake data, per fail-closed rendering rule).

### Stack & constraints
- **Vanilla HTML/CSS/JS only** (ADR-001: one Node service, plain code, no framework/build tool without a new ADR).
- Target file: `src/index.html`.
- No new dependencies, no breaking changes to existing server routes or tests.

### Design handoff location
`design_handoff_calories_lime/` — README.md + `Calories-MidnightLime.dc.html` (design reference showing both screens, final tokens, and interactions).

## Pipeline shape
This feature includes an **architecture** step (confirm no ADR-001 breaks) + a separate **ux-design** step (human chose this as its own review) + **engineering** (build the two screens, wire the total calories, run tests).

## Acceptance criteria (from design handoff)
- [ ] Pick screen: file input + drag-drop zones, privacy notice, "Estimate calories" CTA (disabled until file selected).
- [ ] Result screen: photo thumbnail, hero number (total calories, Space Grotesk 76px, `#C6FF3D`, tabular numerals), "± NN" range below (placeholder/neutral state — feature 007 data), back + new-photo buttons.
- [ ] Transitions: Pick → Result on estimate, Result → Pick on "New photo".
- [ ] Loading state visible while estimating (pulsing ring suggested by handoff).
- [ ] Error state (if estimate fails, show inline message instead of number; "Try again" affordance).
- [ ] Colors, typography, spacing, radius per design tokens in handoff README.
- [ ] Responsive: mobile-first `340–420px` max content width; prototype card is design frame only.
- [ ] No fake data; total calories wired to `POST /upload` response; other fields (food name, confidence, items-seen) omitted or neutral (feature 007).
- [ ] Privacy notice preserved; JPEG/PNG allowlist unchanged; `POST /upload` contract unchanged; all 002 error paths pass through.
- [ ] All existing tests (001/002) still pass; new surface covered by E2E test (flagged in manifest as pending QA).

## Alignment
- Depends on 002 (Calorie estimate) — ✓ delivered.
- Conflicts with PROJECT.md non-goals: **none** (no accounts / history / macro breakdown).
- ADR compliance: **ADR-001 (vanilla stack) + ADR-002 (raw binary upload) both honored** — no framework, no build tool, no new deps.
- Manifest must-haves: **all preserved** — `POST /upload` contract, metadata strip, JPEG/PNG-only, fail-closed rendering, privacy notice.
