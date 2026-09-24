# Floating Glass Museum — v2 production

This directory is a separate production pass. V1 artwork, runtime bundles and
Blender scene remain unchanged. All Blender work runs in isolated background
processes. The user's interactive scene is not opened.

## Current delivery

- `build_architecture.py` builds the exact-dimension floor, cornice, masonry arcade,
  column, balustrade and open gold-rib rotunda catalogue. It imports v1 primitive
  functions as a library but redirects every output to v2.
- `build_vessels.py` builds reference-led, **Blender-authored** hollow laurel goblet
  and scalloped rose vase. These are not Meshy outputs. Fluted vase and amphora
  currently retain the v1 silhouettes with corrected UV/material preparation.
  The two new vessels each have 23 seeded convex Voronoi fragments, cut with
  exact Booleans against triangulated hollow glass and separate gilt components.
  Closed cut caps use `glass_cut`; gold stays on its matching fragments.
- Root-owned `build_gardens.py`, `models/garden-kit.blend` and runtime
  `garden-kit.glb` add foliage and irregular island skirts (`museum-garden-v2`).
  The garden manifest records 9,440 triangles total: perimeter 4,552, foliage
  3,352, ivy 1,056 and island root 480; bundle 813,920 bytes. These are separate
  from the architectural and vessel bundles.
- `architecture-manifest.json` and `vessels-manifest.json` record bounds, pivots,
  material slots, triangle counts, origins and file hashes. `validation.json`
  independently checks the exported GLB hashes, every primitive’s normal/UV/
  tangent channels, fracture volumes and open-mouth centre rays.
- `models/museum-kit.blend` and `models/vessels.blend` are saved before arranging
  the studio review images. Re-running a builder recreates its isolated file.
- `architecture-review.png`, `vessels-review.png` and `fractures-review.png` are
  real Cycles renders of the models, not generated promotional pictures.
- `references/manifest.json`, `image-prompts.json` and `architecture-prompts.json`
  preserve the generated reference art and prompts. The selected
  inventory is six beauty references, six geometry guides and three architecture
  references. Sixteen generated output files include one rejected decanter guide
  and its correction. `references/geometry-manifest.json` records the selection;
  use `cut-crystal-decanter-geometry-v2.png` with a closed solid stopper. The
  original beauty references remain the visual target.
- `source-pbr/manifest.json` and `source-pbr/README.md` preserve provider-authored
  CC0 maps, source URLs, licences and hashes. Maps are shared external runtime
  files, never duplicated inside these GLBs.

The kit is a structural and material integration proof. Its capitals, decorative
relief and silhouette detail still need comparison against the more ornate image
references. Renderer measurements are separate from these source counts; file counts do
not prove mobile acceptance. The optimized architecture catalogue is 54,224
triangles (previously 101,264), 3,622,720 bytes, with 34 material primitives.
The terrace is 9,920 triangles and the rotunda 21,936. Small bead cross-sections,
underside arch samples, acanthus rows and bevel subdivisions were reduced while
retaining the major silhouettes, fluting, ridges and named material slots. The source reference calls for an open canopy, so there is no
`rotunda_glass_roof` surface.

## Reproduce

From the repository root, with Blender installed:

```sh
rtk proxy timeout 180s blender --background --factory-startup --python art/glass-adventure/v2/build_architecture.py -- --render
rtk proxy timeout 240s blender --background --factory-startup --python art/glass-adventure/v2/build_vessels.py -- --render
rtk proxy python3 art/glass-adventure/v2/validate_assets.py
```

Blender may return shell status zero after a Python exception. Check the emitted
`V2_ARCHITECTURE` / `V2_VESSELS` success record, resulting manifest and validation,
not only the shell exit code. These commands write only their v2 outputs.
The vessel bundle is 3,391,920 bytes including hidden shards and retained legacy
variants. Exported reconstruction error is below 2.2e-8 for both new vessels;
vertical centre rays reach the interior bases at 0.237 m and 0.012 m, confirming
that the goblet and rose-vase mouths remain open. `validation.json` is the
current combined report; the earlier `vessels-validation.json` is superseded.

