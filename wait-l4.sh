#!/bin/bash
# Waits on a render-l4.sh run and exits on the first of: the status's last line is "done", a new
# out-of-memory kill in the shell's cgroup, a stall/fallback/error line in the log after OFF bytes,
# or QUIET seconds without the log growing. Usage: bash wait-l4.sh <name> <log byte offset> [quiet s]
NAME=${1:?name}; OFF=${2:?offset}; QUIET=${3:-300}
R=/home/user/mercurypitch/output/motion/lesson-04/renders
MC=/sys/fs/cgroup/memory$(sed -n "s/^[0-9]*:memory://p" /proc/self/cgroup)/memory.oom_control   # changes on restart
oom0=$(awk '/oom_kill /{print $2}' $MC)
last=$(stat -c %s $R/$NAME.log); t=$(date +%s)
while :; do
  sleep 20
  if [ "$(tail -1 $R/$NAME.status)" != "${tail1:-}" ] && tail -1 $R/$NAME.status | grep -q ' done$' && [ $(stat -c %s $R/$NAME.log) -gt $OFF ]; then
    echo "DONE"; break; fi
  o=$(awk '/oom_kill /{print $2}' $MC); [ "$o" != "$oom0" ] && { echo "OOM KILL ($oom0 -> $o)"; break; }
  if tail -c +$((OFF+1)) $R/$NAME.log | tr '\r' '\n' | grep -q 'capture stalled\|falling back\|retrying\|target lost\|"phase":"capture_streaming"\|"status":"error"'; then
    echo "LOG MATCH"; tail -c +$((OFF+1)) $R/$NAME.log | tr '\r' '\n' | grep 'capture stalled\|falling back\|retrying\|target lost\|"phase":"capture_streaming"\|"status":"error"' | cut -c1-300 | head -5; break; fi
  s=$(stat -c %s $R/$NAME.log); now=$(date +%s)
  if [ "$s" != "$last" ]; then last=$s; t=$now; elif [ $((now-t)) -ge $QUIET ]; then echo "QUIET ${QUIET}s"; break; fi
done
echo "STATUS:"; cat $R/$NAME.status
