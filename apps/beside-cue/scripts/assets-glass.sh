#!/bin/bash
# The T8 optimize pass, explicit stage by stage -- never a bare
# `optimize`, which also touches textures and needs sharp (whose native
# build fails on this setup; the CLI is installed --ignore-scripts).
#
# `quantize`, not `meshopt`. Both shrink geometry; only one of them needs
# a WASM decoder to read the result back.
#
# Measured on these assets (gzipped): shards 38.3 KB plain -> 27.1 KB
# quantized -> 28.2 KB meshopt; Merc 181.9 -> 126.7 -> 43.9. So meshopt
# does compress harder, and on Merc it is not close. But it costs a
# 28.6 KB decoder AND `wasm-unsafe-eval` in the CSP, which this app does
# not grant -- the decoder failing against that policy is how the
# trade-off got measured at all. KHR_mesh_quantization is read natively
# by three's GLTFLoader with no decoder and no policy change.
#
# Quantization touches mesh attributes, not node transforms, so the
# shard centroids the sim reads survive it untouched.
#
# Revisit meshopt if the scene ever carries enough geometry that the
# decoder amortises -- Merc alone nearly gets there.
set -euo pipefail
# This machine's locale uses a comma decimal separator, which printf %f
# then rejects outright -- and under `set -e` that aborts the run before
# the second asset is ever built.
export LC_ALL=C
cd "$(dirname "$0")/.."

# Three lossless passes and no lossy one, deliberately.
#
# dedup/prune/weld only remove data that is genuinely redundant -- shared
# accessors, unreferenced nodes, duplicate vertices -- so the model that
# comes out is the model that went in. `quantize` used to run here too and
# is about 30% smaller, but it is the only step that changes the numbers,
# and the assets are nowhere near a size worth trading quality for: a
# native app ships its models inside the bundle, and a few hundred KB of
# geometry is not what makes an install big.
#
# When compression does become the question -- when there are worlds
# rather than one glass -- the shape of the answer is already known, and
# it is textures, not geometry: KTX2/Basis stays compressed in VRAM and
# cuts texture memory by roughly 10x, which is the number that actually
# hurts on a phone. Geometry (Draco or meshopt) is the smaller half, and
# meshopt would additionally need `wasm-unsafe-eval` in the CSP.
optimize () {
  local src=$1 out=$2 tmp
  tmp=$(mktemp -d)
  pnpm exec gltf-transform dedup "$src"     "$tmp/1.glb"
  pnpm exec gltf-transform prune "$tmp/1.glb" "$tmp/2.glb"
  pnpm exec gltf-transform weld  "$tmp/2.glb" "$out"
  rm -rf "$tmp"
  printf '%-28s %6.1f KB raw  %6.1f KB gz\n' "$(basename "$out")" \
    "$(stat -c%s "$out" | awk '{print $1/1024}')" \
    "$(gzip -c "$out" | wc -c | awk '{print $1/1024}')"
}

optimize art/glass/glass-preview.glb  art/glass/glass.opt.glb
optimize art/glass/shards-preview.glb art/glass/shards.opt.glb
optimize art/merc/merc-preview.glb    art/merc/merc.opt.glb
optimize art/pane/pane-shards-preview.glb art/pane/pane-shards.opt.glb

# The runtime loads these from public/. Copying is part of the build
# rather than something to remember: an optimized asset nobody ships is
# just a file on someone's laptop.
mkdir -p public/games/glass3d
cp art/glass/glass.opt.glb  public/games/glass3d/glass.glb
cp art/glass/shards.opt.glb public/games/glass3d/shards.glb
cp art/merc/merc.opt.glb    public/games/glass3d/merc.glb
cp art/pane/pane-shards.opt.glb public/games/glass3d/pane-shards.glb
echo "copied to public/games/glass3d/"
