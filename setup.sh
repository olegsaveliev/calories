#!/usr/bin/env bash
# AI Factory — setup: asks you a few questions, auto-installs prerequisites, does the mechanical bits.
# Then run  /setup  in Claude Code to finish (PROJECT.md, stack, roadmap, GitHub).
#
#   ./setup.sh                # interactive: asks questions → writes project-config.yaml → preflight → git init
#   ./setup.sh --yes          # non-interactive: use existing project-config.yaml as-is
set -eu
echo "▶ AI Factory — setup"

slugify() { echo "$1" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-+|-+$//g'; }
ask() {  # ask <var> <prompt> <default>
  local __v="$1" __p="$2" __d="${3:-}" __in=""
  if [ -n "$__d" ]; then read -r -p "  $__p [$__d]: " __in || true; __in="${__in:-$__d}"
  else read -r -p "  $__p: " __in || true; fi
  printf -v "$__v" '%s' "$__in"
}

# ── 1. Q&A → project-config.yaml ───────────────────────────────────────────
FILLED=0
[ -f project-config.yaml ] && ! grep -q 'name: "My Project"' project-config.yaml && FILLED=1
if [ "${1:-}" = "--yes" ]; then FILLED=1; echo "• using existing project-config.yaml (--yes)"; fi

if [ "$FILLED" = "0" ]; then
  echo "Let's set up your project (press Enter to accept [defaults])."
  ask PNAME  "Project name" "My Project"
  ask PSLUG  "Slug (lowercase-hyphens; folders + package name)" "$(slugify "$PNAME")"
  ask PONE   "One-liner (what it does, for whom)" ""
  ask PUSER  "Primary user" ""
  ask PNON   "Non-goals (won't build yet)" ""
  ask PRESET "Stack preset (web-vanilla / node / python)" "web-vanilla"
  ask GHEN   "Wire GitHub? (true/false)" "true"
  GHREMOTE=""; GHPROT="true"
  if [ "$GHEN" = "true" ]; then
    ask GHREMOTE "GitHub remote URL (blank = local only)" ""
    ask GHPROT   "Protect the default branch? (true/false)" "true"
  fi
  ask F1NAME "First feature — name" "First feature"
  ask F1ONE  "First feature — one-liner" ""
  cat > project-config.yaml <<EOF
project:
  name: "$PNAME"
  slug: "$PSLUG"
  one_liner: "$PONE"
  primary_user: "$PUSER"
  non_goals: "$PNON"
stack:
  preset: "$PRESET"
  notes: ""
github:
  enable: $GHEN
  remote: "$GHREMOTE"
  default_branch: "main"
  protect_branch: $GHPROT
first_features:
  - id: "001"
    name: "$F1NAME"
    one_liner: "$F1ONE"
    size: "S"
EOF
  echo "✓ wrote project-config.yaml"
else
  echo "• project-config.yaml already filled — using it"
fi

# read back name/slug/preset/github from the config
SLUG="$(sed -nE 's/^[[:space:]]*slug:[[:space:]]*"?([a-z0-9-]+)"?.*/\1/p' project-config.yaml | head -1)"
NAME="$(sed -nE 's/^[[:space:]]*name:[[:space:]]*"([^"]*)".*/\1/p' project-config.yaml | head -1)"
PRESET="$(sed -nE 's/^[[:space:]]*preset:[[:space:]]*"?([a-z-]+)"?.*/\1/p' project-config.yaml | head -1)"; PRESET="${PRESET:-web-vanilla}"
GH_ENABLE="$(sed -nE 's/^[[:space:]]*enable:[[:space:]]*(true|false).*/\1/p' project-config.yaml | head -1)"

# ── 2. prerequisites (auto-install missing) ────────────────────────────────
PM=""; command -v brew >/dev/null 2>&1 && PM=brew || { command -v apt-get >/dev/null 2>&1 && PM=apt || { command -v dnf >/dev/null 2>&1 && PM=dnf || true; }; }
install_pkg() { case "$PM" in brew) brew install "$1";; apt) sudo apt-get update -y && sudo apt-get install -y "${2:-$1}";; dnf) sudo dnf install -y "${2:-$1}";; *) return 1;; esac; }
ensure() {  # <cmd> <brew> <apt/dnf> <required>
  local c="$1" b="$2" a="$3" r="${4:-1}"
  if command -v "$c" >/dev/null 2>&1; then echo "  ✓ $c"; return 0; fi
  echo "  … $c missing — installing via ${PM:-<none>}"
  if [ -z "$PM" ]; then echo "  ✗ no package manager (brew/apt/dnf) — install $c manually"; [ "$r" = 1 ] && exit 1 || return 0; fi
  if install_pkg "$b" "$a"; then echo "  ✓ $c installed"; else echo "  ✗ auto-install failed — install $c manually"; [ "$r" = 1 ] && exit 1 || return 0; fi
}
echo "Checking prerequisites…"
ensure git git git 1
case "$PRESET" in
  web-vanilla|node) ensure node node nodejs 1; ensure npm npm npm 0 ;;
  python)           ensure python3 python python3 1; ensure pip3 python python3-pip 0 ;;
esac
[ "${GH_ENABLE:-false}" = "true" ] && ensure gh gh gh 0 || true
command -v claude >/dev/null 2>&1 && echo "  ✓ claude (Claude Code)" || echo "  • Claude Code not found — https://claude.com/claude-code (needed for /setup)"

# ── 3. git init ────────────────────────────────────────────────────────────
if [ ! -d .git ]; then git init -q && echo "✓ git initialised"; else echo "• git already present"; fi

# ── 4. placeholder replacement (from the config's slug/name) ───────────────
sedi() { if sed --version >/dev/null 2>&1; then sed -i "$@"; else sed -i '' "$@"; fi; }
if [ -n "${SLUG:-}" ] && [ "$SLUG" != "my-project" ]; then
  files=$(grep -rl --exclude-dir=node_modules --exclude-dir=.git -e 'calories' -e 'Calories' . 2>/dev/null || true)
  for f in $files; do sedi "s/calories/$SLUG/g; s/Calories/${NAME:-$SLUG}/g" "$f"; done
  echo "✓ placeholders replaced ($SLUG)"
else
  echo "• slug is default/empty — placeholders left for /setup"
fi

# ── 5. dev tooling ─────────────────────────────────────────────────────────
if [ -f package.json ] && command -v npm >/dev/null 2>&1; then npm install --silent && echo "✓ npm install (dev tooling)"; fi

echo ""
echo "Next → open Claude Code and run:  /setup"
echo "       (writes PROJECT.md, applies the stack preset, seeds the roadmap, wires GitHub)"
