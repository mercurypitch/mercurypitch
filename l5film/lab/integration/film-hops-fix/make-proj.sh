#!/bin/bash
# make-proj.sh <P> <name> <hosts.js>: a project that is the film's root (P/index.html) with only s13's
# host left (no other scene is on screen from 462.370 to 527.395 s, so s13's timing is the film's own),
# the live assets and s13 linked, and assets/lib/hosts.js taken from <hosts.js>.
set -euo pipefail
P=$1; D=$(dirname "$0")/$2; H=$3
rm -rf "$D"; mkdir -p "$D/compositions" "$D/assets/lib"
for e in "$P"/assets/*; do b=$(basename "$e"); [ "$b" = lib ] || [[ "$b" == *.pre190 ]] || ln -s "$e" "$D/assets/$b"; done
for e in "$P"/assets/lib/*; do b=$(basename "$e"); [ "$b" = hosts.js ] || ln -s "$e" "$D/assets/lib/$b"; done
ln -s "$H" "$D/assets/lib/hosts.js"
ln -s "$P/compositions/s13-recap.html" "$D/compositions/s13-recap.html"
cp "$P/hyperframes.json" "$P/package.json" "$D/"
printf '{\n  "id": "film-window-%s",\n  "name": "film-window-%s"\n}\n' "$2" "$2" > "$D/meta.json"
grep -v 'id="host-s\(0[0-9]\|1[0-24-9]\)-' "$P/index.html" > "$D/index.html"
grep -c 'data-composition-src' "$D/index.html"
