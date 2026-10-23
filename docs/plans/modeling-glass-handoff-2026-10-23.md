# Handoff: the Blender modelling skill, two vessel rebuilds and the glass look plan

**Date:** 2026-10-23 · **Branches:** `feat/blender-modeler-skill` (draft PR
#1174, green) and `feat/glass-look-system`, stacked on it · **Status:** the
owner approved the glass look plan's four decisions; Phase 0 is next, at
maximum quality settings.

## Where things are

| What                                  | Where                                                                                                                                                                       |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The modelling plan and its audit      | [`blender-modeler-skill-2026-10-21.md`](blender-modeler-skill-2026-10-21.md), [`modeling-audit-2026-10-21/`](../../art/glass-adventure/proofs/modeling-audit-2026-10-21/)   |
| The glass look plan and its research  | [`glass-look-system-2026-10-23.md`](glass-look-system-2026-10-23.md), [`glass-look-research-2026-10-23/`](../../art/glass-adventure/proofs/glass-look-research-2026-10-23/) |
| The skill and its critic              | [`.claude/skills/blender-modeler/`](../../.claude/skills/blender-modeler/SKILL.md), [`.claude/agents/model-critic.md`](../../.claude/agents/model-critic.md)                |
| Every mistake a gate or critic caught | [`references/lessons.md`](../../.claude/skills/blender-modeler/references/lessons.md)                                                                                       |
| The two rebuilds                      | [`art/glass-adventure/procedural/`](../../art/glass-adventure/procedural/): `build.py`, `BRIEF.md`, `LEDGER.md`, `rounds/` per vessel                                       |
| Meshy against procedural              | [`meshy-vs-procedural.md`](../../art/glass-adventure/proofs/modeling-audit-2026-10-21/meshy-vs-procedural.md)                                                               |
| Side-by-side page (private)           | https://claude.ai/artifact/AbDqDNiEQJ89CqxWbsRhSv                                                                                                                           |
| Everything not in git                 | `session-archive-2026-10-23.zip`, sent to the owner (see below)                                                                                                             |

The rebuilt GLBs are **not** in git; builds are reproducible from `build.py`
with Blender 5.2.2. The final candidates (urn `u25`, amphora `v31`) and their
`.blend` files are in the archive. Neither has replaced a shipped file.

## What happened

1. **Research and audit.** 18 of the 23 shipped museum GLBs are lathe or
   radial glassware, architecture, plinths, frames and platforms, which a
   parametric build beats. The verdict: model the museum
   procedurally in Blender, and use Meshy only for organic pieces.
2. **The skill.** `bkit` (profile, lathe, sweep, trims, materials, textures,
   fracture, validate, scene, export, colour) with 28 headless tests, gates
   (contract, Khronos validator, silhouette, budgets, show-through, cavity
   intrusion), a fresh critic per stage, and `runtime_proof.mjs`, which serves a
   candidate inside the real game.
3. **Two rebuilds.** Both beat their Meshy files on outline, triangles and file
   size, at about half the bytes:
   - **Amphora:** IoU 0.976 against Meshy's 0.948. It stopped after round 7
     because the opal reads darker than the wall behind it.
   - **Urn:** IoU 0.990 against 0.930. It stopped after round 6 because the
     amber reads as butterscotch.
4. **The glass research.** The cause is the game's light and renderer, not the
   vessels. three r185 transmission shows a darkened copy of the wall, every
   room shares one light rig and one probe, and ACES bends the palette.
5. **The glass look plan.** One look library bound by material name, a
   look-development bench, three gates (shape, look, context), amber first and
   vessel work frozen until then.

## The owner's decisions so far

- Amber first. Vessel modelling and per-vessel material work stay frozen until
  amber passes checkpoint 2 of the glass look plan.
- Amber, opal and frosted glass may carry their own light (the `studio` look)
  if the bench shows they read better that way.
- A Neutral tone-mapping trial on the bench and in one room. The
  renderer-wide switch is decided at checkpoint 2.
- The owner runs the phone test in Phase 2, on a mid-range Android phone and an
  iPhone.
- **Quality settings at maximum for now.** Performance is measured and
  optimised later.
- Swapping a shipped GLB stays the owner's call, in its own commit with its
  manifest receipt.

## Lessons learned

The full list is in the skill's `lessons.md`. The ones that cost the most:

### Glass and the renderer

- **Per-vessel material tuning cannot add light the scene does not have.**
  three r185 transmission replaces the diffuse term with a blurred copy of the
  opaque scene behind the glass, and no light passes through. Six and seven
  critic rounds of tuning proved it.
- **Judge glass only in the production render path**
  ([`MISTAKES.md`](../agent/MISTAKES.md), "judge glass in its production render
  path"). The skill's `three_preview.mjs` has neither the reflection probe nor
  the emissive override.
- **The game quietly changes glass.**
  - It overwrites emissive on every transmissive material
    ([`vessels.ts:653-659`](../../packages/glass-game/src/render/vessels.ts)).
  - r185 ignores `envMapIntensity` unless the material has its own `envMap`.
  - ACES at exposure 0.9 strips most of the colour from pastel glass.
- **Comparing in-game colour with a painted concept mixes shape, material and
  light.** Keep three separate gates, as the glass look plan does.

### Modelling with bkit

- **Push lathe lobes in a fixed direction.** A push along a corner's normal
  lifted the floor into 16 self-intersections.
- **Space rings by how far the outline turns** (`profile.resample_by_turn`),
  not evenly.
- **Clean needle triangles to a fixed point** before fracture, or shards carry
  zero-area faces.
- **Fracture must group pieces by the shard gate's own touching rule, and turn
  inside-out pieces the right way.** One inverted piece silently dropped 656
  cm³ of glass with every gate green.
- **Blender 5.2's glTF exporter has three traps.** It drops volume and thickness
  maps unless a `glTF Material Output` group exists (build it with the
  exporter's own `create_settings_group`). It writes `tex_ccord`, so
  `gltf_finish.py` restores `thicknessTexture.texCoord`. And it flattens node
  groups.

### Process

- **A fresh critic per round works for shape, and loops on materials.** Both
  vessels hit the round limit on glass, and the limit stopped both loops.
- **Research agents mixed up the repo's two glass games**: the museum in
  `packages/glass-game` and the glass3d chamber game in
  `apps/beside-cue/src/games/glass3d`. Make one code audit the authority, and
  check every number against it.
- **A rate-limited agent resumes with a message.** Respawning it loses its
  context.

### Tools and the cloud container

- **`runtime_proof.mjs` runs one dev server per port, guarded by a lock.**
  Never `pgrep` or `pkill` by pattern, because the pattern matches the command
  itself. Kill by PID.
- **Before a runtime proof,** assert the served asset tier and run
  `git lfs pull` first. SwiftShader stalls on transmission targets.
- **CI's "Validate changed files" runs prettier on every changed file,
  Markdown included.** Run
  `PR_PREPARE_BASE=$(git merge-base HEAD origin/main) pnpm run pr:validate`
  before pushing.
- **Artifact pages do not serve `.glb`.** Ship models as base64 `.js` payloads,
  load three from jsDelivr, and set `window.createImageBitmap = undefined` so
  GLTFLoader decodes embedded textures through `<img>`.
- **The container is temporary.** The scratchpad and everything outside the
  repo is lost when it is reclaimed. Blender 5.2.2 sits in
  `/root/.cache/blender-modeler/` (1.2 GB) and the skill's preflight downloads
  it again.

## The session archive

`session-archive-2026-10-23.zip` holds what git does not:

| Folder             | Contents                                                                                                            |
| ------------------ | ------------------------------------------------------------------------------------------------------------------- |
| `final-builds/`    | Urn `u25` and amphora `v31`: GLB, `.blend`, sheets, silhouette mask, validator and pipeline receipts, runtime shots |
| `critic-evidence/` | The last round of each vessel (urn r6, amphora r7), images as JPEG                                                  |
| `spike/`           | The first procedural amphora spike: scripts, GLBs, renders                                                          |
| `comparison-page/` | The side-by-side page's HTML and game shots                                                                         |
| `research/`        | The original research notes of both research rounds, the source Reddit thread and its media                         |
| `proofs/`          | Baseline runtime shots of the shipped files, Meshy silhouettes, comparison screenshots                              |
| `tools/`           | Scratch scripts: critic probes, GLB inspectors, tone-mapping port                                                   |

`session-transcript-2026-10-23.zip` holds the full session transcript (JSONL),
for looking up a detail later.

To serve an archived build in the game:

```sh
node .claude/skills/blender-modeler/scripts/runtime_proof.mjs \
  --config art/glass-adventure/procedural/amber-cadence-urn/proof.json \
  --candidate <archive>/final-builds/amber-cadence-urn-u25/amber-cadence-urn.glb
```

## Next

Phase 0 of the glass look plan, on `feat/glass-look-system`, at maximum
quality settings:

- the bench page, its capture script and metrics;
- `GlassMaterial` with the `studio` technique;
- the studio environments and resident lights;
- the stress glow stops overwriting authored emissive;
- glass stops casting opaque shadows.

Checkpoint 0 is the bench sheet with today's materials under four environments.
