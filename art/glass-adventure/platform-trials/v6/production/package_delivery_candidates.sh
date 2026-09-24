#!/usr/bin/env bash
# Package source-preserving 2K delivery candidates for the plain Three.js GLTFLoader.
set -euo pipefail

export LC_ALL=C
repo=$(cd "$(dirname "$0")/../../../../.." && pwd)
cli="$repo/apps/beside-cue/node_modules/.bin/gltf-transform"
master_dir="$repo/art/glass-adventure/platform-trials/v6/exports"
delivery_dir="$master_dir/delivery"
mkdir -p "$delivery_dir"

package_asset () {
  local asset=$1 source output work
  source="$master_dir/cloudway-$asset-v6-derivative.glb"
  output="$delivery_dir/cloudway-$asset-v6-delivery-2k.glb"
  work=$(mktemp -d)
  trap 'rm -rf "$work"' RETURN

  # The shipped loader already supports EXT_texture_webp and
  # KHR_mesh_quantization. It does not configure KTX2, Draco, or meshopt
  # decoders, so this pipeline deliberately uses no decoder-bound extension.
  timeout 900 "$cli" resize "$source" "$work/1-resized.glb" \
    --width 2048 --height 2048 --filter lanczos3
  timeout 1800 "$cli" webp "$work/1-resized.glb" "$work/2-webp.glb" \
    --quality 92 --near-lossless true --effort 90
  timeout 900 "$cli" dedup "$work/2-webp.glb" "$work/3-dedup.glb"
  timeout 900 "$cli" prune "$work/3-dedup.glb" "$work/4-pruned.glb" \
    --keep-attributes true --keep-indices true --keep-leaves true
  timeout 900 "$cli" quantize "$work/4-pruned.glb" "$output" \
    --quantization-volume mesh \
    --quantize-position 16 --quantize-normal 16 --quantize-texcoord 16
  timeout 600 "$cli" validate "$output" \
    > "$delivery_dir/cloudway-$asset-v6-delivery-2k-validator.txt" 2>&1
  printf '%s %s\n' "$asset" "$(stat -c%s "$output")"
}

package_asset frost
package_asset glide
