---
name: blender-modeler
description: Model, rebuild, fix, review, fracture and export 3D game assets procedurally in headless Blender 5.2 - bpy build scripts on the tested bkit library, numeric gates (silhouette against the concept, closed manifolds, budgets, the Glassworks node contract, the Khronos validator), a fresh independent model-critic after every stage, and a proof inside the game's own three.js renderer. Use for ANY request to model, remake, improve, review, fracture or export a 3D asset, vessel, column, arch, frame, platform or prop for Glassworks or Beside Cue, to judge a Meshy or other generated mesh, or when asked to act as a 3D modeller. This is the entry point for 3D asset work.
argument-hint: '[asset name, path to a brief, or what to model]'
---

# Blender modeler

You build game assets the way a careful 3D artist would, but as code: every
asset is a re-runnable Blender script whose every dimension is measured, every
part closed and seated, every gate numeric. The builder never judges its own
work; a fresh critic does, after the numbers pass.

Paths below are relative to this skill's folder (`SKILL_DIR`, the folder that
holds this file). Pass its absolute path to every subagent you spawn.

## The pieces

| Piece                   | What it gives you                                                                  | Where                                                   |
| ----------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------- |
| This file               | The pipeline and its non-negotiables                                               | `SKILL.md`                                              |
| `bkit`                  | Tested bpy library: profiles, lathes, sweeps, trims, materials, fracture, validate | `scripts/bkit/`, tests in `scripts/tests/test_bkit.py`  |
| Pipeline runner         | Build, finish, contract, Khronos and silhouette gates, sheets, one summary         | `scripts/asset_pipeline.py`                             |
| QA scripts              | Contact sheets, silhouette gate, measurement renders, runtime proof                | `scripts/`, `references/qa.md`                          |
| `model-critic` subagent | The fresh critic                                                                   | `.claude/agents/model-critic.md` in the repository root |
| Craft rules             | What makes an asset look made by an artist, and how to do each in bkit             | `references/craft-rules.md`                             |
| Recipes                 | Vessel, handle, fracture, step by step                                             | `references/recipes/`                                   |
| Materials               | Glass, gold, jade and marble that survive glTF and read in three.js                | `references/materials-glass.md`                         |
| Blender 5 gotchas       | API changes and export traps that break bpy written from memory                    | `references/blender-5-gotchas.md`                       |
| House rules             | The Glassworks contract: names, extras, units, budgets, files, commits             | `references/house-rules.md`                             |
| Generators              | When Meshy and friends help, and when they cannot                                  | `references/generators.md`                              |
| Lessons                 | This skill's own mistakes log; read before a first build                           | `references/lessons.md`                                 |
| Brief template          | What to know before the first vertex                                               | `ASSET-BRIEF.md`                                        |

The worked example is the Opaline Echo Amphora in
`art/glass-adventure/procedural/opaline-echo-amphora/`: brief, build script,
contract, optics, ledger and every round's sheets and critic reports.

## Operating mode

- Procedural first. Generated meshes (Meshy, TRELLIS, Tripo) are never the
  deliverable for glass, vessels, architecture or anything symmetric; at most a
  bake source for organic detail (`references/generators.md`).
- Do not stop for approval between steps. Report status in one line when working
  for a long time. Stop and ask only for a missing tool, a missing reference, or
  a decision that is the owner's (swapping an asset into the game, budgets).
- Never test against production. The runtime proof runs the local dev server.

## 0. Preflight

```bash
bash scripts/preflight.sh          # last line: BLENDER=/path/to/blender
```

It finds Blender 5.2.2 LTS (`$BLENDER`, PATH, the macOS bundle or
`~/.cache/blender-modeler`) or downloads and checksums it, installs the EGL
libraries headless Workbench needs in a cloud container, and renders one
Workbench and one Cycles frame. Then run the library tests:

```bash
$BLENDER -b --factory-startup --python-exit-code 1 --python scripts/tests/test_bkit.py
```

## 1. Brief

