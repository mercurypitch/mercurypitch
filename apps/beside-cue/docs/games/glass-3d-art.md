# The 3D art pipeline — Blender on this PC, and the art direction

Companion to [glass-3d.md](./glass-3d.md). That document decides the
engine; this one decides how the things it renders get made, on this
actual machine, and what they should look like. Everything in §1 was
probed on the PC rather than assumed, so the task list starts from what
is true, not from a generic install guide.

Two decisions from maff shape all of it: **the glass is a Blender asset
from the start** (the Cabinet exists to prove the pipeline, so the
pipeline is what gets proven), and **Merc is a real 3D model**, not a
billboard.

---

## 0. The task list

Executed one at a time, in order, each verified before the next begins.
T5 is the only one that needs maff at the keyboard; T2 needs his pick.

| #   | Task                                                                   | State                      |
| --- | ---------------------------------------------------------------------- | -------------------------- |
| T1  | Blender ≥ 5.2 LTS, glTF exporter, Meshy MCP — all verified             | **done** — found on the PC |
| T2  | Merc concept round: 5–6 renditions via Meshy nano-banana, maff picks   | next                       |
| T3  | Install + enable the Cell Fracture extension                           |                            |
| T4  | Repo scaffolding: `art/` (+ copied references), gltf-transform, script |                            |
| T5  | Connect the Blender MCP bridge (maff starts Blender once)              | needs maff                 |
| T6  | Model the intact glass and the plinth, save the `.blend`               |                            |
| T7  | Fracture it: ~150 shards, cleaned, named, origins at centroids         |                            |
| T8  | Export both `.glb`s, run the optimize pipeline, check the budgets      |                            |
| T9  | Pipeline test in vitest: parse the `.glb`, assert the contract         |                            |
| T10 | Merc base model: Meshy `image_to_3d` from the chosen concept           | after T2's pick            |
| T11 | Merc finish: Blender cleanup, rig, the animation set, export           |                            |

