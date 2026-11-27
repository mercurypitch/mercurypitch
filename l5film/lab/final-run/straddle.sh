#!/bin/bash
# A second look at the joins (DECISIONS 269): the same renderer's frames around a join, rendered from
# inside one range that straddles it (1,300-frame ranges, whose edges fall nowhere near a 1,800 join),
# against the joined picture's frames. Holds both heavy slots like the pieces:
#   HEAVY_PRI=1 HEAVY_MIN_GIB=10 $S/bin/heavy $S/bin/heavy bash lab/final-run/straddle.sh 1800 18000 19800
S=/tmp/claude-0/-home-user-mercurypitch/12ae313e-03fe-590a-b304-88d38ce9e159/scratchpad
P=$S/l5film
cd "$P" || exit 1
export PRODUCER_MAX_WORKERS=1 HYPERFRAMES_SKIP_SKILLS=1 HYPERFRAMES_NO_TELEMETRY=1
export HYPERFRAMES_EXTRACT_CACHE_DIR=/dev/shm/l5-cache HYPERFRAMES_EXTRACT_CACHE_MAX_MB=8192
trap 'rm -rf /dev/shm/l5-plan /dev/shm/l5-cache' EXIT
C=1300; J=review/final-film/joins/straddle; mkdir -p $J
for F in "$@"; do
  i=$((F / C))
  python3 lab/final-run/piece-root.py $i $C $S/l5film-pieces/straddle-$i > /dev/null
  rm -rf /dev/shm/l5-plan /dev/shm/l5-cache
  node lab/final-run/piece.mjs plan /dev/shm/l5-plan $S/l5film-pieces/straddle-$i $C > $J/plan-$F.txt 2>&1 || { echo "plan $F failed"; exit 2; }
  rm -rf /dev/shm/l5-cache
  node lab/final-run/piece.mjs chunk /dev/shm/l5-plan $i $J/range-$F.mp4 > $J/chunk-$F.txt 2>&1 || { echo "chunk $F failed"; exit 3; }
  rm -rf /dev/shm/l5-plan
  for g in $((F - 2)) $((F - 1)) $F $((F + 1)); do
    ffmpeg -v error -y -i $J/range-$F.mp4 -vf "select=eq(n\,$((g - i * C)))" -frames:v 1 $J/range-f$g.png
    ffmpeg -v error -y -i renders/pieces/picture.mp4 -vf "select=eq(n\,$g)" -frames:v 1 $J/film-f$g.png
  done
  python3 - "$J" $F <<'EOF'
import sys
import numpy as np
from PIL import Image
J, F = sys.argv[1], int(sys.argv[2])
for g in range(F - 2, F + 2):
    a = np.asarray(Image.open(f'{J}/range-f{g}.png').convert('RGB'), dtype=np.int16)
    b = np.asarray(Image.open(f'{J}/film-f{g}.png').convert('RGB'), dtype=np.int16)
    d = np.abs(a - b).max(axis=2)
    side = 'before the join' if g < F else 'after the join'
    print(f'| {F} | {g} ({side}) | {int((d > 24).sum())} | {int((d > 8).sum())} | {int(d.max())} | {d.mean():.3f} |')
EOF
done
