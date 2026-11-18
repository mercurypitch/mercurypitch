#!/bin/bash
# restack.sh REPO ONTO OLDBASE TIP: re-parent the commits OLDBASE..TIP onto ONTO, keeping each
# commit's tree, message, author and author date, when ONTO's tree equals OLDBASE's tree (so the
# result is what a clean rebase gives). Prints the new tip; changes no ref and no working tree.
set -euo pipefail
R=$1; ONTO=$2; OLDBASE=$3; TIP=$4
[ "$(git -C "$R" rev-parse "$ONTO^{tree}")" = "$(git -C "$R" rev-parse "$OLDBASE^{tree}")" ] || { echo "ONTO's tree differs from OLDBASE's: rebase for real" >&2; exit 1; }
p=$(git -C "$R" rev-parse "$ONTO")
for c in $(git -C "$R" rev-list --reverse "$OLDBASE..$TIP"); do
  [ "$(git -C "$R" rev-list --parents -n 1 "$c" | wc -w)" = 2 ] || { echo "merge commit $c" >&2; exit 1; }
  msg=$(mktemp)
  git -C "$R" cat-file commit "$c" | sed '1,/^$/d' > "$msg"
  p=$(GIT_AUTHOR_NAME="$(git -C "$R" log -1 --format=%an "$c")" \
      GIT_AUTHOR_EMAIL="$(git -C "$R" log -1 --format=%ae "$c")" \
      GIT_AUTHOR_DATE="$(git -C "$R" log -1 --format=%aD "$c")" \
      git -C "$R" commit-tree "$c^{tree}" -p "$p" -F "$msg")
  rm -f "$msg"
done
echo "$p"
