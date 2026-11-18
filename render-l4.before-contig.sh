#!/bin/bash
# Lesson 4: render, music-only mux, contact sheet and measurements, detached-safe.
#   setsid nohup bash render-l4.sh <name> [fps] [quality] >/dev/null 2>&1 &
# Progress in renders/<name>.status; the render's own log in renders/<name>.log.
# Never edit this file while it runs: bash reads a script as it goes.
# The renderer refuses to start below 1024 MB free at its temp folder and at its output folder, and /
# is short, so it renders into /dev/shm/l4film and the films move into renders/ only while that leaves
# KEEP_MB free on /; otherwise they stay in /dev/shm/l4film (RAM: lost if the container restarts) and
# the status file says so. Keep the frozen copy (SRC) on disk, not in /dev/shm: the finished pieces
# are written under it, and a container restart clears /dev/shm (08:07 on 30 Oct took 18 of 20).
NAME=${1:?name}
FPS=${2:-60}
Q=${3:-high}
# the project to render (default the live one; a frozen copy keeps builders' later edits out of it)
SRC=${4:-/home/user/mercurypitch/output/motion/lesson-04}
KEEP_MB=1150
# Segmented capture: the film renders in SEGF-frame pieces, each worker on its own browser (recycled
# every 3 pieces), and finished pieces are recorded under $SRC/renders/.hf-segments. One unsegmented
# 4-worker render of the whole film stalled at frame 20921 (30 Oct). RESUME=1 re-runs only the
# pieces that did not finish and appends to the status and log.
SEGF=${SEGF:-1500}
# Workers: the shell's memory cgroup is capped at 13.36 GiB and the renderer's extracted-frame cache
# (/dev/shm/hyperframes-extract-cache-0, 4.4 GB for this film) is charged to it. Renderers grow to
# about 2.2 GB in s12-s13: four workers were killed twice and three once on 30 Oct (dmesg;
# memory.oom_control oom_kill), which the renderer reports as a capture stall. Two is the default.
WORKERS=${WORKERS:-2}
# Seams: a fresh browser can capture a piece's first frames before its seek lands (blank frames, then
# a frame of the film's opening: film-01's pieces 9 and 10 on 30 Oct). seamcheck.py finds such pieces;
# each is dropped from the piece list and re-rendered with --resume, at most SEAM_TRIES times.
SEAM_TRIES=${SEAM_TRIES:-3}
SEAMCHECK=/tmp/claude-0/-home-user-mercurypitch/12ae313e-03fe-590a-b304-88d38ce9e159/scratchpad/seamcheck.py
EXTRA="--keep-segments"
[ "${RESUME:-0}" = 1 ] && EXTRA="$EXTRA --resume"
cd /home/user/mercurypitch/output/motion/lesson-04 || exit 1
mkdir -p renders review /dev/shm/l4film
OUT=/dev/shm/l4film
ST=renders/$NAME.status
LINE="$(date -u +%T) render start $NAME fps=$FPS quality=$Q from $SRC (to $OUT) segments of $SEGF, $WORKERS workers $EXTRA"
if [ "${RESUME:-0}" = 1 ]; then
  echo "$LINE" >> $ST; echo "=== resume $(date -u +%T)" >> renders/$NAME.log
else
  echo "$LINE" > $ST; : > renders/$NAME.log
