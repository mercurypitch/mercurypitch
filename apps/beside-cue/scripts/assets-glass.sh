#!/bin/bash
# The T8 optimize pass for the glass, explicit stage by stage — never a
# bare `optimize` (it would also touch textures and needs sharp).
set -euo pipefail
cd "$(dirname "$0")/.."
SRC=art/glass/glass-preview.glb
OUT=art/glass/glass.opt.glb
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
pnpm exec gltf-transform dedup "$SRC" "$TMP/1.glb"
pnpm exec gltf-transform prune "$TMP/1.glb" "$TMP/2.glb"
pnpm exec gltf-transform weld "$TMP/2.glb" "$TMP/3.glb"
pnpm exec gltf-transform meshopt "$TMP/3.glb" "$OUT"
ls -la "$OUT"
