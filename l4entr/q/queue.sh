#!/bin/bash
# Lesson 4's entrance renders (DECISIONS 81), one after another, niced. Same name as l4merc/queue.sh
# so yield.py keeps it under the scene builders. An id renders the shot's pass; id:tall renders its
# tall intro (merc-pass.mjs --tall --until=44). Each skips while its WebM is newer than its shot.
#   setsid nohup bash queue.sh <id|id:tall> ... > logs/<name>.log 2>&1 < /dev/null &
cd /home/user/mercurypitch/output/motion/lesson-04 || exit 1
export PLAYWRIGHT_MODULE=/opt/node-tools/node_modules/playwright/index.mjs
LOG=/tmp/claude-0/-home-user-mercurypitch/12ae313e-03fe-590a-b304-88d38ce9e159/scratchpad/l4entr/q/logs
mkdir -p "$LOG"
for item in "$@"; do
  id=${item%%:*}
  if [ "$item" != "$id" ]; then out="assets/merc/$id-tall-merc.webm"; extra="--tall --until=44"; name="$id-tall"
  else out="assets/merc/$id-merc.webm"; extra=""; name="$id"; fi
  if [ -s "$out" ] && [ "$out" -nt "merc/shots/$id.json" ]; then echo "$name: already rendered"; continue; fi
  echo "$name: start $(date -u +%H:%M:%S)"
  nice -n 10 node tools/merc-pass.mjs "merc/shots/$id.json" $extra > "$LOG/$name.log" 2>&1
  echo "$name: exit $? at $(date -u +%H:%M:%S); $(tr '\r' '\n' < "$LOG/$name.log" | grep -E 'ms/frame|crescent' | tr '\n' ' ' | cut -c1-400)"
done
echo "queue done $(date -u +%H:%M:%S)"
