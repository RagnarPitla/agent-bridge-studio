#!/usr/bin/env bash
set -euo pipefail

echo "Checking required local CLIs..."

# Run a version/help command non-interactively. Closing stdin (</dev/null) means
# launcher shims that prompt ("Install GitHub Copilot CLI? [y/N]") get EOF and
# exit instead of hanging this script.
run_quiet() {
  "$@" </dev/null 2>&1 || true
}

# --- gh ---------------------------------------------------------------------
if command -v gh >/dev/null 2>&1; then
  echo "✓ gh found: $(command -v gh)"
  run_quiet gh --version | head -1
else
  echo "✗ gh not found"
fi

echo
if gh auth status >/dev/null 2>&1; then
  echo "✓ gh auth status succeeded"
else
  echo "✗ gh auth status failed"
fi

# --- GitHub Copilot CLI -----------------------------------------------------
# The `copilot` on PATH is often a launcher shim (e.g. the VS Code Copilot Chat
# bundle) that cannot report a version. Resolve the real CLI: prefer a PATH
# binary that actually returns a version, otherwise fall back to a standalone
# install under ~/.copilot-cli/<version>/copilot.
resolve_copilot() {
  local path_bin out candidate
  path_bin="$(command -v copilot || true)"
  if [ -n "$path_bin" ]; then
    out="$("$path_bin" --version </dev/null 2>&1 || true)"
    if printf '%s' "$out" | grep -qiE 'GitHub Copilot CLI[[:space:]]+v?[0-9]+\.[0-9]+\.[0-9]+'; then
      printf '%s' "$path_bin"
      return 0
    fi
  fi
  candidate="$(ls -d "$HOME"/.copilot-cli/*/copilot 2>/dev/null | sort -V | tail -1 || true)"
  if [ -n "$candidate" ]; then
    printf '%s' "$candidate"
    return 0
  fi
  return 1
}

echo
path_copilot="$(command -v copilot || true)"
copilot_bin="$(resolve_copilot || true)"
if [ -n "$copilot_bin" ]; then
  echo "✓ copilot resolved: $copilot_bin"
  run_quiet "$copilot_bin" --version | head -1
  if [ -n "$path_copilot" ] && [ "$path_copilot" != "$copilot_bin" ]; then
    echo "! note: PATH 'copilot' ($path_copilot) is a launcher shim; using the standalone install above"
  fi
else
  echo "✗ copilot (GitHub Copilot CLI) not found on PATH or under ~/.copilot-cli"
fi

echo
if gh copilot --help </dev/null >/dev/null 2>&1; then
  echo "✓ gh copilot available"
else
  echo "! gh copilot unavailable or unsupported"
fi

# --- Claude Code ------------------------------------------------------------
echo
if command -v claude >/dev/null 2>&1; then
  echo "✓ claude found: $(command -v claude)"
  run_quiet claude --version | head -1
else
  echo "✗ claude not found"
fi

echo "Done."
