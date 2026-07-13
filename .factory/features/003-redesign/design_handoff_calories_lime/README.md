# Handoff: Calories — "Midnight Lime" (photo → calorie estimate)

## Overview
A mobile-first tool where the user picks a food photo and gets a total-calorie
estimate back. Two screens: a **Pick** screen (upload + privacy note + CTA) and a
**Result** screen (photo thumbnail, big total, and two small stat tiles). The
"Midnight Lime" direction is near-black with a single acid-green accent and large
tabular numerals.

## About the Design Files
The file in this bundle (`Calories-MidnightLime.dc.html`) is a **design reference
created in HTML** — a prototype showing the intended look and behavior, not
production code to copy directly. The task is to **recreate this design in the
target codebase's existing environment** (React, Vue, SwiftUI, native, etc.)
using its established patterns and component libraries. If no environment exists
yet, choose the most appropriate framework and implement it there. Copy the exact
values below; don't ship the HTML as-is.

The prototype was built as a "Design Component" (`.dc.html`) — a single streaming
HTML file. You can open it in any browser to see it render. Ignore the `<x-dc>` /
support-runtime wrapper; only the markup and styles matter for recreation.

## Fidelity
**High-fidelity (hifi).** Final colors, typography, spacing, and layout are
intended to be reproduced pixel-perfectly using the codebase's own libraries.
The result data (642 kcal, food names, counts) is **placeholder/demo content** —
wire it to real model output; this was a visual redesign only.

## Screens / Views

Both screens are rendered inside a phone-shaped card: **340 × 720 px**, background
`#0A0B0D`, `1px` border `rgba(255,255,255,.09)`, border-radius `40px`, padding
`22px`, `overflow: hidden`, flex column. In a real app these are full-viewport
screens; the card is just the prototype frame. The surrounding canvas is `#101215`.

### Screen 1 — Pick
- **Purpose**: user adds a food photo and starts an estimate.
- **Layout** (top → bottom, flex column):
  1. **Header row** — `space-between`, margin-bottom `40px`.
     - Left: logo lockup, `gap: 9px`. Logo mark = `26×26`, radius `8px`, fill
       `#C6FF3D`, containing a small black flame SVG (`15×15`). Wordmark
       "Calories" — Space Grotesk 700, `16px`, `#F5F7FA`, letter-spacing `-0.01em`.
     - Right: avatar placeholder circle `34×34`, `rgba(255,255,255,.05)` fill,
       `1px` border `rgba(255,255,255,.08)`.
  2. **Heading** — "Snap it. Count it." Space Grotesk 700, `30px`, line-height
     `1.12`, letter-spacing `-0.02em`, `#F5F7FA`, margin-bottom `10px`.
  3. **Subtext** — "Pick a food photo and we'll estimate the calories." Manrope
     400, `14.5px`, line-height `1.5`, `#8A9099`, margin-bottom `26px`.
  4. **Dropzone** (`flex: 1`, fills remaining height) — dashed border
     `1.5px dashed rgba(198,255,61,.35)`, radius `24px`, background
     `linear-gradient(180deg, rgba(198,255,61,.06), rgba(198,255,61,0))`,
     centered flex column, `gap: 16px`, padding `24px`, text centered.
     - Icon tile `64×64`, radius `20px`, fill `#C6FF3D`, black camera SVG (`30×30`).
     - "Add a photo" — Manrope 700, `16px`, `#F5F7FA`.
     - "Drag in, or tap to choose" — `13px`, `#6B7280`, margin-top `4px`.
     - **Behavior**: this is the file-input target. Clicking or dropping a
       JPG/PNG selects a photo. Replace the placeholder with a preview thumbnail
       once a file is chosen.
  5. **Privacy note** — row, `gap: 10px`, margin `18px 0 14px`, padding
     `13px 15px`, radius `14px`, bg `rgba(255,255,255,.03)`, border
     `1px rgba(255,255,255,.06)`. Shield SVG (`16×16`, stroke `#C6FF3D`) +
     text: "Sent to Claude to estimate. Location & camera metadata stripped
     first — nothing is stored here." Manrope 400, `11.5px`, line-height `1.5`,
     `#7D838C`.
  6. **Primary CTA** — full width, padding `17px`, radius `16px`, bg `#C6FF3D`,
     text `#0A0B0D`, Space Grotesk 700, `16px`, no border. Label "Estimate
     calories". Disabled until a photo is selected (suggested). On tap →
     estimate, then navigate to Result.

