#!/usr/bin/env bash
# Memory guard for a running render-l4.sh, in place of render-switch.sh's memory test. render-switch.sh holds
# the cgroup path from before the 04:16 container restart (1 Nov); the cgroup is now under another id and the
# old path is gone, so its "rss + shmem > MEM_STOP" test reads nothing and can never fire. This finds the
# cgroup afresh and makes the same switch: when rss + shmem passes MEM_STOP MiB, stop render-l4.sh's process
# group and resume on 1 worker recycling the browser every 3 pieces; render-l4.sh then runs its seam check,
# repairs and after-render steps as usual.
#
#   mem-guard.sh <name> <frozen project> <pgid of render-l4.sh>      (MEM_STOP default 12400, KEEP_MB default 50)
#
# Log: l4entr/<name>-switch.log (the same log render-switch.sh writes). It stands down when the capture ends.
set -u
NAME=${1:?name}; SRC=${2:?frozen project}; PG=${3:?pgid of render-l4.sh}
S=/tmp/claude-0/-home-user-mercurypitch/12ae313e-03fe-590a-b304-88d38ce9e159/scratchpad
MEM_STOP=${MEM_STOP:-12400}
KEEP_MB=${KEEP_MB:-50}
G=$(dirname "$(ls /sys/fs/cgroup/memory/process_api/*/claude-code-bash/memory.stat 2>/dev/null | head -1)")
LOG=$S/l4entr/$NAME-switch.log
ST=/home/user/mercurypitch/output/motion/lesson-04/renders/$NAME.status
say() { echo "$(date -u +%T) $*" | tee -a "$LOG"; }
mem() { echo $(( ($(awk '/^total_rss /{print $2}' "$G/memory.stat") + $(awk '/^total_shmem /{print $2}' "$G/memory.stat")) / 1048576 )); }
done_pieces() {
  local f; f=$(ls -t "$SRC"/renders/.hf-segments/*/segments.json 2>/dev/null | head -1)
  [ -n "$f" ] && python3 -c "import json,sys; print(len(json.load(open(sys.argv[1]))['completed']))" "$f" 2>/dev/null || echo 0
}

[ -f "$G/memory.stat" ] || { say "mem-guard STOP: no cgroup memory.stat found"; exit 1; }
m0=$(mem) || { say "mem-guard STOP: cannot read rss+shmem from $G"; exit 1; }
kill -0 "$PG" 2>/dev/null || { say "mem-guard STOP: pgid $PG is not running"; exit 1; }
say "mem-guard: watching render-l4.sh pgid $PG every 3 s in $G; now rss+shmem $m0 MiB, pieces $(done_pieces); switch at > $MEM_STOP MiB"
# Armed only while the capture runs: once render-l4.sh writes "render end exit", it is into its seam check and
# after-render steps (a trip there would start a needless resume render), so the guard stands down.
n0=$(wc -l < "$ST")
reason=""
while kill -0 "$PG" 2>/dev/null; do
  e=$(tail -n +$((n0 + 1)) "$ST" | grep -m1 "render end exit")
  if [ -n "$e" ]; then say "mem-guard: the capture ended ($e); standing down"; exit 0; fi
  m=$(mem 2>/dev/null) || m=0
  if [ "${m:-0}" -gt "$MEM_STOP" ]; then reason="rss+shmem $m MiB"; break; fi
  sleep 3
done
if [ -z "$reason" ]; then
  say "mem-guard: render-l4.sh ended on its own (pieces $(done_pieces)); see $ST"
  exit 0
fi
say "mem-guard switching: $reason (pieces $(done_pieces)); stopping process group $PG"
kill -TERM -"$PG" 2>/dev/null
for i in $(seq 1 30); do pgrep -f "render .*--output /dev/shm/l4film/$NAME.mp4" >/dev/null || break; sleep 2; done
pgrep -f "render .*--output /dev/shm/l4film/$NAME.mp4" >/dev/null && { say "mem-guard STOP: the 2-worker render did not exit"; exit 1; }
# Its browsers close with it (31 Oct, 22:52); give them a moment, then stop any left behind (no other render runs).
for i in $(seq 1 10); do pgrep -f chrome-headless-shell >/dev/null || break; sleep 2; done
if pgrep -f chrome-headless-shell >/dev/null; then
  say "mem-guard: $(pgrep -fc chrome-headless-shell) browser processes left behind; stopping them"
  pkill -TERM -f chrome-headless-shell; sleep 5
fi
sleep 3
echo "$(date -u +%T) phase 1 stopped by mem-guard ($reason); resuming on 1 worker, recycling every 3 pieces" >> "$ST"
say "phase 2: resume on 1 worker (pieces done $(done_pieces); rss+shmem $(mem) MiB)"
RESUME=1 WORKERS=1 HF_SEGMENT_BROWSER_RECYCLE=3 KEEP_MB=$KEEP_MB setsid nohup bash "$S/render-l4.sh" "$NAME" 60 high "$SRC" >/dev/null 2>&1 &
sleep 5
say "phase 2 started: $(pgrep -f "render-l4.sh $NAME 60 high" | head -1)"
