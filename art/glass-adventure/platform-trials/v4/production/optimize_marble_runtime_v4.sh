#!/usr/bin/env bash
# Encode the two standalone review candidates without changing geometry or normal data.
set -euo pipefail

repo=$(cd "$(dirname "$0")/../../../../.." && pwd)
cli="$repo/apps/beside-cue/node_modules/.bin/gltf-transform"
exports="$repo/art/glass-adventure/platform-trials/v4/exports"
python3 - "$repo/art/glass-adventure/platform-trials/v4/proofs/marble-direct-238k-visual-rejection.json" <<'PY'
import json
import sys

review = json.load(open(sys.argv[1]))
if review.get("acceptedForOptimization") is not True:
    raise SystemExit("V4 marble failed visual review; optimization is blocked. Preserve this rejected trial and produce a separately reviewed successor.")
PY
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

for profile in 4k 2k; do
  source_glb="$exports/cloudway-marble-ultra-v4-$profile-blender.glb"
  final_glb="$exports/cloudway-marble-ultra-v4-$profile.glb"

  # Color tolerates a high-quality perceptual encode. Tangent-space normals and
  # packed ORM remain lossless so comparison does not add another lossy normal
  # step to the direct dense-source provider normal. The rejected 90k
  # selected-to-active bake is not an input to these candidates.
  "$cli" webp "$source_glb" "$work/$profile-base.glb" \
    --slots baseColorTexture --quality 92 --near-lossless false --effort 80
  "$cli" webp "$work/$profile-base.glb" "$work/$profile-normal.glb" \
    --slots normalTexture --lossless true --effort 80
  "$cli" webp "$work/$profile-normal.glb" "$final_glb" \
    --slots metallicRoughnessTexture --lossless true --effort 80
  "$cli" validate "$final_glb"
done
