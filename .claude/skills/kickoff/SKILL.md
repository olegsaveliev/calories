---
name: {{PROJECT_SLUG}}-kickoff
description: For this project (reads PROJECT.md + manifest.md first). Step 0 of the pipeline. Given a feature ID the human picks from
  roadmap.md ("pick 002"), open that feature — create .factory/features/<id-slug>/00-feature.md from
  the roadmap row, and flip its roadmap status queued → in progress. Reads roadmap.md + manifest.md +
  PROJECT.md. NOT for choosing WHICH feature, adding new features, reordering, or overriding a block.
---

# Kickoff — {{PROJECT_NAME}} (pipeline Step 0)

**Goal.** Turn a picked roadmap ID into a clean starting brief the rest of the pipeline can run on —
and mark the board so it's clear that feature is now in flight.

**Read first (memory):** `.factory/roadmap.md` (the board), `.factory/manifest.md` (what's already
delivered), `PROJECT.md` (non-goals). **Write:** `.factory/features/<id>-<slug>/00-feature.md`; update
the picked row's Status in `roadmap.md` to `in progress`.

## Decision rules

| ✅ DO | ❌ DON'T |
|-------|----------|
| Confirm the picked ID exists as a row on the roadmap | Kick off a feature that isn't on the board |
| Check the "Blocked by" column — its blockers must be delivered in the manifest first | Start a feature whose blocker isn't delivered yet |
| Check the manifest — refuse if this ID is already delivered | Re-kick a feature that already shipped |
| Copy the roadmap one-liner into 00-feature.md (request + why + "pulled from: roadmap row <ID>") | Invent scope the roadmap row didn't state |
| Flip only the Status: queued → in progress | Touch any other roadmap row, or mark it delivered |

**Hand back to a human, never decide:** which feature to build (the human picks the ID) · adding a
brand-new feature to the roadmap · reordering priorities · overriding a "Blocked by".
**Stop-and-ask when:** the named ID isn't on the roadmap · its blocker isn't delivered in the manifest ·
the manifest already lists it as delivered · the request conflicts with `PROJECT.md` non-goals ·
the human asks to build something not on the board (offer to add it to the roadmap first).

**How to check it's working.** Given "pick 002", produce `.factory/features/002-mark-done/00-feature.md`
carrying the roadmap one-liner + why + source row, with roadmap row 002 flipped to `in progress`, and a
refusal instead if 002 is blocked, already delivered, or absent.

## Eval table
| # | Check | Input | Expected | Pass signal |
|---|-------|-------|----------|-------------|
| 1 | Opens a valid pick | "pick 002" | 00-feature.md created; row 002 → in progress | folder + brief exist; status flipped |
| 2 | Refuses a blocked pick | "pick 005" (blocked by 002, not delivered) | Stops, explains the block | no folder created; block named |
| 3 | Refuses an off-board pick | "pick 999" / "build dark mode" | Stops, offers to add it to the roadmap first | no brief invented |
