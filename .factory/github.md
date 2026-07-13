# GitHub integration — how the factory reports to git + Issues

> Additive layer. The `.factory/` files stay the **source of truth**; GitHub is the **shared mirror**.
> Skills are unchanged — they just do two extra git/issue steps at the points below.
> **Fresh template — `/setup` wires your repo. Remote + branch are recorded in `project-config.yaml`.**

Remote: `https://github.com/olegsaveliev/calories.git` · default branch: `main` (**protected** — merge via PR + green CI).

## The mapping
- **Roadmap feature ↔ GitHub Issue.** One issue per feature ID (e.g. `001` → issue #1).
- **`bugs.md` entry ↔ Issue** with the `bug` label.
- Labels: `feature`, `bug`, `in-progress`.

## The per-feature loop (SAME for every feature)
| Pipeline stage | Git / CI action (done by the orchestrator, not the subagents) |
|---|---|
| **kickoff** (queued → in progress) | ensure the Issue exists; label `in-progress`; cut branch `feature/<id>-<slug>` |
| **engineering** (code written) | commit code **and its test(s)**; push the branch |
| **push** | **CI runs automatically** — lint + the full test suite |
| **reviewer** | open a PR (`gh pr create`); read the diff, fresh eyes |
| **qa** | **CI must be GREEN** — the merge is blocked until then |
| **delivery-pm / wrap** (in progress → delivered) | update `manifest.md`/`roadmap.md` **on the branch**, `gh pr merge --squash`, then **close the Issue** |

> If your default branch is protected (recommended — `/setup` can enable it), the manifest/roadmap
> update at wrap happens **on the branch** and lands via the PR — never a direct push to the protected branch.

## Handy commands
```
gh issue list                                   # the board
gh issue create --title "..." --label feature   # new feature/bug
gh issue close <n> -c "delivered in <sha>"       # wrap closes it
git checkout -b feature/001-<slug>              # kickoff branches
git push -u origin HEAD                           # publish the branch
```

## Rules
- `.factory/` remains authoritative; if GitHub and `.factory/` disagree, `.factory/` wins and we re-sync.
- **Never commit secrets** — keys/tokens live in env/local config, never in a committed file.
- No git available? A run can proceed **`.factory`-only** (git steps skipped, human-approved) — the memory is still authoritative.
