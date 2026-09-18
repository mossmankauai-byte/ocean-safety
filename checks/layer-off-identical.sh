#!/usr/bin/env bash
# Off-test wrapper: serves this tree and a baseline export of origin/main on localhost, runs the
# headless public-ref off-test, then stops both servers. Exit code is the test's.
#   checks/layer-off-identical.sh [outdir]
set -u
HERE="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${1:-$HERE/checks/out}"
BASE="$(mktemp -d)/base"; mkdir -p "$BASE"
git -C "$HERE" archive origin/main | tar -x -C "$BASE"
python3 "$HERE/tools/serve-local.py" "$HERE" 4611 & P1=$!
python3 "$HERE/tools/serve-local.py" "$BASE" 4612 & P2=$!
sleep 1
NEW_ORIGIN=http://127.0.0.1:4611 BASE_ORIGIN=http://127.0.0.1:4612 node "$HERE/checks/public-ref-offtest.js" "$OUT"
RC=$?
kill $P1 $P2 2>/dev/null
echo "baseline tree: $BASE (origin/main $(git -C "$HERE" rev-parse --short origin/main))"
exit $RC
