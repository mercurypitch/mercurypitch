#!/usr/bin/env bash
# Build a delivery derivative with unchanged geometry and smaller texture payloads.
set -euo pipefail

repo=$(cd "$(dirname "$0")/../../../../.." && pwd)
cli="$repo/apps/beside-cue/node_modules/.bin/gltf-transform"
source_glb="$repo/art/glass-adventure/platform-trials/v3/exports/cloudway-platform-kit-v3-blender.glb"
runtime_glb="$repo/art/glass-adventure/platform-trials/v3/exports/cloudway-platform-kit-v3-runtime.glb"
geometry="$repo/art/glass-adventure/platform-trials/v3/production/runtime_geometry.cjs"
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

# Three.js derives a tangent basis for normal maps when TANGENT is absent. The
# Cloudway renderer does not read this attribute, so remove its 16 bytes per
# textured vertex without changing positions, normals, UVs, or silhouettes.
node "$geometry" strip-tangents "$source_glb" "$work/0-no-tangents.glb"
"$cli" dedup "$work/0-no-tangents.glb" "$work/1-dedup.glb"
"$cli" prune "$work/1-dedup.glb" "$work/2-pruned.glb"
"$cli" weld "$work/2-pruned.glb" "$work/3-welded.glb"

# Keep color artwork at 2K. Normal and packed metallic/roughness maps tolerate
# 1K at this camera distance and account for most of the avoidable payload.
"$cli" resize "$work/3-welded.glb" "$work/4-normal-1k.glb" \
  --pattern '*-atlas-03-2k' --width 1024 --height 1024 --filter lanczos3
"$cli" resize "$work/4-normal-1k.glb" "$work/5-orm-1k.glb" \
  --pattern '*-atlas-02-2k' --width 1024 --height 1024 --filter lanczos3

# Encode each role from the packed PNG source once, with quality weighted
# toward visible color and normal detail. No Draco or Meshopt decoder is used.
"$cli" webp "$work/5-orm-1k.glb" "$work/6-base-webp.glb" \
  --slots baseColorTexture --quality 86 --near-lossless false --effort 80
"$cli" webp "$work/6-base-webp.glb" "$work/7-normal-webp.glb" \
  --slots normalTexture --quality 88 --near-lossless false --effort 80
"$cli" webp "$work/7-normal-webp.glb" "$work/8-orm-webp.glb" \
  --slots metallicRoughnessTexture --quality 82 --near-lossless false --effort 80
node "$geometry" finalize-texture-names "$work/8-orm-webp.glb" "$runtime_glb"
"$cli" validate "$runtime_glb"