### Screen 2 — Result
- **Purpose**: show the calorie estimate for the submitted photo.
- **Layout** (top → bottom, flex column):
  1. **Back header** — row, `gap: 10px`, margin-bottom `22px`. Back button
     `34×34`, radius `12px`, bg `rgba(255,255,255,.05)`, border
     `1px rgba(255,255,255,.08)`, chevron-left SVG stroke `#8A9099`. Label
     "Result" — Manrope 600, `14px`, `#8A9099`.
  2. **Photo thumbnail** — height `168px`, radius `22px`, `overflow: hidden`.
     In the app this is the user's uploaded photo (object-fit: cover). Overlaid
     bottom-left food-name pill: padding `5px 11px`, radius `20px`, bg
     `rgba(10,11,13,.7)`, `backdrop-filter: blur(8px)`, text `#F5F7FA` `12px`
     600. (Demo: "🥗 Grilled chicken bowl".)
  3. **Hero number block** (`flex: 1`, centered) — two decorative concentric
     rings behind the number: `210×210` circle, border `1.5px
     rgba(198,255,61,.25)`, animated (`ringPulse`); `250×250` circle, border
     `1px rgba(198,255,61,.12)`. Foreground, centered:
     - "ESTIMATED" — Manrope 600, `12px`, letter-spacing `.14em`, uppercase,
       `#6B7280`.
     - **Total** — Space Grotesk 700, `76px`, line-height `1`, letter-spacing
       `-0.03em`, `font-variant-numeric: tabular-nums`, color `#C6FF3D`. (Demo "642".)
     - "calories · ± 70" — Manrope 600, `14px`, `#8A9099`.
  4. **Stat tiles** — row, `gap: 10px`, margin-bottom `14px`. Two equal tiles
     (`flex: 1`), padding `13px`, radius `14px`, bg `rgba(255,255,255,.03)`,
     border `1px rgba(255,255,255,.06)`, centered. Each: value (Space Grotesk
     700, `18px`, `#F5F7FA`) + label (`11px`, `#6B7280`, margin-top `2px`).
     Demo tiles: "3 / items seen" and "High / confidence".
  5. **Secondary CTA** — full width, padding `17px`, radius `16px`, transparent
     bg, border `1px rgba(255,255,255,.14)`, text `#F5F7FA`, Space Grotesk 700,
     `15px`. Label "New photo" → back to Pick screen.

## Interactions & Behavior
- **Pick → Result**: tapping "Estimate calories" submits the photo and (on
  success) navigates to Result. Show a loading state while the estimate is
  pending (see below).
- **Result → Pick**: "New photo" resets state and returns to the Pick screen.
- **File selection**: clicking the dropzone (or drag & drop) opens the native
  file picker, accept `image/jpeg, image/png`, single file. On select, show a
  preview thumbnail inside the dropzone and enable the CTA.
- **Ring animation** (`ringPulse`): the `210px` ring pulses — opacity `.35→.9`,
  scale `1→1.04` — `3s`, `ease-in-out`, infinite alternate.
- **Loading state** (needs building — not in mock): while estimating, suggest
  keeping the ring visible with a pulsing/indeterminate treatment and the number
  replaced by a skeleton or animated placeholder.
- **Error state** (needs building): if the estimate fails, show an inline message
  in place of the number with a "Try again" affordance.
- **Metadata stripping**: strip EXIF (location + camera) from the image client-side
  before sending, per the privacy copy.
- **Responsive**: mobile-first. On wider screens, center the screen at ~`340–420px`
  max content width; the prototype shows the two screens side by side only for
  review — they are sequential in the real app.

## State Management
- `photoFile` / `photoPreviewUrl` — selected image + object URL for preview.
- `status` — `idle | selected | estimating | done | error`.
- `estimate` — `{ totalCalories, plusMinus, itemCount, confidence, foodName }`
  (populated from model output; demo values shown in mock).
- Transitions: `idle → selected` (on file pick), `selected → estimating` (CTA),
  `estimating → done | error` (response), `done/error → idle` (New photo).
- Data fetching: POST the (metadata-stripped) image to the estimate endpoint;
  no persistence — nothing is stored per the privacy copy.

## Design Tokens
Colors
- Accent (lime): `#C6FF3D` (hover `#D6FF6B`)
- App/screen bg: `#0A0B0D`
- Canvas bg (prototype only): `#101215`
- Text primary: `#F5F7FA`
- Text muted: `#8A9099`
- Text dim: `#6B7280`
- Text dim-2: `#7D838C`
- Hairline border: `rgba(255,255,255,.09)` / `.08` / `.06`
- Surface fill: `rgba(255,255,255,.05)` / `.03`
- Accent tints: `rgba(198,255,61,.35 / .25 / .12 / .06)`
- Photo placeholder gradient: `linear-gradient(135deg,#3A2A1A,#1A1410)` with
  radial warm highlight `rgba(255,180,90,.35)`

Typography
- Display / numerals / buttons: **Space Grotesk** (400–700)
- Body / labels: **Manrope** (400–800)
- Scale used: `76px` hero, `30px` H2, `18px` stat value, `16px` body/CTA,
  `14.5px` subtext, `14px` label, `13px`, `12px` eyebrow, `11.5px`, `11px`.

Radius
- Screen card `40px`, dropzone `24px`, photo `22px`, tiles/notes `14px`,
  CTA `16px`, small controls `12px`, logo mark `8px`, icon tile `20px`.

Spacing (px used): `4, 6, 9, 10, 13, 14, 15, 16, 17, 18, 22, 24, 26, 40, 56`.

Effects
- `backdrop-filter: blur(8px)` on overlay pills.
- No drop shadows in this direction (flat, high-contrast).

## Assets
- **Fonts**: Space Grotesk + Manrope via Google Fonts (`<link>` in the file).
  Swap for your app's equivalents or self-host.
- **Icons**: inline SVGs (flame/logo, camera, shield, chevron-left). Replace with
  your icon library's equivalents — sizes noted per screen above.
- **Emoji** (🥗) is placeholder decoration on the food-name pill; drop or replace.
- **Food photo**: the mock uses a CSS gradient placeholder; the real app shows
  the user's uploaded image.

## Files
- `Calories-MidnightLime.dc.html` — the design reference (both screens).