Concepts run first (maff's call, and the right one): they need no
Blender, they decide what everything downstream looks like, and they
double as lighting studies for the Cabinet. The glass itself stays
Blender-modelled — a wine glass is a lathe profile, and precision
there beats generation. T6 and T7 run through the MCP bridge: the
modelling is `bpy` code I write and Blender executes, so the glass is
reproducible from its script, not only from its saved file.

---

## 1. The toolchain on this PC — found state, and the gaps

Probed 2026-09-01:

| Thing                   | State                                                                                                                    |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Blender                 | **5.2.0 LTS**, pacman `extra/blender 17:5.2.0-4` — the exact version the research targeted (first with meshopt export)   |
| glTF exporter           | `io_scene_gltf2` present and **enabled**                                                                                 |
| Blender MCP bridge      | `bl_ext.lab_blender_org.mcp` installed and **enabled** — this session can drive Blender directly once Blender is running |
| Cell Fracture           | **missing** — moved to the Extensions platform in 4.2+; this is T3                                                       |
| `@gltf-transform/cli`   | not a dependency yet — T4                                                                                                |
| `art/` source directory | does not exist — T4                                                                                                      |
| `.blend` git handling   | nothing in `.gitattributes` yet — T4                                                                                     |
| Meshy MCP               | **connected** — balance 3,140 credits; costs are confirmed with maff before every paid call                              |
| Proton Pass CLI         | `/usr/bin/pass-cli` present, if a key ever needs piping — none does today                                                |
| KTX-Software (`ktx`)    | not installed, **deliberately** — the plan skips KTX2 until the texture count justifies a 585 KB transcoder              |

**T3 — Cell Fracture.** Install from the Blender Extensions platform
(`blender --command extension install` headless, or the UI once), then
verify headlessly the same way the probe above ran: `blender -b
--python-expr` listing `addon_utils.modules()`.

**T4 — repo scaffolding.**

- `apps/beside-cue/art/` holds `.blend` sources plus a README stating
  the one rule: **the `.glb` in `public/models/` is generated, never
  hand-edited; the `.blend` and the export settings are the source.**
- `.gitattributes`: `*.blend binary -diff`. No LFS yet — a wine glass
  `.blend` is well under a megabyte; revisit only if a file crosses
  ~10 MB.
- `@gltf-transform/cli` as a devDependency, and a
  `pnpm --filter beside-cue-app assets:glass` script running the
  explicit passes (never bare `optimize` — its defaults join named
  meshes and simplify, both fatal here):
  `dedup → prune → weld → meshopt`. Output committed, so CI needs no
  sharp/ktx.

**T5 — the bridge ritual.** maff starts Blender (a plain launch; the
add-on autoconnects), and I verify with a scene summary call. From then
on the modelling is conversational: I write `bpy`, Blender executes it,
screenshots come back through the bridge when needed. The `.blend` is
saved into `art/`, and the generating script into `art/scripts/`, so
the asset can always be rebuilt from code.

---

## 2. Art direction

### 2.1 The pillars

1. **Priceless vs. clumsy.** The glass world is a museum: dark, calm,
   one perfect object in a spotlight. Merc is the comedy walking
   through it. The tension between those two registers _is_ the brand
   tone (comedic Merc, glass-brand touches — locked in the research
   decisions), and every look decision should widen it, not blur it.
2. **The voice is the light.** Nothing in the scene animates unless the
   player's voice moves it — the idle scene is genuinely still, which
   is also the thermal budget rule from glass-3d.md §5.4 wearing an
   artistic hat.
3. **Brand colour lives in the light, not the objects.** The glass is
   colourless; the room is near-black. Warmth, turquoise and violet
   arrive only as light: the spotlight, the glints, the score card.

### 2.2 The palette, mapped to the scene

From the app's existing tokens (`styles.css`):

| Token                   | Value           | Where it appears in 3D                                                              |
| ----------------------- | --------------- | ----------------------------------------------------------------------------------- |
| `--ink` `#241913`       | warm near-black | the void — **not** pure black; ink-tinted darkness reads richer and matches the app |
| `--custard` `#f2c84b`   | warm yellow     | the spotlight's colour, desaturated toward warm white                               |
| `--turquoise` `#00777d` | teal            | glint accents in the env map; the resonance ring UI                                 |
| `--violet` `#6a56c9`    | violet          | the vibrato pump's glow — the "now wave it" state                                   |
| `--orange` `#c93513`    | brand orange    | reserved for Merc and the score card; never on glass                                |
| `--paper` `#fff5dd`     | warm white      | UI text over the void                                                               |

### 2.3 The Cabinet frame

Fixed cinematic stage (decided): camera slightly below the glass's
equator looking up a few degrees — the museum-case angle that makes any
object read as precious. Glass centred on the vertical thirds line,
plinth base in the lower third, generous negative space above for the
share-card overlay. The spotlight is the only key light; the procedural
`RoomEnvironment` (tinted toward ink + custard) supplies reflections at
zero asset cost. Dust motes in the beam are permitted **only during**
resonance — pillar 2.

### 2.4 What the glass is

A classic tulip wine glass — near-universal silhouette, thin bowl (the
thing that plausibly shatters), and a strong dark-background outline.
Colourless, faint cool tint in the volume absorption only. The plinth
is matte ink-dark stone, so the glass is the only thing in the frame
that answers light.

---

## 3. The wine glass — asset spec

The contract between Blender and the engine, written down before either
side is built.

**Geometry.** A lathe (surface of revolution) from a hand-drawn
profile: bowl, stem, foot. Real proportions — ~220 mm tall, bowl
~90 mm diameter, stem ~4 mm — modelled at real scale (1 BU = 1 m, so
0.22 tall). Intact glass 3,000–6,000 tris (budget from glass-3d.md
§6.3). Bowl walls get actual thickness (a solidify of ~1.2 mm): the
volume/refraction extensions need a manifold mesh, and the shards need
two surfaces to exist.

**Material** (per glass-3d.md §6.1, the exact node rules):

- Principled BSDF: Transmission 1.0, Roughness 0.04, Base Color white,
  IOR 1.5 (omitted at export as the glTF default — correct).
- Volume Absorption node → Material Output's Volume socket: colour a
  whisper of turquoise, density low → `KHR_materials_volume`
  attenuation.
- Thickness (uniform, no texture) via the `glTF Material Output` group
  node.
- Blend mode **Opaque** — transmission is not alpha.

**Fracture (T6).** Cell Fracture on the bowl + upper stem only — the
foot survives the break and stays on the plinth, which sells the story
("the glass broke", not "the glass vanished"). Target ~150 shards,
recursion 0, then a cleanup pass merging slivers under ~2 mm so no
shard is degenerate. Total shard budget ≤ 25,000 tris.

**Naming and origins — the load-time contract:**

- Intact glass: one mesh, `glass_intact`. Foot: `glass_foot`.
- Shards: `shard_000` … `shard_149`, one collection `shards`, **each
  shard's object origin set to its own centroid** before export.

That last rule is what wires the asset to the already-merged simulation:
`solveShatter(centroids, …)` in `sim/shatter3d.ts` takes each shard's
centroid, and with origins set this way the loader reads them straight
off the node translations — no bespoke exporter, no geometry pass.

**Export settings** (both `.glb`s — `glass-intact.glb`,
`glass-shards.glb`): +Y Up, Apply Modifiers, UVs and Normals on,
Tangents **off** (no normal maps), Shared Accessor on, Blender's own
compression **off** — compression happens post-hoc in gltf-transform,
where the pass order is controllable.

**Budget gates (T7/T8, enforced in CI):** shards `.glb` ≤ 70 KB gzipped
after meshopt (plan §6.3 says 40–70 KB); shard count exactly 150; every
name matches the contract. The T8 vitest parses the file with
`@gltf-transform/core` — the art pipeline gets a regression test that
runs without a GPU.

---

## 4. Merc in three dimensions

Decided: a real model. The 2D reference set already in the repo is the
canon — `public/games/merc.webp` (2048² hero) and
`public/games/journey/merc-{idle,singing,listening,celebrate}.webp`.

The wider reference corpus lives in the disjoint-colliders repo's
`packages/showcase-gallery/gallery-viewer/`: `quicksilver-merc-states`,
`quicksilver-merc-still-threequarter`, `merc_lumen_states_trans`,
`merc_vector_states` — earlier renditions that never settled into one
3D direction. That is exactly what T2 resolves.

**T2 — concepts before any modelling** (maff's directive). Meshy's
nano-banana image models take a reference image plus a prompt, so each
concept is generated FROM the existing Merc art rather than from a
description of it — the character stays himself across every
rendition. Each concept is staged in the Cabinet itself (ink void,
custard spotlight, wine glass on a plinth beside him) so one image
answers two questions: does this Merc fit, and does this room work.
maff picks; the pick becomes the input to T10.

**T10 — the base model comes from Meshy, not from a blank viewport.**
`image_to_3d` on the chosen concept (plus the three-quarter reference)
produces the sculpt and texture; Blender's job shrinks to what
generation is bad at — cleanup to budget, a proper deform rig, and the
animation set. Meshy's own `rig` ships walk and run for free and its
`animate` covers stock motions, worth taking where they fit — but the
brand beats (`sing`, `listen`, `celebrate`, the comedic `fall`) are
authored in Blender, because a stock library does not know who Merc
is. Export then follows §6.1's rules exactly (NLA-stashed actions,
sampled, deform-only, 4 influences).

**Budget and rig.** 8,000–15,000 tris — comfortably inside the scene
budget once the room is a void. Simple mascot rig: spine, head, arms,
legs, a squash-and-stretch root; **4 bone influences** (the exporter
warning is explicit), deform bones only, actions stashed to NLA tracks,
sampled export — all per glass-3d.md §6.1.

**Animation set v1**, mirroring the 2D poses so the character stays
himself: `idle`, `walk`, `jump`, `land`, `sing`, `listen`, `celebrate`,
and `fall` — the comedic fall is a locked brand beat, not a nice-to-
have. Loops start at frame 0 (exporter option exists for exactly this).

**Order.** Merc is parallel work: the Cabinet (slice 0) contains no
character, and the slice-1 controller is body-agnostic — a capsule
proves the mechanics while the rig is finished.

---

## 5. Generated concept art (T2) — the round that starts everything

Decided by maff: renditions first, "so we see what fits, for our 3D
space", before any modelling and before Blender is involved. The
generator is Meshy's nano-banana image models (9 credits a frame on
the pro tier), fed the existing Merc art as the identity reference and
the §2 art direction as the stage. Five to six directions, one frame
each, every one a candidate answer to "what is Merc when he becomes an
object" — then a pick, and the pick drives T10. Credit costs are
stated and confirmed before each batch.

