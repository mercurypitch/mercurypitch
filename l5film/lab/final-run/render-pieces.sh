#!/bin/bash
# Step 4, in pieces (DECISIONS 265, 266): check, then each 1,800-frame piece of the picture: its own
# project (lab/final-run/piece-root.py: the film's root with only the scenes on screen in the piece),
# the renderer's plan of it in memory (/dev/shm/l5-plan, extract cache off), the piece's frames by a
# fresh process with one browser, the plan cleared. Every step watched: stopped cleanly if free
# memory under the cap falls under 1.5 GiB.
# Start it holding both heavy slots, with a priority ticket:
#   HEAVY_PRI=1 HEAVY_MIN_GIB=10 setsid nohup $S/bin/heavy $S/bin/heavy bash lab/final-run/render-pieces.sh \
#     > lab/final-run/logs/05-render-pieces.out 2>&1 &
# Resumable: a piece already in renders/pieces/ is kept (the plan is cleared on every exit).
S=/tmp/claude-0/-home-user-mercurypitch/12ae313e-03fe-590a-b304-88d38ce9e159/scratchpad
P=$S/l5film
cd "$P" || exit 1
LOG=$P/lab/final-run/logs
ST=$P/lab/final-run/render-pieces.state
MEM=$LOG/05-memory.tsv
OUT=$P/renders/pieces
CHUNK=1800
GiB=1073741824
export PRODUCER_MAX_WORKERS=1 HYPERFRAMES_SKIP_SKILLS=1 HYPERFRAMES_NO_TELEMETRY=1   # one browser a piece
# no extract cache: the plan extracts straight into its own folder in memory (with the cache on, the
# frames would go to /tmp on disk and be copied into the plan as well)
export HYPERFRAMES_EXTRACT_CACHE_DIR=off
mkdir -p "$OUT"
note() { echo "$(date -u +%FT%TZ) $*" | tee -a "$ST"; }
gib() { awk -v b="$1" 'BEGIN{printf "%.2f", b/1073741824}'; }

CG=/sys/fs/cgroup/memory$(awk -F: '$2 ~ /(^|,)memory(,|$)/ {print $3; exit}' /proc/self/cgroup)
free_bytes() {   # bin/heavy's formula: the limit, less what is used, plus the inactive page cache
  local lim use inact
  lim=$(cat "$CG/memory.limit_in_bytes")
  use=$(cat "$CG/memory.usage_in_bytes")
  inact=$(awk '$1 == "total_inactive_file" {print $2}' "$CG/memory.stat")
  echo $(( lim - use + ${inact:-0} ))
}

note "start (pid $$)"
fb=$(free_bytes)
[ "$fb" -lt $((9 * GiB)) ] && { note "STOP: $(gib $fb) GiB free under the cap, under 9"; exit 3; }
note "free under the cap at start: $(gib $fb) GiB"

echo "start" > "$LOG/.piece"
[ -s "$MEM" ] || printf 'utc\tpiece\tcgroup_usage_gib\tfree_gib\tplan_shm_gib\tdisk_free_gib\n' > "$MEM"
(
  while true; do
    use=$(cat "$CG/memory.usage_in_bytes"); fb=$(free_bytes)
    ex=$(du -sk /dev/shm/l5-plan 2>/dev/null | cut -f1); ex=${ex:-0}
    disk=$(df -k / | awk 'NR==2 {print $4}')
    awk -v t="$(date -u +%FT%TZ)" -v p="$(cat "$LOG/.piece")" -v u="$use" -v f="$fb" -v e="$ex" -v d="$disk" \
      'BEGIN{printf "%s\t%s\t%.2f\t%.2f\t%.2f\t%.2f\n", t, p, u/2^30, f/2^30, e/2^20, d/2^20}' >> "$MEM"
    sleep 30
  done
) &
LOGGER=$!
# on any exit the plan's frames in memory go (only this script's)
trap 'kill $LOGGER 2>/dev/null; rm -rf /dev/shm/l5-plan' EXIT

