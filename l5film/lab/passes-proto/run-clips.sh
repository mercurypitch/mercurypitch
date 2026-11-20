#!/bin/bash
# The lab's clips and measures, one at a time through the scratchpad's heavy helper (from the film's root):
#   bash lab/passes-proto/run-clips.sh <step>...   steps: wait s08 cut-before cut-after f60
# Everything is written under lab/passes-proto/. The film's scenes and passes are only read.
set -u
S=${S:-$(cd "$(dirname "$0")/../../.." && pwd)}
L=lab/passes-proto
H="$S/bin/heavy"
SK=/home/user/mercurypitch/.claude/worktrees/fix/.claude/skills/motion-designer
export HF_VIDEO_EXTRACTION_FAILURE_MODE=observe
log() { echo "$(date '+%H:%M:%S') $*" | tee -a $L/logs/clips.log; }
for step in "$@"; do
  case $step in
    wait) while pgrep -f "run-chain.sh" > /dev/null; do sleep 5; done ;;
    s08)
      log "S8 after: clip, measure.py, holds by region"
      "$H" node $L/protolab.mjs s08-after --scenes=s08-breathe > $L/logs/s08-after.log 2>&1 || log "s08-after FAILED"
      "$H" python3 $SK/scripts/measure.py render $L/s08-after/clip.mp4 --out $L/s08-after/measure > $L/s08-after/measure.log 2>&1
      "$H" python3 $L/holds.py $L/s08-after/clip.mp4 --scene s08-breathe --hosts small --csv $L/s08-after/holds.csv > $L/s08-after/holds.txt 2>&1 ;;
    cut-before)
      # the cut on `end` on the film's own frames: film frame 15821 is the clip's frame 0, S15's first is 477
      log "cut on end: the film's chunks either side"
      "$H" node $L/protolab.mjs cut-end-before --scenes=s14-next,s15-end --proto= --film --mix=none > $L/logs/cut-end-before.log 2>&1 || log "cut-end-before FAILED"
      "$H" python3 $L/cutbox.py $L/cut-end-before/clip.mp4 --cut 477 --label "cut-end-before" --pair $L/cut-end-before/pair.png > $L/cut-end-before/cutbox.txt 2>&1 ;;
    cut-after)
      log "cut on end: S14's chunks at 300 px (the final profile), S15's current chunks"
      "$H" node $L/protolab.mjs cut-end-a --scenes=s14-next,s15-end --proto=s14-next --film --mix=none > $L/logs/cut-end-a.log 2>&1 || log "cut-end-a FAILED"
      log "cut on end: both scenes' chunks in the final profile"
      "$H" node $L/protolab.mjs cut-end-b --scenes=s14-next,s15-end --film --mix=none > $L/logs/cut-end-b.log 2>&1 || log "cut-end-b FAILED"
      for v in a b; do
        "$H" python3 $L/cutbox.py $L/cut-end-$v/clip.mp4 --cut 477 --label "cut-end-$v" --pair $L/cut-end-$v/pair.png > $L/cut-end-$v/cutbox.txt 2>&1
      done ;;
    f60)
      log "60 fps: the numbered chunk, its roots, S4 on the film's frames at 60 fps, the numbers read back"
      mkdir -p $L/final60/merc-coded
      "$H" python3 $L/coded.py make $L/final60/merc/m-blue-s04-merc.webm $L/final60/merc-coded/m-blue-s04-merc.webm > $L/final60/coded-make.txt 2>&1
      ln -sf ../../../../assets/merc/m-orange-s04-merc.webm $L/final60/merc-coded/m-orange-s04-merc.webm
      python3 tools/merc-roots.py --shots=$L/final60/shots --merc=$L/final60/merc --out=$L/final60/merc-coded/roots.js > $L/final60/roots.txt 2>&1
      "$H" node $L/protolab.mjs f60-s04 --scenes=s04-recall --shots=$L/final60/shots --merc=$L/final60/merc-coded --fps=60 --film --mix=none > $L/logs/f60-s04.log 2>&1 || log "f60-s04 FAILED"
      "$H" python3 $L/coded.py read $L/f60-s04/clip.mp4 --left -40 --top 589.2 --shown 300 --drawn 225 --film-frame 3172 --pass-first 3537 --from 400 > $L/f60-s04/read.txt 2>&1 ;;
  esac
done
log "done: $*"