**Round 1 — run 2026-09-01, nano-banana-pro, 54 credits (approved).**
References for every frame: `apps/beside-cue/public/games/merc.webp` +
the quicksilver three-quarter still from showcase-gallery. All six
staged identically per §2: ink void, one warm spotlight from upper
left, colorless tulip glass on a matte dark plinth. Outputs in
`~/agent-out/mercurypitch/2026-09-01/`:

| #   | Direction                                                                         | File                          | Meshy task                             |
| --- | --------------------------------------------------------------------------------- | ----------------------------- | -------------------------------------- |
| 1   | Quicksilver toon — Rayman-style floating hands, liquid-mercury body, toon shading | `merc-1-quicksilver-toon.png` | `01a059e0-b521-76f8-842e-1b5484c19307` |
| 2   | Liquid chrome — mirror-polished droplet, room reflected in him                    | `merc-2-liquid-chrome.png`    | `01a059e0-c170-74a5-8660-143aef89e67a` |
| 3   | Vinyl designer toy — matte two-tone orange/ink, mold seams                        | `merc-3-vinyl-toy.png`        | `01a059e0-cea8-723f-b085-0a5c791abc5c` |
| 4   | Claymation — fingerprints, squash-and-stretch, miniature set                      | `merc-4-claymation.png`       | `01a059e0-dced-74d2-851d-b840886b5f1d` |
| 5   | Glassblown — translucent, faint orange tint, caustics on the plinth               | `merc-5-glassblown.png`       | `01a059e0-e777-7012-bd9f-e67534201519` |
| 6   | Low-poly gem — flat-shaded facets echoing the shards                              | `merc-6-lowpoly-gem.png`      | `01a059e0-f33e-77ff-9b57-6b64eda4086a` |

Pick pending — maff chooses the direction; the chosen frame becomes
the T10 `image_to_3d` input (worth pairing with the reference stills
via `multi_image_to_3d` if the pick keeps the current face).

---

## 6. Deliberately not now

- **KTX2 / Basis** — the scene has almost no textures; the transcoder
  outweighs them. Revisit at the point real texture sets appear (Merc
  may be that point).
- **Git LFS** — nothing approaches the size that needs it.
- **Rapier, texture painting, HDR captures** — all downstream of
  decisions not yet forced.
