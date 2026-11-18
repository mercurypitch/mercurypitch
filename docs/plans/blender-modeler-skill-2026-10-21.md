# Plan: a Blender modeling skill that makes the museum assets good

**Date:** 2026-10-21 · **Branch:** `feat/blender-modeler-skill` · **Status:** the
skill is built and two vessels are rebuilt with it (`art/glass-adventure/procedural/`);
the measured comparison with their Meshy files is in
[`meshy-vs-procedural.md`](../../art/glass-adventure/proofs/modeling-audit-2026-10-21/meshy-vs-procedural.md).
Nothing in the game changes until the owner swaps a file in. Both vessels
stopped on their glass; the next step is
[`glass-look-system-2026-10-23.md`](glass-look-system-2026-10-23.md).

Evidence for every claim below is in
[`art/glass-adventure/proofs/modeling-audit-2026-10-21/`](../../art/glass-adventure/proofs/modeling-audit-2026-10-21/):
contact sheets of every shipped museum GLB, the side-by-side, the inventory and
the scripts that produced them (re-runnable with Blender 5.2.2 headless).

---

## 1. Verdict

**Model the museum procedurally in Blender. Use Meshy (or any image-to-3D
generator) only for organic pieces, and only as a high-poly source you bake from
or a reference you measure, never as the shipped mesh.**

Of the 23 shipped museum GLBs rendered for this audit, 18 are lathe or radial
glassware, classical architecture, plinths, frames and platforms; 5 are organic
or sculptural (two foliage kits, the swirl carafe, the harp, the crystal
platform). For the 18, a parametric `bpy` build beats a
generator on every axis we can measure: exact symmetry, truly flat planes, clean
shading, a triangle count we choose, closed shells ready for fracture, and a
build that can be edited and re-run. Generators still earn their place for
foliage, statues, acanthus and similar sculpted ornament, which is the minority.

Procedural alone is not the fix. The very first kit (`adventure/vessels.glb`,
v1) was a `bpy` lathe and it also looks cheap. What separates good from bad is
craft: spline profiles, wall thickness along the normal, rounded lips, tapered
swept handles, bevels on every edge, references measured before modeling, and a
critic that looks at clay, zebra and wireframe renders every round. The skill's
job is to make that craft the default.

## 2. What was wrong with the current assets

Rendered headless in Blender 5.2.2 from the exact shipped GLBs: clay, zebra
stripes (a reflection matcap that exposes dents and broken curvature), wireframe
and material, each from three-quarter, front and top
([overview](../../art/glass-adventure/proofs/modeling-audit-2026-10-21/audit-grid.jpg)).

| Family                              | Examples (shipped GLB)                                                                                | What the renders show                                                                                                                                                                                                                             |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Simple vessels, Meshy at low budget | `adventure-v6/opaline-echo-amphora-qa-v2`, `amber-cadence-urn-qa-v2`                                  | Dented, lumpy surfaces (zebra stripes shatter), bodies that should be perfectly round but are not, melted joins at handle and foot, uneven lobes, mushy gold bands. The form and texture follow the concept; the surface does not. 8.7k-9.9k tris |
| Ornate vessels, Meshy dense         | `adventure-v3/moon-amphora-qa-v2`, `glassware-trio-v1/*`                                              | Real detail (fluting, laurel, petals) but 93k-227k tris for one intact vessel (up to 475k per file with shards), triangle soup, radial repeats that are not identical.                                                                            |
| Vessels, first `bpy` lathe (v1)     | `adventure/vessels.glb`                                                                               | Faceted silhouette from an 8-9 point polyline (`build_assets.py:623`), inner wall offset horizontally (thin shoulders, flat-cut rim), flute ripple applied to the lip and foot too, 8-sided constant-radius handles with kinks.                   |
| Architecture, Meshy                 | `adventure-v3/gilded-column`, `garden-arcade`, `observatory-canopy`, `adventure-v4/museum-window-bay` | Walls that should be flat are faceted (zebra breaks up on planes), wobbly flutes, uneven dome ribs, melted mouldings, sliver triangles on flat tops. 22k-40k tris, several times the budgets in section 7.                                        |
| Decor, Meshy                        | `adventure-v6/twin-tone-resonance-harp`, `adventure-v5/museum-decor`                                  | Faceted orbs and ribbons, melted base mouldings, fused leaves, a sliver triangle that reads as a crack across the mirror panel.                                                                                                                   |