## Renderer contract

Runtime files live in `apps/beside-cue/public/games/adventure-v2/`:

- `platform-kit.glb`, resolver `museum-kit-v2`.
- `vessels.glb`, resolver `vessels-v2`.
- External texture and environment files are defined by `source-pbr/manifest.json`.

All meshes export metres, +Y up and +Z front. Floor parent roots have their
walking surface at Y=0 and explicitly recorded box dimensions. Keep authored
course colliders and encounter anchors. Do not infer collision from arcade or
ornament geometry. Prefer repeating a module over stretching decorative bays.

Architecture roots: `platform_terrace`, `platform_island`, `platform_ledge`,
`platform_bridge`, `platform_plinth`, `museum_column`, `museum_arch`,
`museum_arcade_bay`, `museum_balustrade`, `museum_rotunda`.

Breakable roots: `goblet_laurel`, `vase_rounded`, `vase_fluted`, `vase_amphora`.
Each manifest identifies its `_intact` node, exact `_shard_NNN` nodes and any
persistent foot hardware. Shards retain assembled transforms, surface UVs and
material groups. Hide shards until break; do not render intact and shards at the
same time. Gold decoration is split or attached to matching fragments.

Material slots: `museum_ivory` (warm Carrara), `museum_limestone` (cream stone),
`museum_petrol` (dark verde marble), `museum_brass` (gold); `museum_obsidian` is
reserved separately. Glass uses `glass_shell`, `glass_cut` and `gold_trim`.
Keep source roughness/transmission/IOR and assign maps deliberately by slot.

Architecture UV0 is one UV repeat per metre. Runtime repeat `.833333` produces a
1.2 m marble/limestone tile; repeat `4` produces a 0.25 m gold tile. Vessels use
seam-correct cylindrical exterior mapping and separate cap projection. Normals,
UV0 and tangents are exported on every primitive. No images are embedded.

## Meshy preparation and spend

`meshy_pipeline.py` uses the existing configured official Meshy MCP launcher. It
never reads, displays or stores API credentials; `pass-cli` injects them only
into the existing server child. Initial discovery found the password-manager
session expired, so no v2 Meshy task has been submitted yet.

After the owner restores that session:

```sh
rtk proxy timeout 90s python3 art/glass-adventure/v2/meshy_pipeline.py balance
rtk proxy timeout 90s python3 art/glass-adventure/v2/meshy_pipeline.py schemas
```

A charged submission requires an inspected reference in `v2/references`. The
user authorized production within approximately 4000 credits; the team set an
internal first-wave ceiling of 600 credits. Current
installed MCP 0.4.0 exposes `latest` but not `ultra_mode`; the current official
API maps `latest` to Meshy 7. Standard geometry tasks quote 20 credits; textured
2K tasks quote 30. The helper records intent before submission, refuses duplicate
logical names, checks balance and reserves the quoted cost against the ceiling.
It never retries charged submissions automatically. An interrupted/uncertain
submission must be reconciled against the provider before another submission.

Example **charged** command, to run only after the reference has been inspected:

```sh
rtk proxy timeout 90s python3 art/glass-adventure/v2/meshy_pipeline.py submit --name laurel-goblet-01 --reference art/glass-adventure/v2/references/laurel-goblet-geometry.png --polygons 18000
```

Use `status --name ...` for a single read-only status call and `download --name
...` to retrieve the completed GLB. The source donor stays under `meshy/<name>/`.
Before accepting a donor, inspect its open mouth/cavity, silhouette, disconnected
parts, normals and topology. Normalize the foot pivot and metre dimensions in
Blender; keep high-detail originals for baking. Generated appearance is not a
substitute for physically authored glass materials or exact fracture geometry.

Current family reference inventory: laurel goblet, rose bud vase, fluted carafe,
moon amphora, cut-crystal decanter and aurora coupe. The decanter stopper must be
solid even if an early geometry guide shows an erroneous small top hole. Legend
portrait treatment continues separately from the existing approved portrait.
