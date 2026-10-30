#!/usr/bin/env bash
# The LFS object set behind the lfs-pull action, read from the checkout.
#
#   lfs-set.sh key     prints the Actions cache key for the set
#   lfs-set.sh prune   deletes every object in .git/lfs/objects the set does not name
#
# LFS_INCLUDE holds the set's paths as a git lfs --include list. Written for
# the bash 3.2 that macOS runners may bring.
set -euo pipefail

mode=${1:-}
if [[ "$mode" != key && "$mode" != prune ]]; then
  echo "usage: lfs-set.sh key|prune" >&2
  exit 2
fi
: "${LFS_INCLUDE:?lfs-set.sh needs LFS_INCLUDE}"

oids=$(git lfs ls-files --long --include="$LFS_INCLUDE" --exclude="" | cut -d' ' -f1 | sort -u)
if [[ -z "$oids" ]]; then
  echo "lfs-set.sh: no LFS files match $LFS_INCLUDE" >&2
  exit 1
fi

if [[ "$mode" == key ]]; then
  # Sorted object ids: the key follows each object's content and the set's
  # membership, not a path, the order git lists them in, or a change to a file
  # LFS does not hold. The prefix is the action's restore-keys.
  echo "lfs-pull-v1-$(git hash-object --stdin <<<"$oids")"
else
  find .git/lfs/objects -type f | while IFS= read -r object; do
    grep -qxF "${object##*/}" <<<"$oids" || rm -f "$object"
  done
fi
