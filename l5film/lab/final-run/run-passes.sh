#!/bin/bash
# Step 3 of the final run, resumable: the queue, then the joins, roots, tags check and sheet.
# Run from anywhere, detached:
#   setsid nohup bash lab/final-run/run-passes.sh > lab/final-run/logs/03-run-passes.out 2>&1 &
S=/tmp/claude-0/-home-user-mercurypitch/12ae313e-03fe-590a-b304-88d38ce9e159/scratchpad
cd "$S/l5film" || exit 1
H="$S/bin/heavy"
LOG=lab/final-run/logs
ST=lab/final-run/run-passes.state
note() { echo "$(date -u +%FT%TZ) $*" >> "$ST"; }
note "start (pid $$)"
python3 tools/merc-queue.py --order=final >> merc/queue.out 2>&1
if python3 tools/merc-queue.py --order=final --list | grep -q '^todo'; then
  note "queue stopped with jobs left"; exit 1
fi
note "queue done"
"$H" python3 tools/merc-roots.py > $LOG/03-roots.txt 2>&1; note "roots exit $?"
"$H" python3 tools/merc-joins.py > $LOG/03-joins.txt 2>&1; note "joins exit $?"
: > $LOG/03-tags-check.txt
for f in compositions/s*.html; do
  s=$(basename "$f" .html)
  echo "== $s" >> $LOG/03-tags-check.txt
  python3 tools/merc-tags.py "$s" --check >> $LOG/03-tags-check.txt 2>&1
  echo "exit $?" >> $LOG/03-tags-check.txt
done
note "tags check done ($(grep -c '^exit 0' $LOG/03-tags-check.txt) of 15 exit 0)"
"$H" python3 tools/merc-sheet.py > $LOG/03-sheet.txt 2>&1; note "sheet exit $?"
note "finished"
