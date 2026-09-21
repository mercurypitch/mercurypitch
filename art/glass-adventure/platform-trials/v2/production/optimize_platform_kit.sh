#!/usr/bin/env bash
# Rebuild the lossless geometry passes and bounded WebP runtime compression.
set -euo pipefail

repo=$(cd "$(dirname "$0")/../../../../.." && pwd)
cli="$repo/apps/beside-cue/node_modules/.bin/gltf-transform"
source_glb="$repo/art/glass-adventure/platform-trials/v2/exports/cloudway-platform-kit-v1-blender.glb"
final_glb="$repo/art/glass-adventure/platform-trials/v2/exports/cloudway-platform-kit-v1.glb"
public_dir="$repo/apps/beside-cue/public/games/cloudway-v1"
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

"$cli" dedup "$source_glb" "$work/1-dedup.glb"
"$cli" prune "$work/1-dedup.glb" "$work/2-pruned.glb"
"$cli" weld "$work/2-pruned.glb" "$work/3-welded.glb"
"$cli" tangents "$work/3-welded.glb" "$work/4-tangents.glb" --overwrite
python3 "$repo/art/glass-adventure/platform-trials/v2/production/repair_invalid_tangents.py" \
  "$work/4-tangents.glb" "$work/5-valid-tangents.glb"
"$cli" webp "$work/5-valid-tangents.glb" "$final_glb" \
  --quality 88 --near-lossless true --effort 80
"$cli" validate "$final_glb"

mkdir -p "$public_dir"
cp "$final_glb" "$public_dir/cloudway-platform-kit-v1.glb"
