# Modeling audit, 2026-10-21

Evidence for [the Blender modeler skill plan](../../../../docs/plans/blender-modeler-skill-2026-10-21.md).
Nothing here is loaded by the game.

| File                              | What it is                                                                                                                                                                             |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `audit-grid.jpg`                  | Clay and zebra views of twelve shipped museum GLBs, one image                                                                                                                          |
| `amphora-meshy-vs-procedural.jpg` | The shipped Meshy amphora against the procedural spike, same views, vessel to vessel                                                                                                   |
| `measured-part-ids.jpg`           | False-colour part IDs with callouts measured by slicing the mesh                                                                                                                       |
| `sheets/`                         | One 12-panel contact sheet per real (non-LFS) GLB in `apps/beside-cue/public/games/`, plus the spike                                                                                   |
| `inventory.json`                  | Triangles, open edges, parts and sizes per GLB, after welding UV-seam splits; every mesh counts, shards and collision proxies included                                                 |
| `tools/`                          | The scripts that produced all of the above                                                                                                                                             |
| `tools/research/`                 | The tooling research's own checks: a second lathe recipe with a BVH self-intersection validator, its v1-vs-v3 render, and an exact-colour part-ID probe (`Raw` view transform, AA off) |
| `generators-research.md`          | Meshy and alternative generators, three.js glass, GLB delivery, with sources                                                                                                           |
| `tooling-research.md`             | Blender MCP servers, open Blender skills, bpy recipes, render-and-critique loops, with sources                                                                                         |

Contact sheet columns: **clay** (Workbench studio light with cavity), **zebra**
(the `check_reflection_horizontal` matcap; broken stripes mean dents or broken
curvature), **wire** (Cycles with a wireframe override) and **material**
(Cycles, original materials, gradient world). Rows: three-quarter
(perspective), front and top (orthographic). Shards are hidden when an intact
mesh exists; collision proxies (`COLLIDER_*`, `extras.collision_proxy`) are
always hidden, because they are physics data, not art.

## Reproduce

Blender 5.2.2 LTS, headless. A cloud container also needs
`apt-get install libegl1 libegl-mesa0` for Workbench.

```sh
B=blender   # or the path to a 5.2.2 build
T=art/glass-adventure/proofs/modeling-audit-2026-10-21/tools
$B -b --factory-startup --python $T/render_views.py -- <in.glb> <panel-dir> --res 400 --samples 32
python3 -I $T/compose_sheet.py <panel-dir> <sheet.png> "<title>"
$B -b --factory-startup --python $T/amphora_procedural.py -- <out.glb> [out.blend]
$B -b --factory-startup --python $T/measure_views.py -- <in.glb> <dir> --res 900 [--hide plinth]
python3 -I $T/annotate_measure.py <dir> <out.png> "<title>"
$B -b --factory-startup --python $T/inventory_glb.py -- <out.json> <glb>...
```

A 12-panel sheet takes 25-60 s on 4 CPU cores. The research notes mention
scripts and outputs under a session scratchpad; those paths did not survive the
session and are not needed to reproduce anything above.

37 runtime GLBs in `apps/beside-cue/public/games/` are Git LFS objects and were
not audited (journey maps, Cloudway laboratory, runner obstacles, walls).