fi
tries=0
while :; do
  (cd "$SRC" && TMPDIR=/dev/shm HF_SEGMENTED_CAPTURE=true HF_SEGMENT_FRAMES=$SEGF \
    HYPERFRAMES_RENDER_DETACHED=1 HYPERFRAMES_SKIP_SKILLS=1 HYPERFRAMES_NO_TELEMETRY=1 \
    npx --yes hyperframes@0.8.97 render --fps "$FPS" --quality "$Q" --workers "$WORKERS" --strict $EXTRA \
    --output $OUT/$NAME.mp4) >> renders/$NAME.log 2>&1
  code=$?
  echo "$(date -u +%T) render end exit $code" >> $ST
  [ $code -eq 0 ] || break
  seams=$(cd /dev/shm && python3 -I "$SEAMCHECK" $OUT/$NAME.mp4 --seg $SEGF --fps $FPS 2>&1 | tee renders/$NAME.seams | tail -1)
  echo "$(date -u +%T) seams: $seams" >> $ST
  case "$seams" in
    CLEAN) break ;;
    "BAD "*) ;;
    *) code=5; echo "$(date -u +%T) the seam check did not run; pieces kept" >> $ST; break ;;
  esac
  tries=$((tries + 1))
  if [ $tries -gt $SEAM_TRIES ]; then
    code=4; echo "$(date -u +%T) seams still bad after $SEAM_TRIES re-renders; pieces kept" >> $ST; break
  fi
  python3 -I - "$SRC/renders/.hf-segments" ${seams#BAD } >> $ST 2>&1 <<'PY'
import glob, json, os, sys
root, bad = sys.argv[1], {int(x) for x in sys.argv[2:]}
for mf in glob.glob(os.path.join(root, "*", "segments.json")):
    m = json.load(open(mf))
    for e in m["completed"]:
        if e["index"] in bad and os.path.exists(e["path"]):
            os.remove(e["path"])
    m["completed"] = [e for e in m["completed"] if e["index"] not in bad]
    json.dump(m, open(mf, "w"), indent=2)
    print(f"dropped pieces {sorted(bad)} from {os.path.basename(os.path.dirname(mf))}, {len(m['completed'])} kept")
PY
  echo "=== seam re-render $tries $(date -u +%T)" >> renders/$NAME.log
  EXTRA="--keep-segments --resume"
done
if [ $code -eq 0 ]; then
  want=$(grep -o '"durationSeconds":[0-9.]*' renders/$NAME.log | tail -1 | cut -d: -f2)
  dur=$(ffprobe -v error -show_entries format=duration -of csv=p=0 $OUT/$NAME.mp4)
  echo "$(date -u +%T) film $dur s (composition $want s)" >> $ST
  # The pieces only serve a resume. Once the film is whole and its seams clean they go, which frees
  # about 100 MB on /.
  if python3 -c "import sys; sys.exit(0 if abs(float('$dur') - float('$want')) < 0.1 else 1)" 2>/dev/null; then
    rm -rf "${SRC:?}/renders/.hf-segments" && echo "$(date -u +%T) pieces removed" >> $ST
  fi
  ffmpeg -v error -y -i $OUT/$NAME.mp4 -i assets/audio/music-only.wav -map 0:v:0 -map 1:a:0 \
    -c:v copy -c:a aac -movflags +faststart $OUT/$NAME-music-only.mp4
  echo "$(date -u +%T) music-only exit $?" >> $ST
  need=$(( ($(stat -c %s $OUT/$NAME.mp4) + $(stat -c %s $OUT/$NAME-music-only.mp4)) / 1048576 + KEEP_MB ))
  free=$(df -m --output=avail / | tail -1 | tr -d ' ')
  FD=$OUT
  if [ "$free" -gt "$need" ]; then
    mv $OUT/$NAME.mp4 $OUT/$NAME-music-only.mp4 renders/ && FD=renders && echo "$(date -u +%T) films moved into renders/ (free $free MB, needed $need)" >> $ST
  else
    echo "$(date -u +%T) films kept in $OUT: / has $free MB free, needs $need" >> $ST
  fi
  ffmpeg -v error -y -i $FD/$NAME.mp4 -vf "fps=1/10,scale=384:-2,tile=6x9" -frames:v 1 \
    renders/contact-sheet-$NAME.jpg
  echo "$(date -u +%T) contact sheet exit $?" >> $ST
  M=/home/user/mercurypitch/.claude/skills/motion-designer/scripts/measure.py
  O=review/measure-$NAME
  mkdir -p $O
  TMPDIR=/dev/shm python3 $M render $FD/$NAME.mp4 --out $O > $O.log 2>&1
  echo "$(date -u +%T) measure render exit $?" >> $ST
  TMPDIR=/dev/shm python3 $M audio $FD/$NAME.mp4 --music-only $FD/$NAME-music-only.mp4 --out $O >> $O.log 2>&1
  echo "$(date -u +%T) measure audio exit $?" >> $ST
fi
echo "$(date -u +%T) done" >> $ST