# run "$@" in its own process group, watched every 2 s; sets PEAK_USE and MIN_FREE (bytes)
run_watched() {
  setsid "$@" &
  local pid=$! fb use
  PEAK_USE=0; MIN_FREE=$((99 * GiB))
  while kill -0 $pid 2>/dev/null; do
    fb=$(free_bytes); use=$(cat "$CG/memory.usage_in_bytes")
    [ "$use" -gt "$PEAK_USE" ] && PEAK_USE=$use
    [ "$fb" -lt "$MIN_FREE" ] && MIN_FREE=$fb
    if [ "$fb" -lt $((3 * GiB / 2)) ]; then
      note "WATCHDOG: $(gib $fb) GiB free, stopping $(cat "$LOG/.piece")"
      kill -TERM -- -$pid 2>/dev/null; sleep 10; kill -KILL -- -$pid 2>/dev/null
      wait $pid 2>/dev/null
      return 99
    fi
    sleep 2
  done
  wait $pid
}

npx --yes hyperframes@0.8.97 check > "$LOG/05-check.txt" 2>&1; rc=$?
if [ $rc != 0 ] || grep -Eq '(^|[^0-9])[1-9][0-9]* error' "$LOG/05-check.txt"; then
  note "STOP: check exit $rc or errors (logs/05-check.txt)"; exit 4
fi
note "check: 0 errors, $(grep -Eo '[0-9]+ warning\(s\)' "$LOG/05-check.txt" | head -1)"

TOTAL=34185; N=$(( (TOTAL + CHUNK - 1) / CHUNK ))
PROJ=$S/l5film-pieces
for ((i = 0; i < N; i++)); do
  f=$(printf '%s/piece-%03d.mp4' "$OUT" $i)
  [ -s "$f" ] && continue
  w=0
  while [ "$(free_bytes)" -lt $((6 * GiB)) ]; do
    [ $w -ge 600 ] && { note "STOP: under 6 GiB free for 10 minutes before piece $i"; exit 6; }
    sleep 10; w=$((w + 10))
  done
  dk=$(df -k / | awk 'NR==2 {print $4}')
  [ "$dk" -lt $((5 * 1048576 / 2)) ] && { note "STOP: $(awk -v k=$dk 'BEGIN{printf "%.2f", k/1048576}') GiB free on disk before piece $i, under 2.5"; exit 8; }
  echo "piece-$i" > "$LOG/.piece"
  t0=$(date +%s)
  scenes=$(python3 lab/final-run/piece-root.py $i $CHUNK "$PROJ/p$i")
  rm -rf /dev/shm/l5-plan
  run_watched node lab/final-run/piece.mjs plan /dev/shm/l5-plan "$PROJ/p$i" $CHUNK > "$LOG/05-piece-$i-plan.txt" 2>&1; rc=$?
  pk1=$PEAK_USE; mf1=$MIN_FREE; shm=$(du -sh /dev/shm/l5-plan 2>/dev/null | cut -f1)
  [ $rc = 0 ] || { note "STOP: piece $i plan exit $rc (logs/05-piece-$i-plan.txt)"; exit 5; }
  pl=$(grep '^PLAN ' "$LOG/05-piece-$i-plan.txt" | tail -1 | cut -c6-)
  python3 -c "import json,sys;p=json.loads(sys.argv[1]);sys.exit(0 if p['totalFrames']==$TOTAL and p['chunkCount']==$N and p['fps']==60 else 1)" "$pl" \
    || { note "STOP: piece $i plan is not the film's grid: $pl"; exit 9; }
  t1=$(date +%s)
  run_watched node lab/final-run/piece.mjs chunk /dev/shm/l5-plan $i "${f%.mp4}.tmp.mp4" > "$LOG/05-piece-$i.txt" 2>&1; rc=$?
  rm -rf /dev/shm/l5-plan
  if [ $rc != 0 ]; then
    rm -f "${f%.mp4}.tmp.mp4"
    note "STOP: piece $i exit $rc after $(( $(date +%s) - t1 )) s (logs/05-piece-$i.txt)"; exit 7
  fi
  mv "${f%.mp4}.tmp.mp4" "$f"
  [ $pk1 -gt $PEAK_USE ] && PEAK_USE=$pk1
  [ $mf1 -lt $MIN_FREE ] && MIN_FREE=$mf1
  note "piece $i ($scenes): plan $((t1 - t0)) s ($shm), frames $(( $(date +%s) - t1 )) s, $(du -h "$f" | cut -f1), peak use $(gib $PEAK_USE) GiB, least free $(gib $MIN_FREE) GiB"
done
echo done > "$LOG/.piece"
note "all $N pieces rendered"
