#!/usr/bin/env bash
# Agent Bridge Studio test harness: static checks, typecheck, build, unit tests,
# and a headless Electron IPC integration test. Exits non-zero on any failure.
set -uo pipefail
cd "$(dirname "$0")/.."

fail=0
step() { echo ""; echo "==== $1 ===="; }
record() { if [ "$1" -ne 0 ]; then echo "✗ FAILED: $2"; fail=1; else echo "✓ $2"; fi; }

step "Syntax check renderer JS (node --check)"
for f in renderer/*.js renderer/features/*.js; do
  node --check "$f"
  record $? "node --check $f"
done

step "TypeScript typecheck"
npm run -s typecheck
record $? "typecheck"

step "Bundle app (esbuild)"
npm run -s build:app >/dev/null
record $? "build:app"

step "Unit tests (activity registry)"
./node_modules/.bin/tsx test/activity.test.ts
record $? "unit tests"

step "Headless IPC integration test (Electron SMOKE=ipc)"
SMOKE=ipc ./node_modules/.bin/electron . 2>/dev/null
record $? "ipc smoke"

echo ""
if [ "$fail" -eq 0 ]; then
  echo "================  ALL CHECKS PASSED  ================"
else
  echo "================  SOME CHECKS FAILED  ================"
fi
exit $fail
