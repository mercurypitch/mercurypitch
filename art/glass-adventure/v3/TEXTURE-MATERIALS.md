# Donor paint regions to physical glass and gold

`texture_materials.py` is an authoring helper. It does not modify the running game,
source archives, geometry or UVs. It labels final faces by sampling the nearest
textured donor triangle at each target face centroid with barycentric UV mapping.
There is no transfer of UV chart connections and no copying of baked reflections.

## Contract

Run inside Blender with NumPy (verified Blender 5.2.2 LTS). Normalize the textured
20k donor using the **same high-source bounds and transform** used for the final
mesh. Do not normalize each mesh independently. Update the view layer after
changing object transforms. Classification reads actual mesh data; apply intended
geometry modifiers first. Prefer the triangulated pre-fracture intact surface.

```python
report = classify_faces(
    intact, textured_sources,
    gold_srgb_samples=reviewed_gold_swatches,
    glass_srgb_samples=reviewed_gray_swatches,
    max_distance=inspected_distance_in_metres,
    min_margin=reviewed_class_margin,
    max_chroma_distance=reviewed_color_distance,
)
# Inspect diagnostic colors and the unresolved faces first.
apply_face_labels(intact, report, {
    'glass_shell': physical_glass,
    'gold_trim': physical_gold,
})
```

Both sample lists contain explicitly inspected source colors in sRGB 0..1.
Chromaticity reduces baked-lighting influence; it does not prove semantic identity.
Distance limits are scene-specific. Each report row includes sampled RGB, source
triangle, correspondence distance, class margin and rejection reasons. Out-of-range,
dark/transparent and ambiguous colors stay `material: None`. Assignment refuses any
unresolved face before changing a material slot. The caller must resolve those
regions by inspecting their surface and source, retain that decision in the recipe,
and regenerate labels after topology changes. Face indices are valid only for the
exact target topology used for classification.

Current supported sources are a direct sRGB byte image feeding Principled Base
Color, explicit UVs and repeat/clamp sampling. Unsupported shader transforms fail
explicitly. Blender byte-image pixel values are already encoded sRGB; do not apply
a second color conversion. Source UV charts may be fragmented: each centroid is
sampled independently. Gold/glass boundaries remain limited by final triangle
resolution. This helper neither subdivides triangles nor smooths uncertain labels.

## Verification

```sh
rtk proxy timeout 30s blender --background --factory-startup --python-exit-code 1 \
  --python art/glass-adventure/v3/tests/test_texture_materials.py
```

The Blender fixture passes: nontrivial UV interpolation on disconnected charts,
world-space translation/scale, correct glass/gold colors, unchanged vertices/UVs
and source materials, rejection outside the inspected source distance, rejection
of overlapping swatches, and atomic refusal to assign unresolved labels.

A separate provisional coupe study used the existing 30k prepared target and the
original textured 20k donor, both transformed using the high-source normalization.
It yielded 18,521 glass faces, 9,938 gold faces and 1,541 unresolved faces. Maximum
surface distance was 1.865 mm; p95 was 0.298 mm. Actual diagnostic rendering shows
the donor rim, leaf band, stem collars and foot ring preserved; unresolved magenta
faces occur mainly around fine trim boundaries. This is a region-transfer proof,
not final fracture acceptance or an approved runtime asset.

Study artifacts are under the local agent output directory
`2026-09-15/glass-v3/material-transfer/`: `coupe-regions-diagnostic.png`,
`coupe-sampled-atlas.png`, `coupe-region-report.json`, and `coupe-proof.py`.
The report records the actual sampled swatches, pixel coordinates and limits.
These swatches belong to this coupe atlas and must not be reused blindly for
another family.
