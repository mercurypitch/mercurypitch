#!/usr/bin/env bash
# gates.sh <pr> <unit test paths...>: quick gates for a held PR rebased onto main, in kit-ladder.
S=/tmp/claude-0/-home-user-mercurypitch/12ae313e-03fe-590a-b304-88d38ce9e159/scratchpad; R=$S/rebase-1026; H=$S/bin/heavy
P=$1; shift
cd /home/user/mercurypitch/.claude/worktrees/${WT:-kit-ladder} || exit 1
echo "== $P head $(git rev-parse --short=9 HEAD) on $(git merge-base --short HEAD origin/main 2>/dev/null || git merge-base HEAD origin/main | cut -c1-9) $(date +%T)"
s=$(date +%s); NODE_OPTIONS=--max-old-space-size=7168 $H timeout 2400 pnpm check > $R/$P-check.log 2>&1; echo "check exit $? ($(( $(date +%s)-s )) s); tree after: $(git status --porcelain | grep -v "^?? node_modules$" | wc -l) changed; $(grep -E 'problems' $R/$P-check.log | tail -1)"
if [ $# -gt 0 ]; then s=$(date +%s); NODE_OPTIONS=--max-old-space-size=6144 $H timeout 2400 pnpm exec vitest run "$@" > $R/$P-unit.log 2>&1; echo "unit exit $? ($(( $(date +%s)-s )) s): $(grep -E 'Test Files|Tests ' $R/$P-unit.log | tr -s ' ' | tr '\n' ' ')"; fi
s=$(date +%s); timeout 900 pnpm test:scripts > $R/$P-scripts.log 2>&1; echo "test:scripts exit $? ($(( $(date +%s)-s )) s): $(grep -E '^# (pass|fail)' $R/$P-scripts.log | tr '\n' ' ')"
s=$(date +%s); timeout 600 pnpm pr:validate > $R/$P-validate.log 2>&1; echo "pr:validate exit $? ($(( $(date +%s)-s )) s)"
s=$(date +%s); NODE_OPTIONS=--max-old-space-size=6144 $H timeout 1800 pnpm metrics:check > $R/$P-metrics.log 2>&1; echo "metrics:check exit $? ($(( $(date +%s)-s )) s): $(tail -1 $R/$P-metrics.log)"
echo "== done $(date +%T)"
