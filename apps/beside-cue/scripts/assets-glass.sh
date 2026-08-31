#!/bin/bash
# The T8 optimize pass, explicit stage by stage -- never a bare
# `optimize`, which also touches textures and needs sharp (whose native
# build fails on this setup; the CLI is installed --ignore-scripts).
set -euo pipefail
# This machine's locale uses a comma decimal separator, which printf %f
# then rejects outright -- and under `set -e` that aborts the run before
# the second asset is ever built.
export LC_ALL=C
cd "$(dirname "$0")/.."

optimize () {
  local src=$1 out=$2 tmp
  tmp=$(mktemp -d)
  pnpm exec gltf-transform dedup "$src"     "$tmp/1.glb"
  pnpm exec gltf-transform prune "$tmp/1.glb" "$tmp/2.glb"
  pnpm exec gltf-transform weld  "$tmp/2.glb" "$tmp/3.glb"
  pnpm exec gltf-transform meshopt "$tmp/3.glb" "$out"
  rm -rf "$tmp"
  printf '%-28s %6.1f KB raw  %6.1f KB gz\n' "$(basename "$out")" \
    "$(stat -c%s "$out" | awk '{print $1/1024}')" \
    "$(gzip -c "$out" | wc -c | awk '{print $1/1024}')"
}

optimize art/glass/glass-preview.glb  art/glass/glass.opt.glb
optimize art/glass/shards-preview.glb art/glass/shards.opt.glb
