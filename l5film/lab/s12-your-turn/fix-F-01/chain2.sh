# Group D's F-01 round, second chain: the probes (the feel check now wants 55 %), the recap cut against group E's
# real S13, and a frame-exact look at s12's 54.867 jump. Run from the film's folder.
H=/tmp/claude-0/-home-user-mercurypitch/12ae313e-03fe-590a-b304-88d38ce9e159/scratchpad/bin/heavy
M=/home/user/mercurypitch/.claude/skills/motion-designer/scripts/measure.py
F=lab/s12-your-turn/fix-F-01
run() { echo "== $(date +%H:%M:%S) $*"; timeout 2400 $H "$@"; echo "exit $?"; }
run node lab/s05-push/probe.mjs s11-sing s12-your-turn > $F/probe.log 2>&1; echo "probe: $(grep -c "^  ok " $F/probe.log) ok, $(grep -c "^  FAIL" $F/probe.log) fail"
REAL=1 run node lab/s11-sing/cutprobe.mjs recap > $F/cutprobe-recap-real.log 2>&1; echo "cutprobe recap real: $(grep -c 'first frame' $F/cutprobe-recap-real.log)"
d=lab/s12-your-turn/cut-recap-real
python3 lab/s05-push/cutdiff.py $d/out.png $d/in.png band:928,99,1824,207 line:928,148,1824,158 edges:928,100,1824,108 > $d/cutdiff.txt
python3 lab/s05-push/cutdiff.py $d/out60.png $d/in60.png band:928,99,1824,207 line:928,148,1824,158 edges:928,100,1824,108 >> $d/cutdiff.txt
rm -rf $F/dense-54.867; run python3 $M dense lab/s12-your-turn/clip.mp4 --out $F/dense-54.867 --at 54.867 --window 0.3 --fps 30 > $F/dense-54.867.log 2>&1; echo "dense: $(tail -1 $F/dense-54.867.log)"
echo "done $(date +%H:%M:%S)"
