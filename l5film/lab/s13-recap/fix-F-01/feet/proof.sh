#!/bin/bash
# Group E, F-01 follow-up (the Voice Mirror card's foot): the proof after s13's render, one heavy job at a time.
S=$(cd "$(dirname "$0")/../../../../.." && pwd); P=$S/l5film; M=${M:?set M to the motion-designer measure.py in the read-only checkout}
cd $P
F=lab/s13-recap/fix-F-01/feet
mkdir -p $F/old/parts && mv lab/s13-recap/parts/* $F/old/parts/
for spec in "a 0 27.94" "b 27.34 46.6" "c 46.2 65.025"; do set -- $spec; $S/bin/heavy ffmpeg -nostdin -hide_banner -loglevel error -y -ss $2 -i lab/s13-recap/clip.mp4 -t $(python3 -c "print(round($3-$2,3))") -c:v libx264 -crf 16 -preset veryfast -pix_fmt yuv420p -c:a aac -b:a 192k lab/s13-recap/parts/part-$1-$2-$3.mp4; echo "part $1 $?"; done
rm -rf lab/s13-recap/measure; $S/bin/heavy python3 $M render lab/s13-recap/clip.mp4 --out lab/s13-recap/measure > lab/s13-recap/measure.log 2>&1; echo "measure s13 $?"
for f in lab/s13-recap/parts/part-*.mp4; do n=$(basename $f .mp4); $S/bin/heavy python3 $M render $f --out lab/s13-recap/parts/measure-$n > lab/s13-recap/parts/measure-$n.log 2>&1; echo "measure $n $?"; done
mkdir -p $F/old/probe && mv lab/s13-recap/probe-*.png $F/old/probe/ 2>/dev/null
$S/bin/heavy env SHOTS=1 node lab/s05-push/probe.mjs s13-recap > lab/s13-recap/probe.log 2>&1; echo "probe s13 $?"
$S/bin/heavy node lab/s13-recap/cutprobe.mjs next > $F/cutprobe-next.log 2>&1; echo "cut next $?"
rm -rf lab/s14-next/cut-next/measure; $S/bin/heavy python3 $M render lab/s14-next/cut-next/cut-next.mp4 --out lab/s14-next/cut-next/measure > lab/s14-next/cut-next/measure.log 2>&1; echo "cutmeasure next $?"
HF_VIDEO_EXTRACTION_FAILURE_MODE=observe HF_VIDEO_COVERAGE_THRESHOLD=0 $S/bin/heavy npx --yes hyperframes@0.8.97 check > $F/root-check.log 2>&1; echo "rootcheck $?"
$S/bin/heavy npx --yes hyperframes@0.8.97 check lab/s13-recap/proj --at=31.9,38.85,39.05,40.05,46.6 > $F/contrast-check.log 2>&1; echo "contrast13 $?"
echo "all done"
