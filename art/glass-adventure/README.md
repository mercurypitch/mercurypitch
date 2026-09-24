# Floating glass museum assets

The first production kit for the approved adventure: six marble/brass/petrol
platform modules, a classical arch and column, a Meshy astrolabe, three glass
vessels, and a Johnny Cash portrait slab. Merc remains the existing approved asset.

Sources and these generated outputs are owned here. Runtime assets are written to
`apps/beside-cue/public/games/adventure/`; the shared game resolves their URLs through
its host adapter. No source path is hard-coded into a production manifest.

## Rebuild

From the repository root, with Python/Pillow and Blender available:

```sh
rtk proxy python3 art/glass-adventure/prepare_textures.py
rtk proxy timeout 120s blender --background --factory-startup --python art/glass-adventure/build_assets.py -- --render
rtk proxy python3 art/glass-adventure/validate_assets.py
```

The same builder is callable through Blender MCP's isolated
`execute_blender_code_for_cli` using `runpy.run_path(..., run_name="__main__")`.
It resets only its background process, saves `museum-kit.blend`, and does not read
or alter the interactive user's scene. Blender backup files are disabled for this
owned generated file. `--portrait /absolute/path.jpg` overrides the default encoded
portrait when deliberately producing a new approved variant.

`prepare_textures.py` preserves the source composition and records source/output
hashes. Portrait and floor WebP files use RGB quality 90. The sky uses quality 92,
method 6, at its original 1774 × 887 size. JPEG derivatives at quality 90 are
embedded in GLB for broad loader support. The PNG masters remain in `textures/`.
No hand-edited mesh or hidden UI state is needed to rebuild the kit.

## Runtime contract

| Resolver ID                                     | File                      | Important root nodes                                                                                                                                               |
| ----------------------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `museum-kit`                                    | `platform-kit.glb`        | `platform_terrace`, `platform_island`, `platform_ledge`, `platform_bridge`, `platform_plinth`, `platform_ramp`, `museum_column`, `museum_arch`, `museum_astrolabe` |
| `vessels` (also `vessel-vase`, `vessel-fluted`) | `vessels.glb`             | `vase_rounded`, `vase_fluted`, `vase_amphora`                                                                                                                      |
| `legend-slab`                                   | `legend-slab.glb`         | `legend_cash`                                                                                                                                                      |
| `legend-johnny-cash`                            | `legend-johnny-cash.webp` | 1024 × 1536, no crop                                                                                                                                               |
| `floor-marble`                                  | `floor-marble.webp`       | 1024 × 1024                                                                                                                                                        |
| `museum-sky`                                    | `museum-sky.webp`         | 1774 × 887, 2:1 panorama, no resize                                                                                                                                |

The vessel resolver IDs intentionally share a bundle: cache the promise by URL.
Find roots and meshes by name, not by array order. All units are metres and glTF
exports are y-up. Platform origins sit at their walking surface. Breakable roots
sit at their foot; the portrait base extends slightly below that anchor. The ramp
rises 0.55 m over 2.2 m: its low edge is z=-1.1, high edge z=+1.1 before host rotation.

**Each breakable contains both the intact mesh and its 16 shards.** Show
`<variant>_intact` initially and hide `<variant>_shard_000` through `_015` until the
break. `extras.role` records this distinction, but glTF does not encode Blender's
viewport visibility. Preserve each shard's local geometry and centroid translation
when assembling the actor. Reset these transforms before reuse. The manifest lists
persistent bases and the slab frame; keep them when switching to the shards.

The three vessels are closed, hollow glass surfaces with 7 mm authored walls. The
amphora's handles are included in the intact geometry and two corresponding shards;
they do not remain floating after the body breaks. Some connected-looking details
are separate closed shells within one mesh; do not assume a single connected volume
or use these decorative meshes directly as gameplay colliders.

The slab is 0.72 × 1.08 × 0.045 m with its image facing +Z. It retains the source
portrait's 2:3 aspect. `legend_portrait` is the face material, `legend_edge` the side
glass. The UVs remain continuous between the intact mesh and all 16 Voronoi pieces.
Actual glTF V coordinates follow the glTF image convention, opposite Blender's V;
use the loaded UVs directly rather than applying an additional flip.

Platform decoration is consolidated to at most five meshes/materials per module.
The floor/collider footprint is independent from hulls, inlay, arches and columns.
`museum_ivory` contains the embedded marble texture; `museum_brass`,
`museum_petrol`, `museum_obsidian` and `museum_cyan` provide the other material
families. Repeating geometry and whole-scene draw budgets remain the renderer's
responsibility. Glass needs the game's environment/light setup; the review renders
are an art check, not a claim of native rendering or frame-rate acceptance.

## Verification

The builder rejects any open/non-manifold intact or shard surface and verifies
the sum of shard volumes against the intact volume. `validate_assets.py` then
independently parses the exported GLB bytes: header/length, hashes, node existence,
triangle counts, finite coordinates, transformed signed volumes and portrait UVs.
Results are saved in `validation.json`.

The saved Blender scene contains the normalized production arrangement. Review
renders use a temporary display arrangement after export and are not saved back
into the production scene:

- `asset-review.png`: complete kit and optional panorama ornament.
- `breakables-review.png`: actual glass forms and portrait readability.
- `fracture-review.png`: separated real fragments with matching UVs and retained bases.

## Provenance and spending

Root generated the concept, portrait, marble and sky masters through built-in imagegen
on 2026-09-14. Their hashes and encoding details are in `textures/provenance.json`;
the exact original concept/portrait/marble prompts are in [image-prompts.json](image-prompts.json). The
sky prompt and source are recorded in [sky-prompt.md](sky-prompt.md). The renderer
copied the sky master and encoded the WebP; this directory's texture script
reproduces that encoding. The authored GLBs did not change for the sky addition.

The single Meshy task is `01a0a1c0-6929-7636-be07-ac4e3dab7514`: a preview/untextured
astrolabe, `latest`, standard model, triangle topology with a requested 6,000-face
remesh, GLB only. Actual output is 6,167 triangles. It cost **20 credits**, with
balance **4,680 → 4,660**. The connector did not return an explicit resolved model
version; `latest` is recorded honestly rather than labeled a pinned model. Its
unmodified donor is `meshy/astrolabe-01.glb`; the builder normalizes it to 2.4 m and
applies the museum brass material. It is a non-colliding background ornament.

No other Meshy operations or retries were needed. The first-wave ceiling remains
330 credits and was not used as a spending target.
