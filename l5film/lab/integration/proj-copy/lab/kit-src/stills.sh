#!/bin/bash
# Every kit lab's stills through tools/lab.mjs (HyperFrames snapshot), one page after another.
# Run from the film's root inside the heavy helper:  $S/bin/heavy bash lab/kit-src/stills.sh [name ...]
set -e
declare -A T=(
  [room]=0.2,3.6,7.0,7.75,8.35,12.75,14.55,16.45,26.85,29.15,31.05,33.45,35.31,37.21,41.2
  [type]=1.2,1.95,3.9,5.0
  [chart]=0.6,2.0,4.5,7.2,11.9
  [figure]=0.1,1.4,3.4,5.2,6.9,7.5,8.9,10.5
  [gauge]=0.0,0.7,2.0,3.3,5.9,6.3,7.4,8.9
  [mixup]=0.75,1.5,3.5,4.9,6.9
  [title]=0.3,0.6,0.75,1.06,1.6,3.1
  [cuts]=1.95,2.0,2.15,2.4,5.95,6.0,6.15,6.4
  [folds]=1.1,2.0,2.9,5.5,7.9
  [turn]=0.9,5.9,6.2,7.6
  [recap]=0.0,0.8,2.9,4.9,9.4
  [tease]=0.8,1.6,4.0,6.9,8.4,9.9
  [hook]=1.47,3.4,4.15
)
names=("$@"); [ ${#names[@]} -eq 0 ] && names=(room type chart figure gauge mixup folds turn recap tease hook title cuts)
for n in "${names[@]}"; do node tools/lab.mjs "kit:$n" "${T[$n]}" 2>&1 | grep -E "^still|rror" || true; done