Copy `ASSET-BRIEF.md` next to the build script as `BRIEF.md` and fill it: what
the object is for and why each part exists, the runtime contract it must keep
(names, height, shard count, collider), gameplay camera distance, triangle and
texture budget, the motifs that must survive at gameplay size, and the
references. For a replacement, read the shipped GLB's nodes, extras and collider
first and write them into `contract.json`.

## 2. Measure the references

Measure, do not eyeball. The concept is a perspective-ish painting at some
camera elevation: measure the elevation from an ellipse (`asin(b / r)`), then
read radius per height from the segmented mask, never from a grid read by eye
(`references/lessons.md` has the 3 cm error that caused).
`silhouette_compare.py` writes `rows.json`, every row's outline in the gate's own
normalised units; `references/qa.md` § Fitting maps rows to heights. Cross-check
against any donor mesh by slicing it. Every constant in the build cites a
measurement or says `# inferred`.

## 3. Blockout

Outline curves, real dimensions, the collider envelope, no detail. Gate:
`blockout_pass` (IoU at least 0.85, every width band within 0.05).

## 4. Forms

Build the real shells with the recipes and craft rules: closed, seated, wall
thickness real, materials per span. Gates, in this order, all from one command:

```bash
python3 -I scripts/asset_pipeline.py <asset_dir> <out_dir> [--intact-only] --sheet
```

`forms_pass` (IoU at least 0.90, bands within 0.03), every part closed with no
self-intersections, triangles inside the budget. Then a critic round.

## 5. Detail and materials

Bands, cuffs, inlays and lips as geometry where they read at gameplay size,
within budget; Principled materials from `bkit.materials`, and the extensions
the exporter drops (volume, iridescence) in `optics.json` for `gltf_finish.py`.
Look at the matids panel: every span the material the concept shows. Critic
round.

## 6. Fracture

For breakables: `bkit.fracture.fracture` on the final closed parts, cut faces in
a cut material per part, seeds drawn on every part by area, shards triangulated
and cleaned before export (`references/recipes/fracture.md`). The contract gate
checks count, names, closure, origins at centroids, volume kept within 3% and
the shard budget.

## 7. Export and validate

`asset_pipeline.py` exports through `bkit.export.glb` (modifiers applied, extras
kept, no cameras or lights), adds `optics.json`, runs `validate_asset.py` against
`contract.json` and the Khronos validator, and exits 1 on any failure. A failing
gate is never waved through by a critic's SHIP.

## 8. Runtime proof

```bash
node scripts/runtime_proof.mjs --config proof.json --candidate <out_dir>/<asset>.glb --out <dir>
```

It serves the candidate in place of the shipped file inside the real game, and
fails if the game never requested that file. Shoot the baseline (no
`--candidate`) with the same config. Final critic round on both.

## 9. Ledger and lessons

One `LEDGER.md` row per round in the asset folder: what changed, the gate
numbers, the critic verdict. A failure that exposes a gap in the skill goes into
`references/lessons.md` or `craft-rules.md` first, then the asset is repaired.

## Critic loop

After forms, materials, fracture and runtime, spawn a **new** `model-critic`
with paths only: the GLB, `BRIEF.md`, `contract.json`, the concept and its
elevation, `SKILL_DIR`, the report path, and the previous report for a
verification round. Never tell it what you fixed or what you believe.

- Gates decide first. A critic's SHIP never overrides a failing gate.
- Every finding you act on gets a fix with units ("lining 72 degrees to 144").
- After two non-improving attempts on one issue, switch method.
- Six ONE MORE PASS rounds in a row: stop and report the blocker.

## Quality bar

- Silhouette `forms_pass` against the concept at its own elevation.
- Every part a closed manifold without self-intersections; parts may sink into
  each other, never float or show a gap; nothing reaches into a cavity.
- Zebra stripes continuous on smooth surfaces.
- Budgets (`references/house-rules.md`): hero vessel at most 8k triangles
  intact, shard set at most 1.6 times that; small vessel 4k; column or arch
  module 2-6k.
- Khronos validator 0 errors, contract gate green.
- Runtime proof screenshots from the gameplay camera, candidate and baseline.
- Critic verdict SHIP. Taste stays with the owner, who decides any swap into the
  game.
