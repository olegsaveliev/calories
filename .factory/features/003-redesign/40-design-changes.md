# 003 — Redesign ("Midnight Lime") — Design Changes (ux-design pass)

> Step: dedicated visual-fidelity + accessibility pass, run AFTER engineering built the two-screen
> rebuild (`src/index.html`). The visual DIRECTION is fixed by the handoff
> (`design_handoff_calories_lime/README.md`) — this step does not offer alternative directions. It
> verifies fidelity to that direction and proves the two objective lanes the skill owns:
> **behaviour preserved** and **accessibility**. The aesthetic "does this look good?" sign-off
> remains the human's — not self-certified here.

## Scope of this pass
CSS/attributes only, inside `src/index.html`. No markup structure/ids changed, no JS state-machine
changes, no server/API changes, no framework/new files/new deps (ADR-001 upheld).

---

## 1. Visual fidelity check against the handoff tokens

Checked every token in `design_handoff_calories_lime/README.md` ("Design Tokens" section) and
`20-stories-acs.md` AC6.1–AC6.5 against the shipped CSS custom properties and rules.

| Token / rule | Handoff spec | Shipped (before this pass) | Verdict |
|---|---|---|---|
| `--bg` | `#0A0B0D` | `#0A0B0D` | match |
| `--accent` / hover | `#C6FF3D` / `#D6FF6B` | same | match |
| `--text` | `#F5F7FA` | same | match |
| `--muted` | `#8A9099` | same | match |
| `--dim` | `#6B7280` | `#6B7280` | **fails AA — fixed, see §2** |
| `--dim-2` | `#7D838C` | same | match (passes AA, see §2) |
| Hairline borders `.09/.08/.06` | as listed | `.08`/`.06` used correctly (avatar, icon-btn, privacy-note, stat-tile) | match |
| Secondary-CTA border | handoff: `1px rgba(255,255,255,.14)` (README "Screen 1" §6 CTA / "Screen 2" §5 secondary CTA) | shipped used `--hairline-1` = `.09` (the *unshipped* phone-card-frame border value, reused here by mistake) for `.cta-secondary` | **mismatch — fixed, see §3** |
| Accent tints `.35/.25/.12/.06` | dropzone border, ring-inner, ring-outer, dropzone gradient | all four wired correctly | match |
| Radii (dropzone 24, photo 22, tiles/notes 14, CTA 16, control 12, logo 8, icon-tile 20) | as listed | all match | match |
| Screen-card 40px radius | prototype-frame only, not required (AC6.5) | correctly omitted (full-viewport, 300–420px centered content) | match, correct per spec |
| Typography (Space Grotesk display/numerals/CTA, Manrope body/labels; scale 76/30/18/16/14.5/14/13/12/11.5/11px) | as listed | all sizes/families verified against every rule in the stylesheet | match |
| Hero numeral | `76px`, Space Grotesk 700, `tabular-nums`, `-0.03em` | match | match |
| Ring animation (`ringPulse`) | `210px` ring, opacity `.35→.9`, scale `1→1.04`, `3s ease-in-out infinite alternate` | match exactly | match |
| Effects: no drop shadows (flat) | flat, no shadows | grepped for `box-shadow` — none present | match |
| `backdrop-filter: blur(8px)` on overlay pill | food-name pill (feature 007, out of scope) | pill correctly omitted per `30-design.md` §4 (no fabricated field) | N/A — correct scope cut, not a fidelity bug |

**Fidelity verdict: matches the handoff on every token except two, both fixed in this pass** (the
`--dim` contrast floor and the secondary-CTA border value). No other CSS changes were made — the
rest of the build already reproduces the direction faithfully.

---

## 2. Accessibility — contrast (WCAG 2.1 AA)

Computed relative-luminance contrast ratios (standard WCAG formula) for every text colour against
its actual rendered background — including the composited `surface-2` tile fill
(`rgba(255,255,255,.03)` over `--bg`), not just the flat page background, since `--dim` is also used
inside the stat tiles.

