# cut-crystal-decanter material-region audition

This is a reviewed source-color recipe, **not accepted final geometry or materials**.
The target is provisional and its surface/fracture gate is owned separately.
No source GLB or .blend was written; before/after hashes are identical.

## Available proof

- `recipe.json`: source paths, common high-source normalization, explicit swatches and limits.
- `proof-v2/source-atlas-swatches.png`: actual embedded donor atlas with reviewed sample positions.
- `proof-v2/regions-three-quarter.png` and `regions-back.png`: actual provisional geometry, diagnostic materials.
- `proof-v2/summary.json`: exact source/target hashes, colors, thresholds and counts.
- `proof-v2/face-labels.json.gz`: explicit per-object exterior face labels and uncertainty; valid only for the hashed target.

Diagnostic cyan means glass, gold means gold, magenta means unresolved and dark blue
means authored interior excluded from paint projection. These opaque colors are
classification aids. The finished asset must use optical glass and metal with
separate physical material slots; no donor clay color or baked lighting should carry
over as the final glass finish.

The actual donor has a narrow gold neck band and lower base border; the stopper and cut body stay glass. This does not invent gold over the cut facets. The authored cavity/rim and stopper underside are excluded from donor color sampling and retain their authored glass material.

## Measured outcome

37,924 glass + 2,118 gold + **29 unresolved**
= 40,071 inspected exterior faces (0.072% unresolved).
17,112 authored interior faces were excluded.

Reviewed sRGB sample vectors:

- gold: (0.615686, 0.552941, 0.462745); (0.835294, 0.756863, 0.662745)
- glass: (0.643137, 0.643137, 0.643137); (0.639216, 0.639216, 0.639216)

Used limits: maximum source distance 6 mm, minimum competing-class chromaticity
margin 0.007, maximum nearest-class chromaticity distance 0.06. These are audition
limits, not an automatic acceptance rule. See the measured distance max/p95 per
object in `summary.json`; actual maxima are below 2 mm. Narrow the correspondence
limit for a final stable mesh if its displacement permits, and inspect geometry
normals and region boundaries directly. Do not lower the ambiguity margin merely
to eliminate the unresolved count.

The initial `proof-v1` contains a rejected sample selection: a low-resolution atlas
coordinate landed on gray when gold was intended. The overlap guard stopped before
assignment. Both remaining gold sample positions were then verified in the actual
annotated atlas. That rejected evidence remains separate from this completed proof.

## Reproduce on a new target revision

Update the recipe target path and normalization if the owning agent supplies a new
prepared mesh; keep the textured 20k donor transformed by the SAME high-source
normalization. Set a fresh output directory before running:

```sh
rtk proxy timeout 120s blender --background --factory-startup --python-exit-code 1 \
  --python art/glass-adventure/v3/material-regions/prove_regions.py -- \
  --recipe art/glass-adventure/v3/material-regions/cut-crystal-decanter/recipe.json
```

Regenerate all face labels after topology changes. Resolve individual uncertain
regions through inspection and record explicit face decisions in the final recipe.
The full report intentionally contains no guessed default material.
