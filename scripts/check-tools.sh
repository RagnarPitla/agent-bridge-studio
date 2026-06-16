#!/usr/bin/env bash
set -euo pipefail

echo "Checking required local CLIs..."

check() {
  local name="$1"
  shift
  if command -v "$name" >/dev/null 2>&1; then
    echo "✓ $name found: $(command -v "$name")"
    "$@" || true
  else
    echo "✗ $name not found"
    return 1
  fi
}

check gh gh --version

echo
if gh auth status >/dev/null 2>&1; then
  echo "✓ gh auth status succeeded"
else
  echo "✗ gh auth status failed"
fi

echo
check copilot copilot --version

echo
if gh copilot --help >/dev/null 2>&1; then
  echo "✓ gh copilot available"
else
  echo "! gh copilot unavailable or unsupported"
fi

echo
check claude claude --version

echo "Done."
