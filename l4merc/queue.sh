#!/bin/bash
# Render Lesson 4's Merc passes one after another, niced, skipping every pass whose WebM is
# newer than its shot file (PRODUCTION-PIPELINE § 4 trap 11). Start it detached:
#   setsid nohup bash queue.sh [id ...] > logs/worker-N.log 2>&1 < /dev/null &
# and yield.py beside the workers (Chrome raises its own threads to nice -8):
#   setsid nohup python3 -I yield.py > logs/yield.log 2>&1 < /dev/null &
#   queue.sh [id ...]   the passes to render, in order (default: all, the first builders' first)
# Two workers run side by side: one for m12's long pair, one for the rest.
cd /home/user/mercurypitch/output/motion/lesson-04 || exit 1
export PLAYWRIGHT_MODULE=/opt/node-tools/node_modules/playwright/index.mjs
LOG=/tmp/claude-0/-home-user-mercurypitch/12ae313e-03fe-590a-b304-88d38ce9e159/scratchpad/l4merc/logs
ids=("$@")
[ ${#ids[@]} -eq 0 ] && ids=(m01-blue m01-orange m04-orange m06b-orange m12-blue m12-orange m09-orange m10-blue m11-blue m11-orange m07-orange m08-orange m06a-orange)
for id in "${ids[@]}"; do
  if [ -s "assets/merc/$id-merc.webm" ] && [ "assets/merc/$id-merc.webm" -nt "merc/shots/$id.json" ]; then echo "$id: already rendered"; continue; fi
  echo "$id: start $(date -u +%H:%M:%S)"
  nice -n 10 node tools/merc-pass.mjs "merc/shots/$id.json" > "$LOG/$id.log" 2>&1
  echo "$id: exit $? at $(date -u +%H:%M:%S); $(tr '\r' '\n' < "$LOG/$id.log" | grep -E 'ms/frame|crescent' | tr '\n' ' ')"
done
echo "queue done $(date -u +%H:%M:%S)"
