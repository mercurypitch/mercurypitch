#!/usr/bin/env bash
# Render a Lesson 4 master on two browsers through the light first part of the film, then on one
# browser that is recycled every 3 pieces through the hosts' scenes (S12 and S13), where two
# browsers ran out of memory on 31 Oct (film-05: OOM at 20:58 in pieces 16-17, and a never-recycled
# single browser grew to 5.3 GB by 22:18).
#
#   render-switch.sh <name> <frozen project> [switch-at-pieces]     (default: switch once 14 pieces are done)
#
# Phase 1: render-l4.sh with WORKERS=2 (recycling 3). When segments.json lists SWITCH completed pieces,
# or the cgroup's rss + shmem passes MEM_STOP MiB, it stops render-l4.sh's process group and
# Phase 2: resumes with RESUME=1 WORKERS=1 HF_SEGMENT_BROWSER_RECYCLE=3; render-l4.sh then runs its seam
# check, repairs and after-render steps as usual. Log: l4entr/<name>-switch.log
set -u
NAME=${1:?name}; SRC=${2:?frozen project}; SWITCH=${3:-14}
S=/tmp/claude-0/-home-user-mercurypitch/12ae313e-03fe-590a-b304-88d38ce9e159/scratchpad
G=/sys/fs/cgroup/memory/process_api/01a19218-572b-75fe-a200-d6510d3dd7b1/claude-code-bash
MEM_STOP=${MEM_STOP:-12600}
LOG=$S/l4entr/$NAME-switch.log
ST=/home/user/mercurypitch/output/motion/lesson-04/renders/$NAME.status
say() { echo "$(date -u +%T) $*" | tee -a "$LOG"; }
mem() { echo $(( ($(awk '/^total_rss /{print $2}' $G/memory.stat) + $(awk '/^total_shmem /{print $2}' $G/memory.stat)) / 1048576 )); }
done_pieces() {
  local f; f=$(ls -t "$SRC"/renders/.hf-segments/*/segments.json 2>/dev/null | head -1)
  [ -n "$f" ] && python3 -c "import json,sys; print(len(json.load(open(sys.argv[1]))['completed']))" "$f" 2>/dev/null || echo 0
}

say "phase 1: $NAME from $SRC on 2 workers until $SWITCH pieces are done (or rss+shmem > $MEM_STOP MiB)"
WORKERS=2 setsid nohup bash "$S/render-l4.sh" "$NAME" 60 high "$SRC" >/dev/null 2>&1 &
sleep 5
PG=$(pgrep -f "render-l4.sh $NAME 60 high" | head -1)
[ -n "$PG" ] || { say "STOP: render-l4.sh did not start"; exit 1; }
say "render-l4.sh pid/pgid $PG"
reason=""
while kill -0 "$PG" 2>/dev/null; do
  n=$(done_pieces); m=$(mem)
  if [ "$n" -ge "$SWITCH" ]; then reason="$n pieces done"; break; fi
  if [ "$m" -gt "$MEM_STOP" ]; then reason="rss+shmem $m MiB"; break; fi
  sleep 10
done
if [ -z "$reason" ]; then
  say "render-l4.sh ended on its own in phase 1 (pieces $(done_pieces)); see $ST"
  exit 0
fi
say "switching: $reason; stopping process group $PG"
kill -TERM -"$PG" 2>/dev/null
# Only this film's render (a builder's lab render may be running too): its node exits on SIGTERM and
# puppeteer closes its browser (seen on 31 Oct at 22:52).
for i in $(seq 1 30); do pgrep -f "render .*--output /dev/shm/l4film/$NAME.mp4" >/dev/null || break; sleep 2; done
pgrep -f "render .*--output /dev/shm/l4film/$NAME.mp4" >/dev/null && { say "STOP: the phase 1 render did not exit"; exit 1; }
sleep 3
echo "$(date -u +%T) phase 1 stopped ($reason); resuming on 1 worker, recycling every 3 pieces" >> "$ST"
say "phase 2: resume on 1 worker (pieces done $(done_pieces))"
RESUME=1 WORKERS=1 HF_SEGMENT_BROWSER_RECYCLE=3 setsid nohup bash "$S/render-l4.sh" "$NAME" 60 high "$SRC" >/dev/null 2>&1 &
sleep 5
say "phase 2 started: $(pgrep -f "render-l4.sh $NAME 60 high" | head -1)"
