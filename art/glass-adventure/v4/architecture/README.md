# V4 marble enclosure bays

Two Meshy source forms, finalized through the Blender MCP background API in isolated files. The interactive Blender scene is untouched. Both source donors were already below the proposed 24k triangle ceiling, so **no decimation, retopology or replacement modeling was performed**.

| Candidate    | Original/final triangles | Width × depth × height, metres | Staged GLB bytes |
| ------------ | -----------------------: | ------------------------------ | ---------------: |
| Window       |                   22,204 | 2.9062 × 0.3616 × 3.6000       |        6,335,148 |
| Solid screen |                   19,479 | 3.2018 × 0.2067 × 3.6000       |        5,972,500 |

Final roots: `meshy_museum_window_bay`, `meshy_museum_screen_bay`. Each has one donor-atlas material, foot-center origin, +Y-up GLB export, UV0, normals and tangents. Do not replace the whole atlas with an ivory palette material: it also contains gilt details and verde skirting.

`sources/*-imported.blend` preserves the untouched import; `sources/*-final-v1.blend` preserves uniform normalization and the original packed 2048² maps. `exports/*-final-v1.glb` embeds three verified 1024² PNGs: base color, metallic/roughness and normal. `reports/*-validation.json` records fresh GLB reimport, hash, exact image dimensions, attributes and no missing source dependencies. `proofs/*-raw-{front,back}.png` and `proofs/*-final-three-quarter.png` show actual geometry, visually inspected.

The window has a real aperture. All 12 central rays pass; horizontal samples measure about 1.308 m of clear width up to 2.088 m height, narrowing to 1.279 m at 2.448 m. A 201-point vertical center probe finds an opening from 0.954 to 3.024 m. Resolution is about 14.5 mm horizontally and 18 mm vertically; these are sampled bounds, not precision fabrication measurements. All matching central rays hit the screen. Exact probes and the GLB hash are in `reports/*-openings.json`.

The sill makes this a window rather than a door. The playable chamber now uses a single oriented screen box and independent jamb, sill and lintel proxies, leaving the opening empty. The authored route and restored gates are covered by coordinator and browser traversal tests; the original asset study alone did not establish collision acceptance. At a 0.55 m mascot height, low eye-level sightlines are below the sill; the follow-camera and placement scale need review before using this enclosure in a course.

Source archives remain in `../../v2/meshy/museum-{window,screen}-bay-01/`, including donor, pre-remesh model, original PBR and provider receipt. Window archive: 11 files / 59,647,145 bytes. Screen: 11 / 57,917,448. Root submitted both jobs at 30 credits each; this finalization made no charged calls and did not edit the shared ledger.

Final hashes:

- Window: `f89dd6f919cc066c84d1673afe50d3a567437f78d9038fc318743429e6e1ff81`
- Screen: `b65b69a09f2c2a5ae33c71cf00e7e5ea6d6aeb97d28856c0635f598e596838a8`

## Reproduce

Use the Blender MCP `execute_blender_code_for_cli` entry with this directory's `bootstrap.blend`. Add this directory to `sys.path`, then call `pipeline.run('intake', ['--source', donor_path, '--asset-id', id])`, `pipeline.run('finalize', ['--asset-id', id, '--target', '24000', '--height', '3.6', '--version', new_version])`, `export_runtime.run(stem)`, `pipeline.run('validate', ['--stem', stem])`, and `probe_bay.run(stem)`. Use a new version when artifacts already exist. `pipeline.run('proof', ['--source', glb_path, '--name', proof_name, '--wide', '--views', 'three-quarter'])` renders a separate studio file.

The explicit export derivative step is required: Blender can retain original packed image bytes after `Image.scale()`. The V4 adapter reloads saved 1K derivatives into new export-only image datablocks; it never resaves the packed 2K source. This was caught by the byte-level image gate and corrected before acceptance. A read-only audit confirmed all three existing V3 architecture exports already contain genuine 1K maps; no V3 correction was needed.

## Integration budget proposals

The two unique bay atlases imply about **32 MiB** of RGBA8 GPU texture storage with mipmaps if both are resident (six 1K images, ~5.33 MiB each), before geometry, environments and transient decode. This is a planning estimate, not a GPU measurement. Nine room instances total **186,211 bay triangles**, sharing 41,683 unique triangles. Preserve this sharing; do not flatten every room instance into independent geometry. These staging files are not compressed shipping assets. Mobile frame-time, loading and final enclosure placement remain unmeasured.

## Playable module export — 2026-09-20

`export_playable.run()` exports the two preserved source Blends to the app's
`public/games/adventure-v4/` directory. It retains geometry, UVs, root names,
natural scale, and the full ivory/gold/verde atlas. Only the opaque base-color
image becomes JPEG quality 95; normal and metallic/roughness remain lossless
PNG. All embedded maps are verified at 1024², and both 2048² packed source
files retain their original SHA-256 hashes.

| Runtime module          | Bundle ID          |     Bytes |
| ----------------------- | ------------------ | --------: |
| `museum-window-bay.glb` | `museum-window-v4` | 5,047,156 |
| `museum-screen-bay.glb` | `museum-screen-v4` | 4,686,268 |

The pair is 2,574,224 bytes smaller than the review exports (20.9%). This
reduces transfer size, not decoded texture memory. `reports/playable-export-v1.json`
records sources and hashes; `playable-glb-validation-v1.json` verifies embedded
formats/materials/triangles; `playable-reimport-v1.json` records a fresh Blender
import confirming dimensions, foot-level origin, UVs and triangle counts.

The new chamber consumes repeated instances of these two modules, not the
57 MB enclosure study. Full in-game visual and physical-device performance
acceptance remain separate from these asset checks.

## Playable scene inspection

`proofs/playable-v1/` preserves all 22 desktop/portrait frames and the
22-view renderer report. These use actual runtime assets and the chamber level,
covering arrival, wall clearance, turns, closed/open gates and panorama orbit.
The camera retains a legible third-person view on the normal route; when Merc
is pressed into walls or corners it retracts and can rise above the character
to keep the camera inside the architecture.

The full chamber has 11 window and 8 screen instances: 400,076 bay triangles
per main pass, sharing 41,683 unique triangles. Recorded complete-scene render
statistics include additional shadow passes (up to about 1.27 million submitted
triangles in the inspected views). These software-WebGL images demonstrate
composition and asset installation; they do not establish physical-device FPS.
Device acceptance remains pending before expanding this recipe into full wings.
