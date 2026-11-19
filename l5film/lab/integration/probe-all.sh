#!/bin/bash
# every scene's probe in the project given (its own copy of the runners), one runner after the other;
# prints each scene's count and every failing row, and writes the full output to <proj>/lab/probe-all.log
cd "$1"
{ node lab/s01-cold-open/probe.mjs s01-cold-open s02-title s03-promise s04-recall; echo "exit $?"
  node lab/s05-push/probe.mjs s05-push s06-diaphragm s07-support s08-breathe s09-onset s10-steady s11-sing s12-your-turn s13-recap s14-next s15-end; echo "exit $?"; } > lab/probe-all.log 2>&1
python3 - <<'PY'
import json
sids='s01-cold-open s02-title s03-promise s04-recall s05-push s06-diaphragm s07-support s08-breathe s09-onset s10-steady s11-sing s12-your-turn s13-recap s14-next s15-end'.split()
tot=ok=0
for s in sids:
    r=json.load(open(f'lab/{s}/probe.json')); r=r.get('rows',r) if isinstance(r,dict) else r
    n=len(r); p=sum(1 for x in r if x.get('pass')); tot+=n; ok+=p
    print(f'{s:15s} {p}/{n}')
    for x in r:
        if not x.get('pass'): print('   FAIL', x.get('t'), x.get('name'), x.get('got'), x.get('want'))
print('total', ok, '/', tot)
PY
grep -A6 "page errors" lab/probe-all.log | head -20
