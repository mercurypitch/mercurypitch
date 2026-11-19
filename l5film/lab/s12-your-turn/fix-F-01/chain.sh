# Group D's F-01 round: every heavy job in turn through bin/heavy (clips, measures, the three cuts, the lab checks, the
# root check). Run from the film's folder.
H=/tmp/claude-0/-home-user-mercurypitch/12ae313e-03fe-590a-b304-88d38ce9e159/scratchpad/bin/heavy
M=/home/user/mercurypitch/.claude/skills/motion-designer/scripts/measure.py
F=lab/s12-your-turn/fix-D-01
export HF_VIDEO_EXTRACTION_FAILURE_MODE=observe HF_VIDEO_COVERAGE_THRESHOLD=0 MIX=voice
run() { echo "== $(date +%H:%M:%S) $*"; timeout 2400 $H "$@"; echo "exit $?"; }
run node tools/lab.mjs s11-sing --clip --full --stills=0,0.40,1.27,2.25,4.20,5.90,6.80,7.98,13.17,15.70,18.90,19.70,20.30,23.51,27.80,28.35,31.73,33.58,36.23,38.38,39.15 > lab/s11-sing/clip.log 2>&1; echo "s11 render: $(tail -1 lab/s11-sing/clip.log)"
run python3 $M render lab/s11-sing/clip.mp4 --out lab/s11-sing/measure > lab/s11-sing/measure.log 2>&1; echo "s11 measure: $(tail -1 lab/s11-sing/measure.log)"
run node tools/lab.mjs s12-your-turn --clip --full --stills=0,0.60,4.16,8.70,15.64,17.84,19.90,21.41,22.05,24.54,24.65,25.48,30.59,36.10,36.40,36.80,45.99,58.10,58.98,59.20,60.10,62.60,64.47,64.72,70.00,71.69,75.16,75.95,76.20,76.75 > lab/s12-your-turn/clip.log 2>&1; echo "s12 render: $(tail -1 lab/s12-your-turn/clip.log)"
run python3 $M render lab/s12-your-turn/clip.mp4 --out lab/s12-your-turn/measure > lab/s12-your-turn/measure.log 2>&1; echo "s12 measure: $(tail -1 lab/s12-your-turn/measure.log)"
for w in sing b38 recap; do
  d=$([ $w = sing ] && echo lab/s11-sing/cut-sing || echo lab/s12-your-turn/cut-$w)
  run node lab/s11-sing/cutprobe.mjs $w > lab/s12-your-turn/fix-F-01/cutprobe-$w.log 2>&1; echo "cutprobe $w: $(grep -c 'first frame' lab/s12-your-turn/fix-F-01/cutprobe-$w.log)"
  python3 $F/cutproof.py $d $([ $w = b38 ] && echo b38) > $d/proof.txt 2>&1
  if [ $w = sing ]; then R="band:1000,205,1640,285 line:1000,240,1640,250 edges:1000,206,1640,214"; elif [ $w = recap ]; then R="band:928,99,1824,207 line:928,148,1824,158 edges:928,100,1824,108"; else R=""; fi
  [ -n "$R" ] && { python3 lab/s05-push/cutdiff.py $d/out.png $d/in.png $R > $d/cutdiff.txt; python3 lab/s05-push/cutdiff.py $d/out60.png $d/in60.png $R >> $d/cutdiff.txt; }
  rm -rf $d/measure; run python3 $M render $d/cut-$w.mp4 --out $d/measure > $d/measure.log 2>&1; echo "measure $w: $(tail -1 $d/measure.log)"
done
run npx --yes hyperframes@0.8.97 check lab/s11-sing/proj --at=1.27,6.80,19.70,27.80,31.73,37.12 > lab/s11-sing/check.log 2>&1; echo "check s11: $(tail -2 lab/s11-sing/check.log | tr '\n' ' ')"
run npx --yes hyperframes@0.8.97 check lab/s12-your-turn/proj --at=4.16,17.84,21.41,24.65,30.59,45.99 > lab/s12-your-turn/check.log 2>&1; echo "check s12 a: $(tail -2 lab/s12-your-turn/check.log | tr '\n' ' ')"
run npx --yes hyperframes@0.8.97 check lab/s12-your-turn/proj --at=36.80,59.20,62.60,64.72,71.69,75.16 > lab/s12-your-turn/check-2.log 2>&1; echo "check s12 b: $(tail -2 lab/s12-your-turn/check-2.log | tr '\n' ' ')"
run npx --yes hyperframes@0.8.97 check > lab/s12-your-turn/root-check.log 2>&1; echo "root: $(tail -2 lab/s12-your-turn/root-check.log | tr '\n' ' ')"
echo "done $(date +%H:%M:%S)"