| Text token | Used by | Size / weight | Large-text? | Ratio on `--bg` | Ratio on `surface-2` (stat tile) | AA bar | Before | After |
|---|---|---|---|---|---|---|---|---|
| `--text` `#F5F7FA` | heading, hero number caption text, stat value | 30/18/16px, 700 | — | 18.35:1 | n/a | 4.5:1 | pass | pass (unchanged) |
| `--muted` `#8A9099` | subtext, result label, hero caption | 14.5/14px, 400–600 | no | 6.12:1 | n/a | 4.5:1 | pass | pass (unchanged) |
| `--dim` `#6B7280` → `#7A808D` | dropzone subtitle (13px), eyebrow (12px, 600), stat label (11px) | 11–13px | no (none reach 18px/24px, or 14pt/18.66px bold) | **4.07:1 (FAIL)** | **3.87:1 (FAIL)** | 4.5:1 | **FAIL** | **4.97:1 / 4.72:1 — PASS** |
| `--dim-2` `#7D838C` | privacy-note copy (11.5px, 400) | 11.5px | no | 5.15:1 | 4.89:1 (also used against `surface-2` in the privacy note) | 4.5:1 | pass | pass (unchanged, no fix needed) |
| `--accent` `#C6FF3D` | hero value (76px, 700) | 76px | yes | 16.66:1 | n/a | 3:1 (large) | pass | pass (unchanged) |
| `--bg` on `--accent` | CTA-primary label | 16px, 700 | no | 16.66:1 | n/a | 4.5:1 | pass | pass (unchanged) |

**Finding:** the architecture handoff flagged both `#6B7280` and `#7D838C` as "near the AA floor."
Measurement shows `#7D838C` (`--dim-2`) actually clears AA comfortably (5.15:1 / 4.89:1) and needed
no change. `#6B7280` (`--dim`) genuinely **fails** AA on both backgrounds it's used against
(4.07:1 and 3.87:1, both below 4.5:1) — none of its three usages (dropzone subtitle, "ESTIMATED"
eyebrow, stat-tile labels) qualifies as WCAG "large text," so the 4.5:1 (not 3:1) bar applies.

**Fix applied:** `--dim` nudged from `#6B7280` → `#7A808D` — same cool-slate hue family (on-brand,
minimal perceptual shift), still visibly distinct from `--dim-2` (`#7D838C`). New ratios: **4.97:1**
on the page background, **4.72:1** on the stat-tile surface — both clear 4.5:1 with a safety margin
(rounding/anti-aliasing tolerant). This is the one token value that visibly deviates from the
handoff's literal hex, per `30-design.md`/AC8.5's explicit authorization: *"Contrast pass/fail and
any token tweak is the ux-design step's call."*

Computation method: standard WCAG relative-luminance formula
(`L = 0.2126R + 0.7152G + 0.0722B` on linearized sRGB channels; `contrast = (L1+0.05)/(L2+0.05)`),
run via a throwaway Node script against the hex values in `src/index.html`, including a composited
background for `surface-2` (`rgba(255,255,255,.03)` flattened onto `--bg`) to check the stat-tile
case, not just the flat page background.

---

## 3. Accessibility — secondary-CTA border fidelity fix

