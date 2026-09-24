#!/usr/bin/env bash
# Package the source-preserved marble baseline for the existing plain Three GLTFLoader.
set -euo pipefail

export LC_ALL=C
repo=$(cd "$(dirname "$0")/../../../../.." && pwd)
cli="$repo/apps/beside-cue/node_modules/.bin/gltf-transform"
source="$repo/art/glass-adventure/platform-trials/v7/exports/cloudway-marble-v7-dense-baseline-2k.glb"
delivery_dir="$repo/art/glass-adventure/platform-trials/v7/exports/delivery"
output="$delivery_dir/cloudway-marble-v7-dense-baseline-delivery-2k.glb"
validator="$delivery_dir/cloudway-marble-v7-dense-baseline-delivery-2k-validator.txt"
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
mkdir -p "$delivery_dir"

# The shipped loader supports EXT_texture_webp and KHR_mesh_quantization.
# KTX2, Draco, and meshopt need decoders that the game does not configure, so
# this review delivery does not use decoder-bound geometry compression.
timeout 900 "$cli" webp "$source" "$work/1-webp.glb" \
  --quality 94 --near-lossless true --effort 90
timeout 900 "$cli" dedup "$work/1-webp.glb" "$work/2-dedup.glb"
timeout 900 "$cli" prune "$work/2-dedup.glb" "$work/3-pruned.glb" \
  --keep-attributes true --keep-indices true --keep-leaves true
timeout 1200 "$cli" quantize "$work/3-pruned.glb" "$output" \
  --quantization-volume mesh \
  --quantize-position 16 --quantize-normal 16 --quantize-texcoord 16
timeout 600 "$cli" validate "$output" > "$validator" 2>&1
printf '%s %s\n' "$output" "$(stat -c%s "$output")"
