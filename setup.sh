#!/usr/bin/env bash
# AI Factory — mechanical setup (the no-judgement bits).
# For the rest (PROJECT.md, stack choice, roadmap, GitHub), run  /setup  in Claude Code.
#
# Usage:
#   ./setup.sh                # git init + install dev tooling
#   ./setup.sh my-project     # also replace {{PROJECT_SLUG}}/{{PROJECT_NAME}} placeholders
set -eu

echo "▶ AI Factory — mechanical setup"
SLUG="${1:-}"

# portable in-place sed (macOS vs GNU)
sedi() { if sed --version >/dev/null 2>&1; then sed -i "$@"; else sed -i '' "$@"; fi; }

# 1. git init
if [ ! -d .git ]; then git init -q && echo "✓ git initialised"; else echo "• git already present"; fi

# 2. placeholder replacement (only with a slug)
if [ -n "$SLUG" ]; then
  NAME="$(echo "$SLUG" | tr '-' ' ')"
  files=$(grep -rl --exclude-dir=node_modules --exclude-dir=.git -e '{{PROJECT_SLUG}}' -e '{{PROJECT_NAME}}' . 2>/dev/null || true)
  for f in $files; do
    sedi "s/{{PROJECT_SLUG}}/$SLUG/g; s/{{PROJECT_NAME}}/$NAME/g" "$f"
  done
  echo "✓ replaced {{PROJECT_SLUG}}→$SLUG and {{PROJECT_NAME}}→$NAME"
else
  echo "• no slug given — skipping placeholder replacement (run: ./setup.sh my-project)"
fi

# 3. install default (web-vanilla) dev tooling if present
if [ -f package.json ] && command -v npm >/dev/null 2>&1; then
  npm install --silent && echo "✓ npm install (dev tooling)"
fi

echo ""
echo "Next → open Claude Code and run:  /setup"
echo "       (writes PROJECT.md, applies the stack preset, seeds the roadmap, wires GitHub)"
