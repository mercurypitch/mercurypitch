#!/bin/bash
# The lab's renders, one at a time through the scratchpad's heavy helper (from the film's root):
#   bash lab/passes-proto/run-chain.sh <step>...      steps: s08 s14 s15 eye f60
# Everything is written under lab/passes-proto/. The film's own passes are only read.
set -u
S=${S:-$(cd "$(dirname "$0")/../../.." && pwd)}
L=lab/passes-proto
H="$S/bin/heavy"
log() { echo "$(date '+%H:%M:%S') $*" | tee -a $L/logs/chain.log; }
pass() { "$H" node tools/merc-pass.mjs "$@" 2>&1 | tr '\r' '\n' | grep -v '^m-[a-z]*-[a-z0-9-]* [0-9]*/[0-9]*$' | tee -a $L/logs/render.log; }
for step in "$@"; do
  case $step in
    s08) for id in m-blue m-orange; do log "$id-s08"; pass $L/shots/$id.json --chunk=$id-s08 --out=$L/merc; done ;;
    s14) for id in m-blue m-orange; do log "$id-s14 at 400"; pass $L/shots/$id.json --chunk=$id-s14 --out=$L/merc; done ;;
    s15) for id in m-blue m-orange; do log "$id-s15"; pass $L/shots/$id.json --chunk=$id-s15 --out=$L/merc; done ;;
    eye) log "the S6 to S7 cut, pass frames 3355 to 3420"; pass $L/shots/m-blue.json --from=3355 --to=3420 --out=$L/eye-turn ;;
    f60) log "m-blue-s04 at 60 fps"; pass $L/final60/shots/m-blue.json --chunk=m-blue-s04 --out=$L/final60/merc --dump=0,1,2,457,458,459 ;;
  esac
done
log "done: $*"
