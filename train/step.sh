#!/bin/bash
# step.sh BRANCH TRAINBASE TRAINTIP OLDLOCAL LEASE
# After the PR before this one merges: restack TRAINBASE..TRAINTIP onto origin/main
# (main's tree must equal TRAINBASE's), check the copy against the train, move the
# local branch from OLDLOCAL, push with a lease on LEASE, and read the remote back.
set -euo pipefail
R=/home/user/mercurypitch
S=/tmp/claude-0/-home-user-mercurypitch/12ae313e-03fe-590a-b304-88d38ce9e159/scratchpad
BR=$1; TB=$2; TT=$3; OLD=$4; LEASE=$5
git -C $R fetch -q origin main "refs/heads/$BR:refs/remotes/origin/$BR"
M=$(git -C $R rev-parse origin/main)
[ "$(git -C $R rev-parse origin/main^{tree})" = "$(git -C $R rev-parse $TB^{tree})" ] || { echo "main $M tree differs from $TB's: STOP"; exit 1; }
[ "$(git -C $R rev-parse refs/remotes/origin/$BR)" = "$LEASE" ] || { echo "origin/$BR is not $LEASE: STOP"; exit 1; }
[ "$(git -C $R rev-parse refs/heads/$BR)" = "$(git -C $R rev-parse $OLD)" ] || { echo "local $BR is not $OLD: STOP"; exit 1; }
NEW=$(bash $S/bin/restack.sh $R origin/main $TB $TT)
log() { git -C $R log --reverse "$@"; }
pid() { for c in $(git -C $R rev-list --reverse "$1..$2"); do git -C $R show "$c" | git -C $R patch-id --stable | cut -d' ' -f1; done; }
n1=$(git -C $R rev-list --count $TB..$TT); n2=$(git -C $R rev-list --count $M..$NEW)
echo "main $(git -C $R rev-parse --short $M); new tip $NEW; commits $n1 -> $n2"
[ "$n1" = "$n2" ] || { echo "count differs: STOP"; exit 1; }
cmp <(log --format='%B%x00' $TB..$TT) <(log --format='%B%x00' $M..$NEW) >/dev/null && echo "messages: same" || { echo "messages DIFFER: STOP"; exit 1; }
cmp <(log --format='%an <%ae> %aI' $TB..$TT) <(log --format='%an <%ae> %aI' $M..$NEW) >/dev/null && echo "authors and dates: same" || { echo "authors DIFFER: STOP"; exit 1; }
cmp <(pid $TB $TT) <(pid $M $NEW) >/dev/null && echo "patch-ids: same ($n1)" || { echo "patch-ids DIFFER: STOP"; exit 1; }
[ "$(git -C $R rev-parse $NEW^{tree})" = "$(git -C $R rev-parse $TT^{tree})" ] && echo "tree: same as $TT" || { echo "tree DIFFERS: STOP"; exit 1; }
git -C $R update-ref refs/heads/$BR $NEW $(git -C $R rev-parse $OLD)
set -o pipefail
git -C $R push -u --force-with-lease=$BR:$LEASE origin $BR 2>&1 | tail -3
git -C $R ls-remote origin refs/heads/$BR
