#!/bin/bash
# every scene's check on the live project after the integration kit fixes, then the root's (0 errors each)
# run.sh <project> [<out dir> = lab/integration/checks]
cd "$1"
O=${2:-lab/integration/checks}
mkdir -p "$O"
declare -A A=(
  [s01-cold-open]=31.8,32.05,32.2,33.0,36.9 [s02-title]=1.5,2.2 [s03-promise]=2.3,5,8.4,9.7 [s04-recall]=3.3,8.3,10.9,12.0,13.6
  [s05-push]=1.2,10.92,21.0,23.25,33.62,35.55 [s06-diaphragm]=1.2,26.16,29.38,34.20,35.37,45.00,66.65 [s07-support]=0,1.92,7.80,12.08,19.05,34.00
  [s08-breathe]=1.85,2.15,3.10,8.11,18.83,20.35 [s09-onset]=1.2,3.30,9.50,21.00,34.60,46.72,48.97,53.16 [s10-steady]=1.2,2.42,33.95,42.81,52.02,52.22,59.09,60.53
  [s11-sing]=1.27,6.30,6.80,13.17,31.73,37.12 [s12-your-turn]=21.0,36.40,58.98,59.20,64.72,75.16 [s13-recap]=28.3,39.5,42.4,48.6,50.6,60.5
  [s14-next]=1.4,1.9,6.3,7.7,10.3,14.2 [s15-end]=1.2,3.0,6.1
)
for sid in s01-cold-open s02-title s03-promise s04-recall s05-push s06-diaphragm s07-support s08-breathe s09-onset s10-steady s11-sing s12-your-turn s13-recap s14-next s15-end; do
  node tools/lab.mjs $sid > /dev/null 2>&1
  npx --yes hyperframes@0.8.97 check lab/$sid/proj --at=${A[$sid]} --json --max-issues=200 > $O/$sid.json 2> $O/$sid.err
  echo "$sid exit $?"
done
npx --yes hyperframes@0.8.97 check --json --max-issues=200 > $O/root.json 2> $O/root.err
echo "root exit $?"
