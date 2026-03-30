#!/usr/bin/env bash
# lofi-kissa preflight check
# Verifies all dependencies and configuration are in place.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
PASS="✅" WARN="⚠️ " FAIL="❌"
errors=0

echo "☕ lofi-kissa preflight check"
echo "────────────────────────────"

# ── System dependencies ──────────────────────────────────────────────────────

check_cmd() {
  local name="$1" cmd="$2" min_ver="$3" actual
  if ! command -v "$cmd" &>/dev/null; then
    echo "$FAIL $name: not found"
    (( errors++ )) || true
    return
  fi
  actual=$("$cmd" --version 2>&1 | head -1)
  echo "$PASS $name: $actual"
}

check_node() {
  if ! command -v node &>/dev/null; then
    echo "$FAIL Node.js: not found"
    echo "    → nvm install --lts"
    (( errors++ )) || true
    return
  fi
  local ver major
  ver=$(node --version | tr -d 'v')
  major=$(echo "$ver" | cut -d. -f1)
  if (( major < 18 )); then
    echo "$FAIL Node.js: v$ver (requires >=18)"
    echo "    → nvm install --lts && nvm use --lts"
    (( errors++ )) || true
  else
    echo "$PASS Node.js: v$ver"
  fi
}

check_node
check_cmd "ffmpeg" "ffmpeg" ""
check_cmd "yt-dlp" "yt-dlp" ""

echo ""

# ── .env ─────────────────────────────────────────────────────────────────────

ENV_FILE="$ROOT/.env"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "$FAIL .env: not found"
  echo "    → cp .env.example .env  then fill in the values"
  (( errors++ )) || true
else
  echo "$PASS .env: found"

  check_env_var() {
    local var="$1" hint="$2"
    local val
    val=$(grep -E "^${var}=" "$ENV_FILE" 2>/dev/null | cut -d= -f2- | tr -d '"' || true)
    if [[ -z "$val" || "$val" == "your_"* ]]; then
      echo "$FAIL   $var: not set"
      echo "    → $hint"
      (( errors++ )) || true
    else
      echo "$PASS   $var: set"
    fi
  }

  check_env_var "DISCORD_TOKEN" \
    "Discord Developer Portal → Bot → Reset Token"
  check_env_var "OWNER_ID" \
    "Discord: Settings → Advanced → Developer Mode ON → right-click yourself → Copy User ID"
fi

echo ""

# ── Build ─────────────────────────────────────────────────────────────────────

if [[ ! -d "$ROOT/node_modules" ]]; then
  echo "$WARN node_modules: not found — run: npm install"
else
  echo "$PASS node_modules: present"
fi

if [[ ! -d "$ROOT/dist" ]]; then
  echo "$WARN dist/: not built — run: npm run build"
else
  echo "$PASS dist/: built"
fi

echo ""
echo "────────────────────────────"

if (( errors > 0 )); then
  echo "$FAIL $errors issue(s) found. Fix them before starting the bot."
  exit 1
else
  echo "$PASS All checks passed! Run: npm start"
fi
