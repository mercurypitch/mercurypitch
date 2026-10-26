#!/bin/bash
# Lead gates on the rebased onboarding polish head (P's six commits + map on main b8479306a).
set -u
W=/home/user/mercurypitch/.claude/worktrees/e2e-wav
S=/tmp/claude-0/-home-user-mercurypitch/12ae313e-03fe-590a-b304-88d38ce9e159/scratchpad
O=$S/polish/P-lead
cd "$W" || exit 9
run() { local name=$1; shift; local t0=$(date +%s); ( "$@" ) > "$O/$name.log" 2>&1; local rc=$?; echo "$name exit $rc ($(( $(date +%s) - t0 ))s)"; }
echo "head $(git rev-parse --short HEAD) on $(git merge-base HEAD origin/main | cut -c1-9); $(date -u +%H:%M)"
run check env NODE_OPTIONS=--max-old-space-size=7168 $S/bin/heavy timeout 1500 pnpm check
tail -3 "$O/check.log"; git status --short | head -5
FILES=$(git diff --name-only cddefd571..HEAD | grep -E '\.test\.(ts|tsx)$' | tr '\n' ' ')
echo "unit files: $(echo $FILES | wc -w) + src/tests"
run unit env NODE_OPTIONS=--max-old-space-size=6144 $S/bin/heavy timeout 1800 pnpm exec vitest run $FILES src/tests
grep -E "Test Files|Tests " "$O/unit.log" | tail -2
run scripts pnpm test:scripts
grep -E "^# (pass|fail)" "$O/scripts.log" | tail -2
run validate pnpm pr:validate
run metrics pnpm metrics:check
tail -2 "$O/metrics.log"
run index pnpm docs:index:check
run cites node scripts/plan-cites.mjs check
grep -c -E "^\s*(finding|-|\*)" "$O/cites.log" >/dev/null; tail -2 "$O/cites.log"
echo "disk before build: $(df -m / | awk 'NR==2{print $4}') MB"
run build env NODE_OPTIONS=--max-old-space-size=7168 $S/bin/heavy timeout 1800 pnpm build:e2e
grep -n -E "Git LFS pointer" "$O/build.log" | head -2
run fp node scripts/assert-first-paint-budgets.mjs dist
grep -E "learn/0[1-8]|index.html|FAIL|over" "$O/fp.log" | head -20
run drafts node scripts/assert-draft-lessons.mjs dist --shown
tail -1 "$O/drafts.log"
run e2e env PLAYWRIGHT_BROWSERS_PATH=$S/pw-browsers $S/bin/heavy timeout 2400 pnpm exec playwright test src/e2e/onboarding.spec.ts src/e2e/onboarding-mic.spec.ts src/e2e/onboarding-plan-keyboard.spec.ts src/e2e/onboarding-viewports.spec.ts src/e2e/learn-lesson-01.spec.ts src/e2e/learn-ways.spec.ts src/e2e/learn-lesson-tour.spec.ts --retries=0 --reporter=line
tail -4 "$O/e2e.log"
echo "done $(date -u +%H:%M)"
