# Tools

Every script the skill uses, what it needs and what it is for. Paths are relative
to `scripts/`. "Blender" means run it inside Blender 5.2
(`$BLENDER -b --factory-startup --python-exit-code 1 --python X.py -- ...`);
"Python" means `python3 -I X.py` (numpy and Pillow); "Node" means Node 22 from
the repository root, where the game's packages are.

## Build, gates and proofs

| Script                                          | Runs in         | Use it for                                                                                                                                                                                                                     |
| ----------------------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `preflight.sh`                                  | shell           | Finding or fetching Blender 5.2.2 and proving headless rendering works. Prints `BLENDER=`                                                                                                                                      |
| `bkit/`                                         | Blender         | The modelling library: `profile`, `lathe`, `sweep`, `trims`, `materials`, `textures`, `fracture`, `validate`, `scene`, `export`. Tested by `tests/test_bkit.py`                                                                |
| `asset_pipeline.py`                             | Python          | One command per round: build, finish, contract, Khronos, silhouette, sheets (`--sheet --shards-sheet`), `--intact-only` for fast form work. Exits 1 on any gate                                                                |
| `validate_asset.py`                             | Blender         | The contract gate on an exported GLB: names, roles, closure, budgets, shard origins and volume, loose pieces                                                                                                                   |
| `gltf_finish.py`                                | Python          | Adds what the exporter drops (`optics.json`: volume, iridescence) and the node extras                                                                                                                                          |
| `gltf_validate.mjs`                             | Node            | The Khronos glTF validator, exit 1 on any error                                                                                                                                                                                |
| `silhouette_render.py`, `silhouette_compare.py` | Blender, Python | The form gate: the model's mask at the concept's camera against the concept's, IoU and ten width bands, `rows.json` for refits                                                                                                 |
| `render_views.py`, `compose_sheet.py`           | Blender, Python | The review sheet: clay, zebra, material ids, ACES material panels, the game's 128 px panel, and a three.js column                                                                                                              |
| `measure_views.py`, `annotate_measure.py`       | Blender, Python | Orthographic measurement renders with a scale, for reading a concept or a shipped mesh                                                                                                                                         |
| `smoke_render.py`                               | Blender         | The render check `preflight.sh` runs                                                                                                                                                                                           |
| `three_preview.mjs`                             | Node            | The GLB drawn by the game's own three.js, light rig and tone mapping in seconds; `--set mat.prop=value` tries a material, `--dump` lists them as three.js loaded them                                                          |
| `runtime_proof.mjs`                             | Node            | The candidate served in place of the shipped file inside the running game, screenshots per shot; fails if the game never asked for the file. Proofs queue on a lock per port                                                   |
| `bench_capture.mjs`                             | Node            | The glass look bench (`apps/beside-cue/glass-bench.html`): one look on the game's renderer settings under five lights, with a mask per shot. Heroes come from disk or the game's public files. Queues on the proof's port lock |
| `bench_sheet.py`                                | Python          | The bench's contact sheet: rows of hero, look and tone mapping against columns of lights, masked CIELAB per cell, and CIEDE2000 across the lights (a look tuned to one light shows a large spread)                             |
| `game_server.mjs`                               | Node            | The dev server, the port lock and software-WebGL Chromium that the proof and the bench capture share                                                                                                                           |
| `bench_publish.mjs`, `bench_page.html`          | Node            | The bench as a static folder for a hosted review page: the bench bundled, its vessels and HDR embedded as scripts (hosted pages serve neither `.glb` nor `.hdr`), a page with controls and the round's notes                   |

## Probes and measurement (no Blender)

| Script             | Use it for                                                                                                                                                                                                 |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `colour_stats.py`  | A region's colour as numbers: luminance percentiles, median colour, Lab means, chroma spread, hue shares. `--width` resizes the concept to the asset's in-game size first (`qa.md` § Colour in the game)   |
| `glb_patch.py`     | Trying a material in the game without a rebuild: base colour, factors, transmission, volume, coat, emission, patched into the GLB's JSON                                                                   |
| `glb_recolour.py`  | Trying a vertex-colour palette without a rebuild: repaints COLOR_0 of chosen materials with the asset's own colour function (`colours.py:opal_colour`), shards at their place, `--set` to sweep a constant |
| `glb_triangles.py` | Triangle quality per node kind and material: slivers under an angle, zero-area triangles, and with `--where` the heights and radii they sit at                                                             |
| `runtime_batch.py` | Several probes through the game in turn (the proofs share one port), only the shots you name, each measured with `colour_stats.py`                                                                         |
| `pack_skill.py`    | A zip of the skill and its critic for a Claude Code install outside this repository (`~/.claude`), with an install note                                                                                    |

## A tuning loop

```bash
# one probe per idea, from the last full build
python3 -I scripts/glb_patch.py out/u13/amber-cadence-urn.glb probe/a.glb 'amber_glass:base=#f0a028,clearcoat=0.5'
python3 -I scripts/glb_recolour.py out/u13/amber-cadence-urn.glb probe/b.glb --material amber_glass \
    --colour art/glass-adventure/procedural/amber-cadence-urn/colours.py:amber_colour --set SIDE='(0.8, 0.55, 0.3)'
python3 -I scripts/runtime_batch.py --config art/glass-adventure/procedural/amber-cadence-urn/proof.json \
    --out probe/runs probe/a.glb probe/b.glb --shots entry --measure 569,128,691,184
python3 -I scripts/colour_stats.py art/glass-adventure/v6-level2/concepts/amber-cadence-urn.png 30,62,132,109 --width 162
```

Then write the winner into `build.py` or `colours.py`, rebuild, and let the next
critic judge the full build: a probe is evidence for a choice, not a deliverable.
