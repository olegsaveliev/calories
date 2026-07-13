#!/usr/bin/env bash
# AI Factory — health check. Run after /setup to confirm the factory is sane.
#   ./tools/verify.sh
set -eu
ok=0; warn=0

chk()  { if eval "$2" >/dev/null 2>&1; then echo "✓ $1"; else echo "✗ $1"; ok=1; fi; }
note() { echo "• $1"; }

echo "▶ AI Factory health check"

# structure
chk "PROJECT.md present"                 "test -f PROJECT.md"
chk ".factory/manifest.md present"       "test -f .factory/manifest.md"
chk ".factory/roadmap.md present"        "test -f .factory/roadmap.md"
chk "10 skills present"                  "[ \$(ls .claude/skills | wc -l) -ge 10 ]"
chk "/setup + /factory-run commands"     "test -f .claude/commands/setup.md && test -f .claude/commands/factory-run.md"
chk "CI workflow present"                "test -f .github/workflows/ci.yml"

# not-yet-onboarded warnings (placeholders should be gone AFTER /setup)
if grep -rq --exclude-dir=node_modules --exclude-dir=.git '{{PROJECT_' . 2>/dev/null; then
  warn=1; note "unresolved {{PROJECT_*}} placeholders remain → run ./setup.sh <slug> + /setup"
fi
if grep -rq "not yet initialised" .factory/manifest.md 2>/dev/null; then
  warn=1; note "manifest is still the blank template → run /setup to initialise"
fi

echo ""
[ "$ok" -eq 0 ]   && echo "structure: OK"    || echo "structure: MISSING pieces (see ✗ above)"
[ "$warn" -eq 1 ] && echo "state: not onboarded yet (expected for a fresh clone)" || echo "state: onboarded"
exit $ok
