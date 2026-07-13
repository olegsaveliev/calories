# Decisions (ADRs)

One file per **hard-to-reverse** decision — `001-<slug>.md`, `002-<slug>.md`, … The `architecture` skill
writes an ADR only when a choice is **both** hard to reverse **and** likely to be questioned later
(otherwise a one-liner in `manifest.md` is enough). Each ADR records the reasoning **and the rejected
alternative** — that's the part a future reader most needs.

Copy `TEMPLATE.md` to start a new one. Keep a one-line summary of each in `manifest.md` → "Key decisions in force".

_No project ADRs yet — `/setup` seeds the first (your stack choice)._