Topology is **not** the main problem: after welding UV seams, the vessels are
closed manifolds (the earlier pipeline worked hard on that). The problem is form,
surface quality and budget, which only renders show. Validators passed while the
art failed, which `docs/agent/MISTAKES.md` already records twice
("Review asset reduction at the closest gameplay view", "Review silhouettes
before reducing generated museum assets").

The process cost was large: `art/glass-adventure/` holds 246 Python scripts
(73k lines) and 50 plan documents, most of them auditing, repairing and
receipting provider output (`v6-level2/finalize_vessels.py` alone is 64 KB of
cavity carving, manifold repair and remesh probes for three Meshy vases). The
existing skill, [`.agents/skills/game-asset-production`](../../.agents/skills/game-asset-production/SKILL.md),
is a preservation and audit checklist. It says what not to destroy; it does not
teach how to build anything well.

## 3. The spike: same amphora, procedural, same budget

`tools/amphora_procedural.py` (about 250 lines of `bpy`, no add-ons) builds an
amphora from one closed spline profile (outer wall, rounded lip, inner wall
offset along the normal, thick base), revolves it, sweeps two tapered handles
with rotation-minimising frames that flare into the wall without entering the
cavity, adds half-round gold trims and a revolved plinth whose edges are all
rounded. Two rounds, about one minute of compute each:

- v1: right construction, but 27.7k tris and handle ends visible through the glass.
- v2: 7,960 tris for the vessel against the shipped Meshy vessel's 8,728 (intact
  mesh, its collision proxy excluded). Every part a closed manifold. Clean mouth.

[Side-by-side](../../art/glass-adventure/proofs/modeling-audit-2026-10-21/amphora-meshy-vs-procedural.jpg):
the zebra stripes run unbroken around the procedural body and shatter on the
Meshy one; the wireframe is even quads instead of decimation soup; refraction
reads through a real 9 mm wall and a thick base.

The spike is not a finished asset, and the
[measured part-ID render](../../art/glass-adventure/proofs/modeling-audit-2026-10-21/measured-part-ids.jpg)
says why in numbers: belly diameter over height is 0.53 against the concept-led
Meshy form's 0.62, so the spike is too slim; and it has none of the concept's
surface richness (opal iridescence, the embossed wave band). Fitting proportions
to the reference and building materials are exactly the skill's later steps.
The Meshy version shows what a generator is good for here: it read the concept's
proportions and colour well. That is reference value, not mesh value.

## 4. What the Reddit thread taught, and what we take

