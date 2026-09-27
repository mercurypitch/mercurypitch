# Merc character v2

Merc v2 refines the existing iridescent mascot without replacing his body
silhouette, five-joint rig, three expressions, or seven gameplay clips. The
socket rims are rebuilt as welded transitions into the original dense donor,
so the body remains one closed component instead of hiding the old faceted
surface beneath an overlapping patch. The face budget is deliberately higher:
25,984 triangles across the same four skinned draws and no textures.

The reviewed delivery is `apps/beside-cue/public/games/glass3d/merc-v2.glb`.
Glass Adventure resolves its logical `merc` asset to that versioned file. The
original `merc.glb` remains available to the separate legacy Glass3D game and
as the before reference; it was not overwritten.

The dense donor, cached sculpt, editable Blender master, and runtime comparison
images live under `<creative-archive>/glass-adventure/merc-character-v2/`.
They are intentionally absent from the repository. `production-receipt.json`
records their portable hashes and the reviewed runtime contract. The public
recipe takes explicit private input and output locations and never writes an
editable master beside the source:

```sh
rtk proxy timeout 7200 flock -w 7200 /tmp/merc-v2.lock env ALSOFT_DRIVERS=null \
  blender --background --factory-startup --python-exit-code 1 \
  --python apps/beside-cue/art/merc/make_merc_v2.py -- \
  --source <creative-archive>/donors/meshy-iridescent-tear.glb \
  --output-dir <creative-archive>/glass-adventure/merc-character-v2/production-source-v2
```

Add `--resculpt` to bypass both cached sculpt inputs and rebuild directly from
the explicit `--source` donor.

Blender may reorder equivalent face triangles and sparse zero morph-normal
entries between exports. Runtime acceptance therefore checks the decoded
topology, rig, clip channels, pose bounds, and shared-loader images rather than
claiming that a rebuild is byte-identical. The shipped bytes and their exact
hash remain fixed in the receipt.
