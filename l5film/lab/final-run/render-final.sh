#!/bin/bash
# Steps 4 and 6a of the final run (DECISIONS 262): check, the 60 fps film, check the music-only
# sibling, its render, each with the passes' frames extracted to memory (/dev/shm/l5-extract).
# Start it holding both heavy slots, with a priority ticket:
#   HEAVY_PRI=1 HEAVY_MIN_GIB=10 $S/bin/heavy $S/bin/heavy bash lab/final-run/render-final.sh \
#     > lab/final-run/logs/04-render-final.out 2>&1
# If it died part-way: rm -rf /dev/shm/l5-extract (only this script's frames), then start it again.
# A film already rendered is kept: SKIP_FILM=1 starts at the music-only render.
S=/tmp/claude-0/-home-user-mercurypitch/12ae313e-03fe-590a-b304-88d38ce9e159/scratchpad
P=$S/l5film
M=$S/l5film-music-only
LOG=$P/lab/final-run/logs
ST=$P/lab/final-run/render-final.state
MEM=$LOG/04-memory.tsv
note() { echo "$(date -u +%FT%TZ) $*" | tee -a "$ST"; }

# free bytes under the cap, as bin/heavy reads them: the limit, less what is used, plus the page
# cache the kernel can drop; the cgroup path read from /proc/self/cgroup
CG=/sys/fs/cgroup/memory$(awk -F: '$2 ~ /(^|,)memory(,|$)/ {print $3; exit}' /proc/self/cgroup)
free_bytes() {
  [ -r "$CG/memory.limit_in_bytes" ] || { echo -1; return; }
  local lim use inact
  lim=$(cat "$CG/memory.limit_in_bytes")
  use=$(cat "$CG/memory.usage_in_bytes")
  inact=$(awk '$1 == "total_inactive_file" {print $2}' "$CG/memory.stat")
  echo $(( lim - use + ${inact:-0} ))
}

note "start (pid $$, cgroup $CG)"
fb=$(free_bytes)
if [ "$fb" -lt $((9 * 1073741824)) ]; then
  note "STOP: $(awk -v b="$fb" 'BEGIN{printf "%.2f", b/1073741824}') GiB free under the cap, under 9 GiB"
  exit 3
fi
note "free under the cap at start: $(awk -v b="$fb" 'BEGIN{printf "%.2f", b/1073741824}') GiB"

# every 30 s: time, the cgroup's usage, free by heavy's formula, the cache's size, /dev/shm in use,
# the disk's free space (GiB)
printf 'utc\tcgroup_usage_gib\tfree_gib\tl5_extract_gib\tdevshm_used_gib\tdisk_free_gib\n' >> "$MEM"
(
  while true; do
    use=$(cat "$CG/memory.usage_in_bytes" 2>/dev/null || echo 0)
    fb=$(free_bytes)
    ex=$(du -sk /dev/shm/l5-extract 2>/dev/null | cut -f1); ex=${ex:-0}
    shm=$(df -k /dev/shm | awk 'NR==2 {print $3}')
    disk=$(df -k / | awk 'NR==2 {print $4}')
    awk -v t="$(date -u +%FT%TZ)" -v u="$use" -v f="$fb" -v e="$ex" -v s="$shm" -v d="$disk" \
      'BEGIN{printf "%s\t%.2f\t%.2f\t%.2f\t%.2f\t%.2f\n", t, u/2^30, f/2^30, e/2^20, s/2^20, d/2^20}' >> "$MEM"
    sleep 30
  done
) &
LOGGER=$!
# on any exit, a failed render's too, the frames in memory go (they are only this script's)
trap 'kill $LOGGER 2>/dev/null; rm -rf /dev/shm/l5-extract' EXIT

export HYPERFRAMES_EXTRACT_CACHE_MAX_MB=8192   # above the 5.3 GiB of frames: the GC never evicts
HF="npx --yes hyperframes@0.8.97"
ok_check() {  # exit 0 and no "N error(s)" with N > 0
  [ "$1" = 0 ] && ! grep -Eq '(^|[^0-9])[1-9][0-9]* error' "$2"
}

if [ "${SKIP_FILM:-0}" != 1 ]; then
  cd "$P" || exit 1
  $HF check > "$LOG/04-check-film.txt" 2>&1; rc=$?
  ok_check $rc "$LOG/04-check-film.txt" || { note "STOP: check on the film: exit $rc or errors (logs/04-check-film.txt)"; exit 4; }
  note "check (film): 0 errors, $(grep -Eo '[0-9]+ warning\(s\)' "$LOG/04-check-film.txt" | head -1)"
  note "film render start"
  t0=$(date +%s)
  MIX=full $HF render --fps 60 --quality delivery --workers 2 --strict \
    --frames-cache-dir=/dev/shm/l5-extract --output renders/film-final-60.mp4 > "$LOG/04-render-film.txt" 2>&1; rc=$?
  note "film render exit $rc, $(( $(date +%s) - t0 )) s, $(du -h renders/film-final-60.mp4 2>/dev/null | cut -f1)"
  [ $rc = 0 ] || exit 5
fi

# The sibling's videos sit at another path, which is part of HyperFrames' cache key, so its render
# extracts them again: the film's frames go first, or both sets would be held at once (DECISIONS 262).
rm -rf /dev/shm/l5-extract
note "cache cleared before the music-only render"

cd "$M" || exit 1
$HF check > "$LOG/04-check-music-only.txt" 2>&1; rc=$?
ok_check $rc "$LOG/04-check-music-only.txt" || { note "STOP: check on the music-only sibling: exit $rc or errors"; exit 6; }
note "check (music-only): 0 errors, $(grep -Eo '[0-9]+ warning\(s\)' "$LOG/04-check-music-only.txt" | head -1)"
note "music-only render start"
t0=$(date +%s)
$HF render --fps 60 --quality delivery --workers 2 --strict \
  --frames-cache-dir=/dev/shm/l5-extract --output renders/film-final-60-music-only.mp4 > "$LOG/04-render-music-only.txt" 2>&1; rc=$?
note "music-only render exit $rc, $(( $(date +%s) - t0 )) s, $(du -h renders/film-final-60-music-only.mp4 2>/dev/null | cut -f1)"
[ $rc = 0 ] && mv renders/film-final-60-music-only.mp4 "$P/renders/film-final-60-music-only.mp4" && note "moved to l5film/renders/"

rm -rf /dev/shm/l5-extract
note "cache cleared; finished (exit $rc)"
exit $rc