While checking hairline tokens, found `--hairline-1` (`.09`) was the only value assigned to
`.cta-secondary`'s border, but the handoff specifies the Secondary CTA ("New photo") border as
`1px rgba(255,255,255,.14)` explicitly (README, both screens' CTA sections) — `.09` was actually the
(unshipped) 340×720 phone-card frame's border value, reused by mistake. Corrected `--hairline-1` to
`.14` to match the handoff exactly; it has no other consumer in the file (`grep` confirmed), so this
is a safe, isolated fix. This makes the "New photo" button's border visibly closer to the intended
weight against the near-black background — a fidelity fix, filed here because it surfaced during the
same token audit as the contrast work.

---

## 4. Accessibility — focus indicators

Checked every interactive control against the CSS focus rule:
```css
a:focus-visible, button:focus-visible, [tabindex]:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
}
```

| Control | Selector matched | Visible focus? |
|---|---|---|
| Dropzone (`#dropzone`, `role="button" tabindex="0"`) | `[tabindex]:focus-visible` | yes |
| "Estimate calories" CTA (`<button>`) | `button:focus-visible` | yes |
| Back-chevron button (`#back-button`) | `button:focus-visible` | yes |
| "New photo" button | `button:focus-visible` | yes |
| "Try again" button | `button:focus-visible` | yes |
| Hidden `<input type="file">` | `tabindex="-1"`, intentionally not keyboard-focusable — the dropzone is the focusable proxy that opens it (AC8.2 by design) | N/A — correctly excluded, not a gap |

No control ships `outline: none` without a replacement. **No changes needed here** — already correct
as built. No fix applied.

---

## 5. Accessibility — tap targets (≥44×44px)

| Control | Hit-area size | Pass? |
|---|---|---|
| Dropzone | `min-height: 220px`, full width | pass (far over) |
| "Estimate calories" CTA | `width:100%`, `min-height:44px`, `padding:17px` | pass |
| "New photo" (secondary CTA) | `width:100%`, `min-height:44px`, `padding:17px` | pass |
| "Try again" | same class as primary CTA | pass |
| Back-chevron button (`.icon-btn`) | `44×44px` explicit (visible glyph stays `34×34px` inside it) | pass |
| Avatar placeholder (decorative, `aria-hidden`, not interactive) | `44×44px` hit box even though non-interactive | N/A (not a control) but already generous |
| File input | hidden, not directly tappable — reached only via the 220px+ dropzone | pass (via proxy) |

All interactive controls already meet the ≥44×44px bar as built. **No changes needed here.**

---

## 6. Accessibility — additional item added (not in the original punch list)

**`prefers-reduced-motion` was not honoured** — the skill's accessibility bar explicitly lists this
as a checklist item, and the file had two `infinite`/looping CSS animations (`ringPulse` on
`.ring-inner`, `skeletonPulse` on `.hero-skeleton`) with no reduced-motion guard. Added:
```css
@media (prefers-reduced-motion: reduce) {
  .ring-inner, .hero-skeleton { animation: none; }
}
```
Both animations are purely decorative/indeterminate-progress — state changes are also reflected via
`hidden` attributes and text content, so freezing them loses no information. CSS-only, no markup
change.

---

## 7. Behaviour preserved — confirmation

- `npm test` → **73/73 passing**, unchanged from the pre-pass baseline (all of
  `tests/calories.test.js`, `tests/rate-limit.test.js`, `tests/strip-metadata.test.js`,
  `tests/vision.test.js`, `tests/upload.test.js`).
- `npm run lint` → clean (`src/index.html` remains in ESLint's `ignores` list; no lint regressions
  elsewhere).
- No markup structure/ids/JS state machine touched — diff to `src/index.html` is CSS-only (three
  `:root` custom-property value changes/comments + one new `@media` block). `git diff --stat`:
  `src/index.html | 25 +++++++++++++++++++++++--` (23 insertions, 2 deletions, all inside `<style>`).
- `POST /upload` contract, server files (`server.js`, `vision.js`, `rate-limit.js`,
  `strip-metadata.js`) not touched.

---

## 8. What was NOT changed, and why

- `--dim-2`, `--muted`, `--text`, `--accent` — all already pass AA, left as-is (no unnecessary
  token drift from the handoff).
- Food-name pill / "± NN" range / stat-tile fabricated values — these are Story 3/`30-design.md`§4
  scope decisions (feature 007 fields honestly neutralised), not a design-fidelity or accessibility
  defect; out of scope for this pass to re-litigate.
- Photo-thumb's gradient placeholder lacks the handoff's radial warm highlight — this background is
  only ever visible behind the real `<img>` (which always has a `src` once a photo is submitted), so
  it has no real-world user-visible impact; not worth a CSS change that touches zero observable
  behaviour.

---

## Sign-off

- **Behaviour preserved** — CONFIRMED (73/73 tests, lint clean, CSS-only diff). Owned by this step.
- **Accessibility (contrast, focus, tap targets, reduced-motion)** — CONFIRMED, with one contrast
  fix (`--dim`) and one reduced-motion addition applied and verified above. Owned by this step.
- **Aesthetic "does it look good" sign-off — NOT made here.** The visual direction was fixed by the
  handoff before this step ran; this pass only verifies fidelity to it and the two objective lanes
  above. Final taste approval is the human's call.
