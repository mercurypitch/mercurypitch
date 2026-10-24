#!/bin/bash
# verify-rebase-merge.sh REPO BASE HEAD MAINREF
# After GitHub rebase-merges a branch (tip HEAD, based on BASE), check that MAINREF ends in
# the same commits: count, full messages, authors and author dates, patch-ids, and the tree
# when main had not moved past BASE.
set -u
R=$1; BASE=$2; HEAD=$3; MAIN=$4
n=$(git -C "$R" rev-list --count "$BASE..$HEAD")
NEWBASE=$(git -C "$R" rev-parse "$MAIN~$n")
echo "branch commits: $n"
echo "main~$n: $NEWBASE"
echo "branch base: $(git -C "$R" rev-parse "$BASE")"
log() { git -C "$R" log --reverse "$@"; }
diff <(log --format='%s' "$BASE..$HEAD") <(log --format='%s' "$NEWBASE..$MAIN") > /dev/null && echo "subjects: same" || echo "subjects: DIFFERENT"
diff <(log --format='%B%x00' "$BASE..$HEAD") <(log --format='%B%x00' "$NEWBASE..$MAIN") > /dev/null && echo "messages: same" || echo "messages: DIFFERENT"
diff <(log --format='%an <%ae> %aI' "$BASE..$HEAD") <(log --format='%an <%ae> %aI' "$NEWBASE..$MAIN") > /dev/null && echo "authors and dates: same" || echo "authors and dates: DIFFERENT"
pid() { for c in $(git -C "$R" rev-list --reverse "$1..$2"); do git -C "$R" show "$c" | git -C "$R" patch-id --stable | cut -d' ' -f1; echo "-- $c"; done | grep -v '^-- ' ; }
diff <(pid "$BASE" "$HEAD") <(pid "$NEWBASE" "$MAIN") > /dev/null && echo "patch-ids: same ($(pid "$BASE" "$HEAD" | wc -l) of $n)" || echo "patch-ids: DIFFERENT"
if [ "$NEWBASE" = "$(git -C "$R" rev-parse "$BASE")" ]; then
  [ "$(git -C "$R" rev-parse "$HEAD^{tree}")" = "$(git -C "$R" rev-parse "$MAIN^{tree}")" ] && echo "tree: same" || echo "tree: DIFFERENT"
else
  echo "tree: main had moved past the base; compare against a local replay"
fi
echo "committers on main: $(log --format='%cn' "$NEWBASE..$MAIN" | sort | uniq -c | tr '\n' ' ')"
