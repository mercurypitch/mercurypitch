#!/bin/bash
# Keep assets/merc/whole.js current while the passes land, so the builders' gates read each new pass's
# first whole frame: every 60 s, when tools/merc-whole.py --check calls the table stale, regenerate it
# and run verify.py on the rendered passes. Exits once no queue.sh worker is left and the table is current.
#   setsid nohup bash whole-watch.sh > logs/whole-watch.log 2>&1 < /dev/null &
cd /home/user/mercurypitch/output/motion/lesson-04 || exit 1
V=/tmp/claude-0/-home-user-mercurypitch/12ae313e-03fe-590a-b304-88d38ce9e159/scratchpad/l4merc/verify.py
while true; do
  if ! python3 tools/merc-whole.py --check > /dev/null 2>&1; then
    echo "== $(date -u +%H:%M:%S)"
    python3 tools/merc-whole.py
    python3 "$V" | grep -v "not rendered"
  fi
  if ! pgrep -f "^bash queue.sh" > /dev/null && python3 tools/merc-whole.py --check > /dev/null 2>&1; then
    echo "no worker left, table current $(date -u +%H:%M:%S)"
    exit 0
  fi
  sleep 60
done