Source: r/ClaudeAI "Claude Opus 5.5 on 3D modeling" (2026-10-21, OP
u/Ok_Broccoli_1872, 38 comments; the post body was held by the automoderator,
so the workflow comes from the OP's replies and two images they attached).

| Insight from the thread                                                                                                         | Take it?                | How it lands in the skill                                                                                                                 |
| ------------------------------------------------------------------------------------------------------------------------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Set project rules first: research before building, no guessing, reason about why each part exists, keep a log of every mistake  | Yes                     | The brief asks "why does each part exist"; `references/lessons.md` is the skill's own mistakes log; repo-level ones go to MISTAKES.md     |
| Compare everything to a moodboard and reference images, every iteration                                                         | Yes                     | Reference pack before blockout; silhouette overlay and IoU against the reference each round                                               |
| "Nothing in the real world has perfectly cut edges. Never make perfectly cut edges." (OP: it "made it into a beast right away") | Yes, as rule 1          | Every edge gets a bevel or a rounded profile sized to the material; a script flags sharp unbevelled edges                                 |
| "Now it measures everything": prints images with measurements and dots; colour-coded parts to check fit (the eyeball image)     | Yes, prototyped         | False-colour part-ID render with callouts measured by slicing the mesh (`tools/measure_views.py`); it caught the spike's slim proportions |
| One orchestrator, 5-7 sub-agents with roles (modeling, lighting, grading)                                                       | Partly                  | Orchestrator plus parallel builders for kits, and a fresh independent critic each round (the `motion-critic` pattern we already trust)    |
| Max effort; "the jump from medium to high is EXTREME"                                                                           | Yes                     | Builder and critic subagents run at high effort; the skill says so explicitly                                                             |
| Drive Blender headless until decent, then a human points at screenshots of what to fix                                          | Yes                     | Headless builds are the source of truth; the owner's review is screenshot-driven at the end, not the loop                                 |
| Prototype with placeholders; art after the game works; refine topology last                                                     | Already true here       | Blockout stage with gameplay dimensions and collider envelope before form                                                                 |
| Vision helpers SAM3 / DINOv3                                                                                                    | Later, optional         | Our concepts sit on plain grey backdrops, so a threshold mask is enough for silhouette IoU; SAM3 only if references get busy              |
| Photogrammetry as a 3D reference layer; ffmpeg frames from reference video                                                      | When references exist   | `references/` step accepts scans and video frames                                                                                         |
| For generation use TRELLIS 2.0 or Tripo3D, but "usually not fit for games"; redo textures and mapping                           | Yes, the caveat matters | Generators are sources to bake from, never shipped meshes (section 6)                                                                     |
| Orchestrate cheaper models (Qwen) under Opus to save cost                                                                       | No, not now             | Out of scope                                                                                                                              |
| Faces, hair, animation and anatomy remain weak                                                                                  | Noted                   | Not in this museum's scope; Merc's rig stays as is                                                                                        |

## 5. What already exists, and what we borrow

Full notes with every source:
[`tooling-research.md`](../../art/glass-adventure/proofs/modeling-audit-2026-10-21/tooling-research.md).

**Blender MCP servers.**

- **The Blender "connector" Anthropic announced on 2026-04-28 is the official
  Blender Lab MCP.** It is GPL-3, needs Blender 5.1+, and has 26 tools: code
  execution (including `_for_cli` variants that run `blender --background`
  themselves), renders, scene summaries, and a search over the bundled Python
  API docs. Its screenshot tools need a real window; headless agents render
  instead. Our `art/glass-adventure/README.md` already calls its
  `execute_blender_code_for_cli`, so the owner has it installed.
- **mcp-for-blender** (formerly ahujasid/blender-mcp) adds Poly Haven,
  Sketchfab and generator calls, but refuses to start under `blender -b`, has no
  socket authentication, and had two CVEs this year.
- **Consequence:** the skill's source of truth is versioned headless build
  scripts (`blender -b --factory-startup --python build/NN_phase.py`). MCP stays
  optional, for live, screenshot-driven edits on the owner's desktop, which is
  the OP's "headless until decent, then point at what to fix".

**Open skills worth borrowing ideas from** (all MIT or similar; we write our
own code and credit them, as `motion-designer` does):

| Source                                                                                                              | What it gets right                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [majidmanzarpour/blender-game-skills](https://github.com/majidmanzarpour/blender-game-skills) `blender-image-to-3d` | Closest to our need. Gated phases; "nothing gets detail until its silhouette passes"; renders at gameplay pixel size (128 px), because "the viewport is not evidence"; a brief with 8-15 measured proportions and an INFERRED list; IoU 0.85 blockout and 0.90 forms with a 10-band width profile; world-registered IoU that catches a model that is too short. |
| [RobLe3/cc-blender-skill](https://github.com/RobLe3/cc-blender-skill)                                               | A refinement loop that patches the skill before repairing the asset; orthographic coordinate contracts; "do not tune lighting to hide geometry failures"; candid limit: "functionally correct objects but not well-designed ones".                                                                                                                              |
| [new-experement/blender-asset-studio](https://github.com/new-experement/blender-asset-studio)                       | Maker is never reviewer; findings written as reference, candidate, difference, executable fix with units; after two non-improving attempts on one issue, switch method; detail under 4-6 projected pixels goes to a map.                                                                                                                                        |
| [EL4CTEO/blender-skills](https://github.com/EL4CTEO/blender-skills)                                                 | A 4.x to 5.2 API-change table verified on 5.2.2; hard-surface stack Mirror, Boolean, Bevel, Weighted Normal; bevel width 0.5-2% of part size; cylinder sides by on-screen size.                                                                                                                                                                                 |
| [viettranx/3dviz-pro-max](https://github.com/viettranx/3dviz-pro-max)                                               | Playwright capture in the target renderer; refuses to report success without it.                                                                                                                                                                                                                                                                                |

**Google's cathedral demo** (Gemini 4 Argon driving Blender MCP, the video the OP
cited) ran 45 rounds comparing geometry against the reference. Each round took
four screenshots (three-quarter, close-up, low angle, wireframe), and an
adversarial critic had to name at least three flaws and score out of 10 until it
gave 9 or more. The OP found it needed two to three times Claude's iterations.

**What the evidence says about loops:**

- A May 2026 benchmark (3DCodeBench) found agent harnesses mostly fix whether a
  script runs, not whether the shape is right.
- Vision-model verifiers lean toward accepting.

So geometry quality has to come from numeric gates (IoU, width bands,
validators, budgets) and the reference loop. The critic is the wide net that
catches what numbers miss. It is never the only gate, and rounds are capped.

**Blender 5 traps that break bpy written from memory** (each verified on 5.2.2;
these become `blender-5-gotchas.md`):

- `use_auto_smooth` is gone; use Smooth by Angle.
- The EEVEE identifier changed and changed back.
- Principled sockets were renamed.
- `material.use_nodes` is deprecated.
- The `FAST` boolean solver became `FLOAT`.
- `smart_project` takes radians.
- The exporter's `export_apply` defaults to False, which silently drops Bevel,
  Weighted Normal and Solidify.
- On 5.2.2, `KHR_materials_volume` does not export through the glTF Material
  Output group, although the manual says it should. Thickness and attenuation
  stay in the game's material code, where the breakable recipe already sets
  them.

**CPU render policy:**

- Workbench for every geometry gate (about 1 s per sheet).
- Cycles at low samples only for glass and material checks; EEVEE rendered the
  glass black on CPU.
- The final look check always in three.js itself, through headless Chromium,
  because Cycles glass is not three.js transmission.

## 6. Generators: Meshy and the alternatives, checked against their own docs

Full notes with every source:
[`generators-research.md`](../../art/glass-adventure/proofs/modeling-audit-2026-10-21/generators-research.md).

**Meshy is the wrong tool for this museum's core, by its own documentation:**

- Its help pages say highly transparent or reflective objects (glass, mirrors)
  "are difficult to reconstruct — use opaque references instead".
- `symmetry_mode` was deprecated in May and "no longer affects output", so there
  is no lever left for a lathe-true vase.
- No endpoint outputs transmission, IOR or volume, only metallic, roughness and
  normal. The glass is always ours to build.
- Its own Meshy 7 benchmark names surface detail as the weakest metric and shows
  identical repeats drifting.
- `model_type: lowpoly` retires on 2026-10-30, and API assets are kept for three
  days only.

**What the alternatives offer, in brief:**

| Generator (latest)              | Good for us?                                                                                                                                          |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tripo H3.1 / P2 (preview)       | Best low-poly controls (smart low-poly 500-20k, P2 native quads to 25k), de-light option. Glass is a listed weak spot. Paid plans for commercial use. |
| Meshy 7.1 + Smart Topology t2.5 | Fine as a dense bake source for organic parts; multi-image input helps. Not for symmetric, glass or architectural pieces.                             |
| TRELLIS.2-4B (local)            | MIT, but its `nvdiffrast` dependency is non-commercial; ComfyUI's native port avoids it. Needs a 24 GB GPU. Output is about 1M faces, a bake source.  |
| Hunyuan3D 2.1 open / 3.x hosted | Open-weight licence "does not apply in the European Union, United Kingdom and South Korea" and caps MAU. Check where the game is distributed first.   |
| Rodin Gen-2.5                   | Quad presets 4K-50K; API access needs the Business plan.                                                                                              |
| SAM 3D Objects, SPAR3D          | Reconstruction from photos, placeholder quality. Not for clean props.                                                                                 |

No independent benchmark of manifoldness, self-intersection or UV quality
exists for any of them, and practitioners converge on the same rule: the
generator is a replaceable supplier and "Blender is the geometry truth". A
benchmark of Blender code written by models (3DCodeBench, May 2026) found most
failures were API mismatches, which is why the skill ships a tested `bkit`
library and a Blender 5 gotchas page instead of asking the agent to write raw
`bpy` from memory each time.

**Decision rule** (how the skill chooses):

- **Procedural** when the shape is a profile, sweep, extrusion, symmetry or
  repetition, must snap to a kit grid, needs a physical volume (glass thickness,
  fracture), or must match a set. That is vessels, columns, arches, frames,
  plinths, platforms and every shard set.
- **Generator as a bake source** when the shape is irregular or organic and
  likeness matters more than exact dimensions: plant clusters, acanthus,
  reliefs, finials. Generate each component on its own from evenly lit, opaque,
  multi-view references, then weld, retopologise or rebuild our own low-poly,
  bake normal and AO onto it, de-light the colour, and validate.
- **Never** ship a provider remesh, and never fracture an uncleaned generated
  mesh: Blender's boolean solvers only guarantee results on manifold input.

**What this means for glass in the game** (three.js r185, from its source):

- Transmission costs one extra render of the background and all opaque objects
  per camera whenever any glass is visible, at `transmissionResolutionScale`
  (lower it to 0.5 on phones).
- Glass never sees other glass through itself, so gallery sightlines should not
  stack vessels behind vessels.
- On devices with `WEBGL_multisampled_render_to_texture`, three.js skips the
  back-face step for double-sided glass, so double-sided glass needs a device
  check in the Android WebView and WKWebView.
- Geometry rules that follow: real inner and outer walls, a rolled lip (the
  bright rim highlight is what reads as glass), smooth normals, 48-64 radial
  segments for hero silhouettes and 24-32 for small or distant ones, no normal
  maps on clear glass, a separate material for fracture faces.
- Blender 5.2's exporter writes `KHR_materials_transmission` and
  `KHR_materials_ior` straight from Principled BSDF (verified on the spike's
  GLB). The manual's route for `KHR_materials_volume` (Volume Absorption plus
  the glTF Material Output group) did not export on 5.2.2 (section 5), so
  thickness and tint stay in runtime material code.

**Delivery** (the runtime already decodes `EXT_meshopt_compression`):

- `gltf-transform optimize` joins named meshes by default and would merge 16
  shards into one. Breakables need `--join false --flatten false --palette false
--simplify false`, or `gltfpack -kn -km`.
- Lathe LODs come from lowering the revolve steps (64, 32, 16), not from
  decimation, which keeps symmetry and UVs.
- Khronos `gltf-validator` (npm) checks transmission, volume, IOR, dispersion and
  iridescence; it runs on every export.

## 7. The skill

**Name:** `blender-modeler`, in `.claude/skills/blender-modeler/` (Claude Code),
with a short pointer copy in `.agents/skills/` for Codex. It becomes the entry
point for any "model, remake, fix, review or export a 3D asset" request, the way
`motion-designer` is for video. `game-asset-production` folds into its
references (its audit checklist and receipt rules survive; its trigger moves
here) so two skills do not compete for the same requests.

```
.claude/skills/blender-modeler/
  SKILL.md                      pipeline and non-negotiables (under 300 lines)
  ASSET-BRIEF.md                template: role, why each part exists, cameras, size, budget, references
  references/
    craft-rules.md              the rules that make assets look made by an artist
    recipes/                    lathe-vessel, swept-handle, lobed-and-fluted-body, classical-column,
                                arch-and-arcade, mouldings-and-plinths, frames, platforms, fracture
    materials-glass.md          glass, gold, marble that export to glTF and read well in three.js
    generators.md               when and how to use Meshy / TRELLIS / Tripo, and the bake path
    qa.md                       contact sheet modes, silhouette IoU, part-ID and measurement renders, budgets
    blender-5-gotchas.md        API changes that break bpy written from memory
    house-rules.md              Glassworks contract: units, axes, origins, node names, budgets, LFS, receipts
    lessons.md                  the skill's own mistakes log
  scripts/
    preflight.sh                find or fetch Blender 5.2.2, install EGL in cloud containers, smoke render
    bkit/                       tested bpy library: profiles, lathe, sweep, bevel, arrays, mouldings,
                                fracture, materials, export, validate
    render_views.py, compose_sheet.py   the contact sheet used in this audit
    silhouette.py               ortho mask vs reference mask: IoU, overlay
    measure.py                  part-ID false colour + dimension callouts (the OP's "dots and measurements")
    edges.py                    flags perfectly sharp edges that have no bevel
    runtime_proof.mjs           Playwright screenshots of the GLB in the game's own renderer
  examples/                     worked examples with every round's sheets and critic reports
.claude/agents/model-critic.md  fresh, independent critic; SHIP or ONE MORE PASS
```

### Pipeline

0. **Preflight.** Blender 5.2.2 LTS found or fetched; one smoke render in
   Workbench and one in Cycles (EEVEE is skipped on CPU). In cloud containers
   Workbench needs `libegl1 libegl-mesa0`.
1. **Brief.** Fill `ASSET-BRIEF.md`: what the object is for, why each part
   exists, gameplay and inspection camera distances, size in metres next to
   Merc, triangle and texture budget, breakable or not, the features that must
   survive, and the references.
2. **References.** Concept and real-world references; an orthographic front and
   side; 8-15 key proportions measured into the brief, with anything not
   measurable listed as INFERRED. Every constant in a build script cites its
   source view or says `# inferred`. No guessing: look up how the real object is
   built (classical orders, blown-glass rims and feet). One master `.blend` per
   asset with REF, HIGH, LOW, COLLISION and EXPORT collections, references as
   image planes at real scale.
3. **Blockout.** Correct dimensions and collider envelope, checked in the game's
   camera. Gate: silhouette IoU at least 0.85 against the reference, with a
   10-band width profile, plus a world-registered IoU that catches wrong scale.
   Nothing gets detail until its silhouette passes.
4. **Form.** Recipes plus craft rules. Gate: IoU at least 0.90, width bands within
   3%, every numeric validator green. Then a critic round.
5. **Detail and materials.** Trims and ornament as geometry where they change the
   silhouette, as a normal map baked from our own high-poly where they do not.
   Glass, gold and marble presets that survive glTF export. Critic round.
6. **Fracture** for breakables: Voronoi cells from the final closed shell, interior
   material, shard checks. The repo's `v3/fracture.py` and `v3/solid_fracture.py`
   (Voronoi cells intersected with the `manifold3d` library) are reusable; a clean
   procedural shell removes most of the repair work they had to do.
7. **Export and validate.** glTF settings, the node-name contract
   (`<asset>_intact`, `<asset>_shard_###`), Khronos validator, budgets, reimport.
8. **Runtime proof.** The GLB in the game's renderer (HDR environment, tone
   mapping, glass policy), phone and desktop, gameplay and inspection cameras.
   Final critic round on these screenshots.
9. **Ledger.** One `LEDGER.md` row per round; craft lessons into `lessons.md`,
   repo lessons into `docs/agent/MISTAKES.md`. Receipts stay small: source
   script, Blender version, export hash.

### Craft rules (the core of `craft-rules.md`)

1. **No perfectly cut edges.** Every edge is bevelled or rounded to a size that
   suits the material and the camera distance; glass rims are rolled.
2. **Units are metres and sizes come from the brief.** Check scale against Merc.
3. **Why before what.** Each part's function decides its form: a foot for
   stability, a rolled lip for strength, handle thickness for the load.
4. **Silhouette first, from splines.** Profiles are curves sampled by curvature,
   never a hand-typed polyline. Fit the front and side to the reference.
5. **Radial is exactly radial, repeats are exact.** Model one sector or one
   motif, then spin or instance it.
6. **Thickness is real.** Walls offset along the surface normal; bases heavier;
   glass refracts only through real thickness.
7. **Joins are designed.** Handles flare into the body; nothing pierces a
   transparent wall where it can be seen; fillets where parts meet.
8. **Flat is flat.** Planes are planar; mouldings are swept profiles.
9. **Topology serves shading.** Even quads on curved surfaces, density where the
   silhouette bends, no slivers; triangles go where the silhouette needs them.
10. **Ornament earns geometry only if it changes the silhouette** at gameplay
    distance; otherwise it is a normal map baked from geometry we own.
11. **No lighting in albedo.** Physically plausible IOR, metalness and roughness.
12. **Every build is a script.** Re-runnable, deterministic, named parts,
    applied transforms, origin at the contact point.
13. **Perfect is not the same as good.** Agent-built geometry drifts toward a
    sterile "CAD look" (practitioners' phrase). Break it up where the real
    object would: roughness variation, marble veining, slight wear on stone
    edges, seeds and cords in glass, never lumps in the form.

### Critic loop

Copied from `motion-designer`, which already works in this repo: the builder
never judges its own work. After blockout, form, detail and runtime proof, spawn
a **new** `model-critic` with only paths (GLB, brief, references, budget, report
path, previous report). It renders its own sheets (including one at gameplay
pixel size, about 128 px), measures IoU, budgets and sharp edges, names at least
three flaws, and returns ranked problems ending in SHIP or ONE MORE PASS.

- Numeric gates decide first; a critic's SHIP never overrides a failing gate.
  Model critics lean toward accepting, so they are the wide net, not the judge.
- Every finding is reference, candidate, difference, and an executable fix with
  units ("lip radius 4 mm to 6 mm"), never "make it nicer".
- After two non-improving attempts on one issue, switch method.
- When a failure exposes a gap in the skill, patch `craft-rules.md` or
  `lessons.md` first, then repair the asset, so the next asset does not repeat
  it. That is the OP's mistakes log, made durable.
- Six ONE MORE PASS rounds in a row means stop and report the blocker.

### Quality bar (measured, per asset)

- Silhouette IoU against the orthographic reference at least 0.90, front and
  side, with the 10-band width profile within 3%, where a reference exists.
- Zebra stripes continuous on every smooth surface; uniform on every plane
  (critic judgement on the sheet).
- No unbevelled edge sharper than 30 degrees, except deliberate, listed ones.
- Budgets (starting values, to confirm on the owner's tablet): hero vessel at
  most 8k tris intact and 4k for small or background ones, shard set at most
  1.6x intact, column or arch module 2-6k with a normal-mapped capital, frame
  under 2k, platform under 3k, one material per surface family, textures 1K
  mobile and 2K desktop. Scene target about 150-300k tris and 60-100 draws.
- Closed manifold shells for breakables; Khronos glTF validator 0 errors.
- Runtime proof screenshots at gameplay and inspection distance on a phone
  viewport and desktop.
- Critic verdict SHIP. Taste stays with the owner.

## 8. Examples to build after approval

1. **Opaline Echo Amphora** (replaces `adventure-v6/opaline-echo-amphora-qa-v2`):
   the spike taken to finish. Fitted to the concept's proportions, opal glass
   with iridescence, jade handles, champagne-gold bands, the embossed wave band
   as a baked normal, 16 Voronoi shards, runtime proof.
2. **Amber Cadence Urn** (replaces `amber-cadence-urn-qa-v2`): lobes as a radial
   function confined to the body band with smooth falloff (the right way to do
   what v1's flute ripple did wrong), gold collar with instanced bead-and-reel
   and a cabochon, actual amber glass instead of the current opaque body.
3. **Column and arcade bay** (replaces `gilded-column` and `garden-arcade`):
   entasis, 24 flutes with fillets, Attic base, archivolt and cornice as swept
   mouldings, planar walls, a modular grid that matches the colliders. The
   shipped column is Corinthian. Keeping it Corinthian demonstrates the mixed
   route: a procedural bell and abacus, with acanthus from a generator baked
   onto them as normal and AO. Switching to Ionic keeps it fully procedural
   (volutes as spiral sweeps).

Each example ships its brief, build script, every round's sheet and critic
report, and the final GLB beside the one it replaces, so the owner judges
before anything is swapped in the game.

## 9. Order of work

1. Skill skeleton, `bkit` library and QA scripts, with tests that run headless.
2. Example 1 end to end, including runtime proof. Owner review.
3. Examples 2 and 3. Owner review.
4. Swap accepted assets into the game in separate, reviewable commits.
5. Fold `game-asset-production` into the new skill; update `AGENTS.md`'s skill
   list.

## 10. Decisions for the owner

- **Go / no-go** on procedural-first, generators only as bake sources for
  organic pieces.
- **Meshy subscription:** keep it for organic hero pieces, or drop it.
- **Concept images** are Git LFS objects. The examples need about three of them
  (`git lfs pull --include` on just those files, a few MB of LFS bandwidth).
- **Effort:** the skill would spawn its builder and critic at high effort, as the
  thread recommends. That costs more tokens per asset.
- **Merge or keep** `game-asset-production` alongside the new skill.
- **Corinthian or Ionic** for the column example (section 8).
