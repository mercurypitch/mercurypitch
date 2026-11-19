#!/bin/bash
# the six chapter cards on the live project: each scene's first 2.4 s (its card is in at 0.37, out from 1.85)
cd "$1"
for sid in s05-push s06-diaphragm s08-breathe s09-onset s10-steady s11-sing; do
  node tools/lab.mjs $sid --clip --from=0.01 --len=2.4 2>&1 | grep -E "^clip|rror"
  mv -f lab/$sid/clip-0.01.mp4 lab/integration/item2-card/$sid-card.mp4
done
