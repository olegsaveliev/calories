#!/usr/bin/env bash
# AI Factory — setup: auto-checks & installs prerequisites, then does the mechanical bits.
# For the rest (PROJECT.md, stack, roadmap, GitHub), run  /setup  in Claude Code.
#
# Usage:
#   ./setup.sh                # preflight + git init + install dev tooling
#   ./setup.sh my-project     # also replace {{PROJECT_SLUG}}/{{PROJECT_NAME}} placeholders
set -eu
echo "▶ AI Factory — setup"

# ── 0. detect a package manager ────────────────────────────────────────────
PM=""
if command -v brew    >/dev/null 2>&1; then PM="brew"
elif command -v apt-get >/dev/null 2>&1; then PM="apt"
elif command -v dnf   >/dev/null 2>&1; then PM="dnf"
fi

install_pkg() {  # <brew-name> <apt/dnf-name>
  local b="$1" a="${2:-$1}"
  case "$PM" in
    brew) brew install "$b" ;;
    apt)  sudo apt-get update -y && sudo apt-get install -y "$a" ;;
    dnf)  sudo dnf install -y "$a" ;;
    *) return 1 ;;
  esac
}

ensure() {  # <cmd> <brew-name> <apt/dnf-name> <required:1|0>
  local cmd="$1" b="$2" a="$3" req="${4:-1}"
  if command -v "$cmd" >/dev/null 2>&1; then echo "  ✓ $cmd"; return 0; fi
  echo "  … $cmd missing — installing via ${PM:-<none>}"
  if [ -z "$PM" ]; then
    echo "  ✗ no package manager found (brew/apt/dnf). Install $cmd manually, then re-run."
    [ "$req" = "1" ] && exit 1 || return 0
  fi
  if install_pkg "$b" "$a"; then echo "  ✓ $cmd installed"
  else echo "  ✗ auto-install of $cmd failed — install it manually."; [ "$req" = "1" ] && exit 1 || return 0; fi
}

# ── 1. prerequisites (auto-install missing) ────────────────────────────────
echo "Checking prerequisites…"
ensure git git git 1

# read stack preset + github flag from project-config.yaml (best-effort)
PRESET="$(sed -nE 's/^[[:space:]]*preset:[[:space:]]*"?([a-z-]+)"?.*/\1/p' project-config.yaml 2>/dev/null | head -1)"
GH_ENABLE="$(sed -nE 's/^[[:space:]]*enable:[[:space:]]*(true|false).*/\1/p' project-config.yaml 2>/dev/null | head -1)"
PRESET="${PRESET:-web-vanilla}"

case "$PRESET" in
  web-vanilla|node) ensure node node nodejs 1; ensure npm npm npm 0 ;;
  python)           ensure python3 python python3 1; ensure pip3 python python3-pip 0 ;;
  *)                echo "  • unknown preset '$PRESET' — skipping stack tooling" ;;
esac

[ "${GH_ENABLE:-false}" = "true" ] && ensure gh gh gh 0 || true

# Claude Code is the runtime for /setup — can't install it from here, just check.
command -v claude >/dev/null 2>&1 && echo "  ✓ claude (Claude Code)" \
  || echo "  • Claude Code not found — install from https://claude.com/claude-code (needed for /setup)"

# ── 2. git init ────────────────────────────────────────────────────────────
if [ ! -d .git ]; then git init -q && echo "✓ git initialised"; else echo "• git already present"; fi

# ── 3. placeholder replacement (only with a slug) ──────────────────────────
sedi() { if sed --version >/dev/null 2>&1; then sed -i "$@"; else sed -i '' "$@"; fi; }
SLUG="${1:-}"
if [ -n "$SLUG" ]; then
  NAME="$(echo "$SLUG" | tr '-' ' ')"
  files=$(grep -rl --exclude-dir=node_modules --exclude-dir=.git -e '{{PROJECT_SLUG}}' -e '{{PROJECT_NAME}}' . 2>/dev/null || true)
  for f in $files; do sedi "s/{{PROJECT_SLUG}}/$SLUG/g; s/{{PROJECT_NAME}}/$NAME/g" "$f"; done
  echo "✓ placeholders replaced ($SLUG)"
else
  echo "• no slug given — skipping placeholder replacement (run: ./setup.sh my-project)"
fi

# ── 4. install dev tooling for the active stack ────────────────────────────
if [ -f package.json ] && command -v npm >/dev/null 2>&1; then npm install --silent && echo "✓ npm install (dev tooling)"; fi

echo ""
echo "Next → open Claude Code and run:  /setup"
echo "       (writes PROJECT.md, applies the stack preset, seeds the roadmap, wires GitHub)"
