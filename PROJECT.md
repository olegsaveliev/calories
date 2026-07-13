# Calories — Project North Star

> The "why we're here" anchor. It changes **rarely**. Every feature is checked against it — a request
> that conflicts with the non-goals below makes the pipeline **stop and ask**, not silently expand scope.

**What it is:** Calories takes a photo of a meal and estimates how many calories are in it. Point your
camera at your plate, get a number back.

**Who it's for:** Anyone who wants a quick calorie estimate for a meal from a photo — no diet app, no
account, just a picture in and a number out.

**Non-goals (for now):** No user accounts or login. No meal history or long-term tracking. No full
nutrition breakdown (protein/fat/carbs) — a single calorie estimate is the whole job for now.

**Tech (deliberately chosen):** Node (see `presets/node/`). Node serves the browser frontend **and**
hosts the one API route that calls a vision model — because a model API key can't live safely in
client-only code. Plain, boring, single service. Lint with ESLint, test with Vitest. No framework or
build tool until a feature clearly needs one (that's an ADR, not a default).

---
*Changes rarely. If a feature request conflicts with this, stop and ask — don't silently expand the project.*
