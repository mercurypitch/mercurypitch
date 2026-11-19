#!/bin/bash
# make-proj.sh <P> <name> <hosts.js> [film|alone] [debug]: a project around the live s13 and assets, with
# assets/lib/hosts.js taken from <hosts.js>.
#   film   the film's root (P/index.html) with only s13's host left: no other scene is on screen from
#          462.370 to 527.395 s, so s13's timing is the film's own
#   alone  s13 from its own time 0, as tools/lab.mjs hosts it (lab/s13-recap/proj/index.html)
#   debug  also loads debug-gate.js after the kit (test harness: paints the gate's time and frames)
set -euo pipefail
P=$1; HERE=$(cd "$(dirname "$0")" && pwd); D=$HERE/$2; H=$3; MODE=${4:-film}; DBG=${5:-}
rm -rf "$D"; mkdir -p "$D/compositions" "$D/assets/lib"
for e in "$P"/assets/*; do b=$(basename "$e"); [ "$b" = lib ] || [[ "$b" == *.pre190 ]] || ln -s "$e" "$D/assets/$b"; done
for e in "$P"/assets/lib/*; do b=$(basename "$e"); [ "$b" = hosts.js ] || ln -s "$e" "$D/assets/lib/$b"; done
ln -s "$H" "$D/assets/lib/hosts.js"
ln -s "$P/compositions/s13-recap.html" "$D/compositions/s13-recap.html"
cp "$P/hyperframes.json" "$P/package.json" "$D/"
printf '{\n  "id": "window-%s",\n  "name": "window-%s"\n}\n' "$2" "$2" > "$D/meta.json"
if [ "$MODE" = film ]; then
  grep -v 'id="host-s\(0[0-9]\|1[0-24-9]\)-' "$P/index.html" > "$D/index.html"
else
  cp "$P/lab/s13-recap/proj/index.html" "$D/index.html"
fi
if [ -n "$DBG" ]; then
  [ "$DBG" = debug ] && DBG=debug-gate.js
  cp "$HERE/$DBG" "$D/assets/debug-gate.js"
  sed -i 's|<script src="assets/lib/hosts.js"></script>|&\n    <script src="assets/debug-gate.js"></script>|' "$D/index.html"
fi
grep -c 'data-composition-src' "$D/index.html"
