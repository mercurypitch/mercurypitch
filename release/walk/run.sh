#!/bin/bash
# Release walk: a production-like build (drafts held back, no cloud API, no
# analytics ids), served statically on a local port, walked, then stopped.
# Usage: run.sh <worktree> <outdir> [phases]   (run it through $S/bin/heavy)
set -u
W=${1:?worktree}
OUT=${2:?outdir}
PHASES=${3:-}
S=/tmp/claude-0/-home-user-mercurypitch/12ae313e-03fe-590a-b304-88d38ce9e159/scratchpad
PORT=3811
mkdir -p "$OUT"
if [ "${SKIP_BUILD:-0}" != 1 ]; then
  free=$(df -m / | awk 'NR==2{print $4}')
  echo "disk free before build: ${free} MB"
  [ "$free" -lt 400 ] && { echo "not enough disk for a build"; exit 3; }
  ( cd "$W" && env VITE_API_BASE_URL= VITE_JAM_MOCK_SIGNALING=1 VITE_GOOGLE_ADS_TAG_ID= VITE_GA4_MEASUREMENT_ID= \
      NODE_OPTIONS=--max-old-space-size=7168 node_modules/.bin/vite build >"$OUT/build.log" 2>&1 )
  echo "vite build exit: $? (a Glassworks LFS stop at the end is expected here)"
  ( cd "$W" && node scripts/assert-draft-lessons.mjs dist --hidden ) >"$OUT/drafts-hidden.log" 2>&1
  echo "assert-draft-lessons --hidden exit: $?"
fi
( cd "$W" && exec setsid node_modules/.bin/serve dist -l $PORT >"$OUT/serve.log" 2>&1 ) &
SPID=$!
for i in $(seq 1 60); do
  c=$(curl -s -o /dev/null -w '%{http_code}' --max-time 2 http://127.0.0.1:$PORT/ || true)
  [ "$c" = 200 ] && break
  sleep 1
done
echo "server answered: $c after ${i}s"
VERSION=$(node -p "require('$W/package.json').version")
( cd "$S/release/walk" && WALK_VERSION=$VERSION timeout 3000 node release-walk.cjs http://127.0.0.1:$PORT "$OUT" "$S/release/walk/stub-film.mp4" "$PHASES" )
echo "walk exit: $?"
PGID=$(ps -o pgid= -p $SPID 2>/dev/null | tr -d ' ')
[ -n "$PGID" ] && kill -TERM -- -"$PGID" 2>/dev/null
sleep 2
[ -n "$PGID" ] && kill -KILL -- -"$PGID" 2>/dev/null
c=$(curl -s -o /dev/null -w '%{http_code}' --max-time 2 http://127.0.0.1:$PORT/ || true)
echo "port $PORT after stop: $c (000 = free)"
