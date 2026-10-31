# Fracture and shatter for pre-fractured glass vessels (three.js r185.1, WebGL2, phones and desktops)

Researched 2026-10-23. Source notes: "(search summary)" marks a claim taken from a search-engine digest whose page I did not fetch in full, so verify it before quoting. "(older)" marks a source from before 2020. Local repository sources are given as absolute file paths. They describe what the game does today.

## 1. Authoring: pre-fractured versus runtime fracture, shard-size distribution, and cut faces (interior faces, UVs, materials)

### Takeaway

Offline pre-fracture is the right fit for 16–18 shards on hollow vessels. three.js's runtime options either need convex input (ConvexObjectBreaker) or need manifold input and return a variable piece count (three-pinata), and both spend CPU on the impact frame. The glass-specific tools (Houdini RBD Material Fracture's glass mode, Chaos Radial, Modo and RayFire radial) all build radial-plus-concentric patterns outward from an impact point. The project's own `bkit.fracture`, by contrast, spreads seeds evenly by farthest-point sampling. That yields equal-sized "tiles", which read more like pottery than glass. The main authoring changes are to bias cell size toward an impact pole and to keep cut faces glossy.

### Cited Findings

#### Glass-specific pre-fracture tools

- Houdini RBD Material Fracture has a Glass material type with two modes. **Flat Panes** "is faster. It runs sequential Voronoi fractures for radial and concentric cracks, and edge noise is added after fracturing. This can leave visible cracks between pieces." **Curved Glass** "is slower. With edge noise on, boolean fracturing runs on high-res geometry, radial cracks first and then concentric. This avoids visible gaps." — [SideFX RBD Material Fracture](https://www.sidefx.com/docs/houdini/nodes/sop/rbdmaterialfracture.html)
- Houdini glass impact points come from **Use Scatter** (random surface points: Scatter Points, Scatter Seed) or **Use Input Points** (points from the fourth input, filtered by name). Cracks are set by **Radial Crack Number** (per impact point, with Number Variance), **Minimum Width** ("the spacing between concentric cracks moving outward", scalable by attribute), **Impact Spread** ("How far from the origin(s) the concentric cracks spread"), and **Discontinuity Freq/Size** (noise that breaks up the concentric rings). — [SideFX RBD Material Fracture](https://www.sidefx.com/docs/houdini/nodes/sop/rbdmaterialfracture.html)
- Houdini glass also has **Chipping** (Enable Chipping, Chipping Ratio, Corner Ratio, Corner Depth) and **Edge Noise** (with Fade From Origin, Fade From Border, Noise Amplitude, Noise Frequency). Its **Proxy Geometry** has Use Convex Decomposition and Max Concavity for simulation proxies. Its constraints carry separate **Radial Strength** and **Concentric Strength**. The page does not describe general density falloff with distance; Impact Spread and the two fade controls are the closest. Secondary fracturing is listed under Metal, not Glass. — [SideFX RBD Material Fracture](https://www.sidefx.com/docs/houdini/nodes/sop/rbdmaterialfracture.html)
- SideFX Labs has game-oriented helpers. **Labs Inside Face UVs** creates "UV's for inside faces of Voronoi fractured geometry". **Labs RBD Edge Strip** "generates polystrips on fractured geometry for extra destruction detail in game engines". **Labs Destruction Cleanup** prepares simulation results for export. **Debris Source** "generates point emission sources for debris from separated fractured rigid bodies". — [SideFX docs node index (same page, second chunk)](https://www.sidefx.com/docs/houdini/nodes/sop/rbdmaterialfracture.html)
- Unreal Chaos has a **Radial Fracture Tool**, used in an Aug 2026 UE 5.8.1 community tutorial for a bullet-hole fracture in glass. The author warns "this isn't the most efficient way to create Bullet holes in glass for an in-game F/X": decals or materials are typical in-game, and fracture suits cinematics, "especially once it's Cached". — [Epic forums community tutorial (John_CTS, 2026-08-17)](https://forums.unrealengine.com/t/community-tutorial-unreal-engine-5-8-1-chaos-destruction-for-beginners-realistic-fractures-bullet-holes/2744389)
- Chaos Geometry Collections have a Dataflow node that adds Outside/Inside Materials to outside/inside faces. It is deprecated in 5.6 in favour of an AssignMaterialToCollection node, and a collection handles at most 8 UV channels (search summary). — [UE GeometryCollectionNodes API](https://dev.epicgames.com/documentation/unreal-engine/API/Plugins/GeometryCollectionNodes?lang=en-US)
- RayFire for Unity's Shatter component pre-fractures in the editor with "regular voronoi, wood splinters, slabs, radial, slicing using planes and tetrahedral" patterns (2019, older; search summary). — [80.lv: RayFire for Unity available](https://80.lv/articles/rayfire-for-unity-available). The developer says an inner material can be set in Shatter, but the exact setting was cut off (search summary). — [Unity discussions RayFire thread](https://discussions.unity.com/t/released-rayfire-for-unity-runtime-demolition-and-fragmentation-plugin/742490)
- In Modo's Shatter, **Radial Rays** sets the number of radial divisions and **Radial Rings** the divisions along the rays, "similar to rings on a tree". A **Cutting Material** defines the interior surface of the shards, red by default (search summary). — [Foundry Modo: Shatter](https://learn.foundry.com/modo/content/help/pages/modeling/edit_geometry/shatter_geo.html)

#### Blender Cell Fracture and the project's own fracture

- The Blender 4.1 manual page for Cell Fracture is a stub ("Todo"), so its options are documented only in the add-on source. — [Blender 4.1 manual: Cell Fracture](https://docs.blender.org/manual/en/4.1/addons/object/cell_fracture.html)
- The Cell Fracture operator properties, from the source:
  - **Source**: Own Verts, Child Verts, Own Particles (default), Child Particles, Annotation Pencil.
  - **Source Limit** 100, **Noise** 0, **Scale** (a per-axis cell-shape scale).
  - **Recursion** 0, **Recursion Source Limit** 8, **Clamp Recursion** 250, **Random Factor** 0.25.
  - **Recurse Over**: Random, Small, Big, **Cursor Close** ("subdivide objects nearer the 3D cursor") and Cursor Far.
  - **Smooth Interior** off, **Sharp Edges** on, **Apply Split Edge** on, **Match Data** on, **Split Islands** on.
  - **Margin** 0.001 ("gaps between pieces for more stable physics").
  - **Material** index 0 for interior faces, **Interior VGroup** off, **Mass Mode** Volume or Uniform.
  - The operator file has no UV handling for interior faces.
  - — [blender-addons mirror: object_fracture_cell/**init**.py](https://raw.githubusercontent.com/blender/blender-addons/main/object_fracture_cell/__init__.py)
- The project does not use the add-on. `bkit.fracture` builds the cells in five steps:
  1. Take 3,000 area-weighted surface samples.
  2. Pick `count` seeds by farthest-point selection ("k well-spread seeds from dense samples").
  3. Build convex Voronoi cells by bisecting a padded box.
  4. Boolean-intersect each cell with every closed part, so the cut faces take each part's cut material.
  5. Drop pieces under 0.2 per cent of their own part's volume as chips.
  - — [.claude/skills/blender-modeler/scripts/bkit/fracture.py](../../../../.claude/skills/blender-modeler/scripts/bkit/fracture.py)
- The recipe calls `fracture.fracture(parts, 18, cut_materials=cut, seed=7, seed_on=parts, ...)`. It notes that "Glass breaks into a rougher cut glass, gold into gold, jade into jade". It seeds every part by area because "a heavy solid foot with no seeds becomes one shard holding 40 per cent of the mass". The contract gate checks that shards keep the intact volume within 3 per cent and that "no shard should be most of the vessel". — [.claude/skills/blender-modeler/references/recipes/fracture.md](../../../../.claude/skills/blender-modeler/references/recipes/fracture.md); [craft-rules.md](../../../../.claude/skills/blender-modeler/references/craft-rules.md)

#### Runtime fracture in three.js

- `ConvexObjectBreaker` (three.js addon) states its own requirements: "Mesh object must have a buffer geometry and a material", "Vertex normals must be planar (not smoothed)", and "The geometry must be convex (this is not checked in the library)". — [ConvexObjectBreaker.js (three.js dev)](https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/jsm/misc/ConvexObjectBreaker.js)
- How `subdivideByImpact` cuts:
  - The first plane passes through the impact point.
  - `maxRadialIterations` cuts are planes rotated about the impact normal (radial wedges), at a random 20–80 per cent of each angular sector.
  - `maxRandomIterations` cuts are semi-random planes through each piece.
  - A piece stops subdividing at random, with probability `numIterations * 0.05`.
  - Each piece is rebuilt with `ConvexGeometry` from points and reuses the parent's material. Its mass is half the parent's.
  - Piece count and shapes vary run to run.
  - — [ConvexObjectBreaker.js](https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/jsm/misc/ConvexObjectBreaker.js)
- three-pinata (Daniel Greenheck, MIT) offers runtime Voronoi fracture in full 3D or a faster 2.5D projection.
  - Options: `fragmentCount` (default 50), `seed`, and `impactPoint` plus `impactRadius` "to concentrate fragments".
  - Fragments get material group 0 (outer) and group 1 (new internal faces), with auto-generated internal UVs controlled by `textureScale` and `textureOffset`.
  - It needs manifold input. Non-convex meshes "may produce more fragments" than requested.
  - Its guidance: 10–50 fragments is optimal and 100+ may lag on slower devices. It recommends 2.5D mode, pre-fracturing hidden objects and despawning settled fragments.
  - The demo uses Rapier convex-hull colliders.
  - — [github.com/dgreenheck/three-pinata](https://github.com/dgreenheck/three-pinata). The current package is `@dgreenheck/three-pinata` 2.0.1 (2025-11-11). — [npm registry](https://registry.npmjs.org/@dgreenheck/three-pinata)
- Games use runtime slicing (Astro Bot, Rainbow Six Siege, Hardspace: Shipbreaker), but it is expensive and "only works on simple shapes". Runtime-sliced pieces are usually hidden "after some time to avoid clogging up your memory". — [GMTK, How Games Do Destruction (2025-10-02)](https://gmtk.substack.com/p/how-games-do-destruction)

#### Research: precomputed, impact-dependent fracture

- "Breaking Good: Fracture Modes for Realtime Destruction" (Sellán et al., SIGGRAPH Asia 2022 / ACM TOG) computes an object's lowest-energy "fracture modes". These "can be precomputed for a given shape to obtain a prefracture pattern that can substitute the state of the art for realtime applications at no runtime cost but significantly greater realism", and "any realtime impact can be projected onto our modes". — [Breaking Good project page](https://www.dgp.toronto.edu/projects/breaking-good/); [arXiv 2111.05249](https://arxiv.org/abs/2111.05249)
- A follow-up paper (DeepFracture, 2023) notes that Breaking Good changes fragment counts by regenerating patterns with different mode parameters, and that it is limited in representing crack propagation inside an object (search summary). — [arXiv 2310.13344](https://arxiv.org/html/2310.13344v2)

#### How real glass breaks (to guide shard distribution)

- Radial fractures run outward from the impact point and concentric fractures circle it. A peer-reviewed forensic paper states that radial cracks begin on the side opposite the force and concentric cracks on the same side. Radial cracks "will always end if they encounter an existing fracture line". Sources disagree on which forms first, and several are classroom-grade (search summary). — [Forensic glass analysis (Wikipedia)](https://en.wikipedia.org/wiki/Forensic_glass_analysis); [Egyptian Journal of Forensic Sciences (2017)](https://EJFS.springeropen.com/counter/pdf/10.1186/s41935-017-0019-5.pdf)
- Annealed glass, which is ordinary non-safety glass, breaks into large, sharp, irregular shards. Tempered glass "dices" into small, roughly cubical pieces. Heat-strengthened glass breaks much like annealed (manufacturer glossaries, search summary). — [Cardinal Glass glossary](https://cardinalcorp.com/glossary/annealed-glass); [AIS Glass](https://aisglass.com/blog/annealed-glass-vs-tempered-glass-key-differences-and-when-to-choose-each)

#### Interior faces: UVs and materials

- Every tool surveyed puts cut faces in their own material slot or group:
  - Cell Fracture: an interior material index. — [Cell Fracture source](https://raw.githubusercontent.com/blender/blender-addons/main/object_fracture_cell/__init__.py)
  - three-pinata: a group-1 inner material with auto UVs. — [three-pinata](https://github.com/dgreenheck/three-pinata)
  - Modo: Cutting Material. — [Foundry Modo](https://learn.foundry.com/modo/content/help/pages/modeling/edit_geometry/shatter_geo.html)
  - Chaos: an Inside Materials node. — [UE API](https://dev.epicgames.com/documentation/unreal-engine/API/Plugins/GeometryCollectionNodes?lang=en-US)
  - Houdini: a dedicated Inside Face UVs node. — [SideFX](https://www.sidefx.com/docs/houdini/nodes/sop/rbdmaterialfracture.html)
- ConvexObjectBreaker does nothing special for cut faces: pieces reuse the original material. — [ConvexObjectBreaker.js](https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/jsm/misc/ConvexObjectBreaker.js)

### Inferences

- **Pre-fracture versus runtime for this game.** Pre-fracture wins on every axis that matters here:
  - Vessels are hollow, so they are non-convex, which rules out ConvexObjectBreaker.
  - Runtime Voronoi (three-pinata) cannot guarantee the exact 16–18 count the catalog contract requires.
  - Any runtime fracture puts a CPU spike on the impact frame, the frame the hit-stop is meant to make feel heavy.
  - Pre-fracture is deterministic, is checked by the existing contract gates, and costs nothing at runtime.
- **Size arithmetic.** A 0.6 m urn about 0.35 m across has roughly 0.66 m² of outer wall (π × 0.35 × 0.6). Split 17 ways, each shard averages about 0.04 m², roughly a 20 × 20 cm plate. Equal plates of that size read as broken pottery or tile. Real annealed glass gives large sharp shards plus many small splinters near the origin. So the 16–18 authored shards should carry the shape of the break, and a separate cheap debris layer should supply the "many pieces" read (Section 2).
- **Recommended distribution for 16–18 shards.** Pick an impact pole on the wall (for example, the side facing the camera or the sound source).
  - Within about a third of the vessel's girth around the pole: 8–10 small shards, wedge-shaped and longer radially than they are wide.
  - Mid-wall: 4–5 medium shards.
  - Far wall, lip or neck, and foot: 2–4 large shards.
  - This mirrors Houdini's Radial Crack Number, Minimum Width and Impact Spread, ConvexObjectBreaker's radial-first cuts, and Cell Fracture's Cursor Close recursion. A thick foot or stem surviving as one heavy piece is realistic for glass. That conflicts with the current "no 40 per cent foot" rule and is a design call.
- **How to get it in `bkit`.** Two cheap changes:
  - (a) Weight the 3,000 surface samples, or the farthest-point distance, by a target size that grows with distance from the pole. For example, pick the next seed by maximising `dist / s(p)` with `s` rising from small to large.
  - (b) Add 4–6 radial bisect planes through the impact axis before or after the Voronoi cells, to get long dagger shards near the hit.
  - Cell Fracture's anisotropic Scale is global, so it cannot do (b).
- **Impact direction at runtime.**
  - Rotationally symmetric, handle-less vessels can reuse one shard set by rotating it about the vertical axis to face the hit.
  - Amphorae with two handles have only 180-degree symmetry, so they need two variants.
  - Ship 2–3 variants per vessel only if a break must start from an arbitrary side.
  - This is the cheap version of Breaking Good's "project the impact onto precomputed modes".
- **Thin versus thick walls.** On thin glassware and decanters the cut-face band is a hairline, so the read comes from silhouette and glints, and long sharp radial shards matter most. On thick urns and amphorae the cut faces are large and visible, so the cut material carries the read (Section 2). "Rougher cut glass" should stay only mildly rough.
- **Cut-face UVs.** If `cavity_surface` is an untextured glass material, it needs no meaningful UVs. If any texture is added (hackle noise, a crack mask), use object-space box or triplanar projection, as Houdini's Inside Face UVs and three-pinata's `textureScale` do. Blender's cut faces get no designed UVs.

### Gaps

- I could not fetch Unreal's Fracture Mode pages: they are JS-rendered, and the 4.27 docs returned 403. So the Radial tool's parameter names, the Chaos internal-material slot convention, and any "Auto UV" or baked internal-face textures are unverified.
- RayFire's exact radial parameter names and inner-material settings are unverified.
- Whether Blender 5.2's Cell Fracture (now an extension) keeps identical options is unverified. It matters little, since the project uses its own `bkit.fracture`.
- No source was found on how glass containers specifically fracture (bottle or vase fractography), as opposed to flat panes.

## 2. Read: what makes a break read as glass rather than plastic or stone

### Takeaway

Glass reads as glass mainly through four things. First, cut faces and edges that look like glass seen edge-on: strongly tinted from the long path length, and glossy (fracture "mirror"), not matte. Second, sharp elongated shards with sparkle. Third, a high, bright debris "tinkle" tail in the sound. Fourth, a staged sequence of crack, freeze, burst and settle, with particles covering the mesh swap. Stone-like dust, rough cut faces and uniform blocky pieces push it toward ceramic or stone.

### Cited Findings

#### Cut faces and edges

- Ordinary glass looks green edge-on because of iron oxide and path length: "when viewed on edge, these glass are very green (as a function of optical path length)". Ferrous iron gives a blue-green tint, ferric iron a yellowish one. — [Lehigh glass lecture (Shelby, Colored Glass)](https://www.lehigh.edu/imi/teched/GlassProcess/Lectures/Lecture04_Shelby_ColoredGlass.pdf)
- Even low-iron glass that looks colourless face-on has edges that "appear to be significantly colored because of the elongated view path" (patent background; search summary). — [US11279648B2](https://patents.google.com/patent/US11279648)
- Glass fracture faces show "mirror, mist and hackle". The mirror is the smooth, featureless region around the origin, and roughness "increases gradually" outward through mist to hackle. These features are "most clearly defined in glass" because it is homogeneous and has no crystal structure, while polycrystalline ceramics blur them (search summary of ASTM C1678 and ASM). — [ASTM C1678](https://store.astm.org/c1678-21r26.html)
- The game's intact glass already uses absorption over distance for the edge-on tint: `attenuationColor 0xe6f7f2`, `attenuationDistance 1.2`, "the faint green of real glass seen edge-on, from absorption over distance rather than from a tint in the albedo". — [apps/beside-cue/src/games/glass3d/render/Renderer3D.ts](../../../../apps/beside-cue/src/games/glass3d/render/Renderer3D.ts)

#### Cracks before the break (anticipation)

- In-game glass damage is usually done with decals or materials rather than real fracture. — [Epic forums UE 5.8.1 tutorial](https://forums.unrealengine.com/t/community-tutorial-unreal-engine-5-8-1-chaos-destruction-for-beginners-realistic-fractures-bullet-holes/2744389)
- Control uses decals ("stickers that you can slap on the environment") to sell impacts. — [GMTK (2025)](https://gmtk.substack.com/p/how-games-do-destruction)
- Shader-driven cracks seen in public examples (search summary):
  - Voronoi crack patterns with refraction and a `crack_duration` setting. — [Godot-Glass-Break-Effect](https://github.com/Lord0Sanz/Godot-Glass-Break-Effect)
  - A 0–1 `fall_progress` uniform driving shard fall. — [godotshaders: simple glass broken](https://godotshaders.com/shader/simple-glass-broken/)
  - A crack generator exposing depth, scale and width uniforms. — [godotshaders: cracked glass](https://godotshaders.com/shader/cracked-glass/)
  - An array of hit positions overlaying a shatter texture. — [itch.io devlog post](https://itch.io/post/12251342)
- Rainbow Six Siege's glass destruction included "data of different glass reactions to different weapon types" (search summary). — [Brendan Cohoe, ArtStation](https://bcohoe.artstation.com/projects/5qAWz)

#### Timing, hit-stop, camera shake

- Hit-stop pauses the update loop and freezes animation without freezing the whole world. Practitioners report 50–100 ms works best, though one forum coder suggests 0.2–0.3 s (practitioner blog; weak source). — [eastondev game-feel post (2026)](https://eastondev.com/blog/en/posts/dev/20260521-game-feedback-feel/)
- The trauma model of screen shake adds trauma between 0 and 1 per hit, decays it over time, and drives Perlin-noise offsets. It is based on a GDC talk by Squirrel Eiserloh (talk predates 2020). — [npm screen-shake](https://www.npmjs.com/package/screen-shake)
- The game already holds the broken glass still during hit-stop. The shards appear at the crack, so "what is held is the break". — [Renderer3D.ts](../../../../apps/beside-cue/src/games/glass3d/render/Renderer3D.ts)
- The design calls for "hit-stop, a beat of slow motion, a few hundred shards that tumble, settle and _stay_ on the floor". — [apps/beside-cue/docs/games/glass-3d.md](../../../../apps/beside-cue/docs/games/glass-3d.md)

#### Particles, glints, covering the swap

- Control swaps an intact model for a broken one and plays "a particle effect when the object breaks to cover up the transition", with effects chosen by material (metal, concrete, wood). — [GMTK (2025)](https://gmtk.substack.com/p/how-games-do-destruction)
- Houdini's Debris Source emits debris points from separating fractured bodies, that is, along the opening cracks. — [SideFX](https://www.sidefx.com/docs/houdini/nodes/sop/rbdmaterialfracture.html)
- Unity VFX Graph uses meshes for "more complex objects like debris" and lines for sparks. — [Unity VFX Graph](https://unity.com/fr/visual-effect-graph)
- A Fab glass pack uses "GPU Niagara powered VFX" with "pre-calculated shattering patterns" (search summary). — [Fab listing](https://www.fab.com/listings/bc34bd60-93e6-4039-bddd-d0162d5af74d)
- An offline Blender glass-shatter course layers "a front layer of really thin glass" over "a layer of chunkier glass" (search summary). — [Skillshare class](https://www.skillshare.com/en/classes/3d-animation-vfx-create-a-glass-shatter-effect-in-blender-study-hall/632862050)

#### Sound

- Naughty Dog (The Last of Us Part II, 2020) layered the glass break as: the first object striking the glass, the crack, a "thump" for power, and a debris tail. The debris layer was the "most important" part. — [GameSpot](https://www.gamespot.com/articles/the-last-of-us-part-2-sound-designer-explains-how-/1100-6479127/)
- Guides structure a break as contact, then crack or shatter, then falling material, then room tail. They suggest "a brighter sound for thin glass and a thicker sound for heavy glass" (sample-library marketing pages; weak). — [add.app glass SFX guide](https://add.app/sound-effects/glass-breaking-sound-effects/). Libraries ship separate break, debris and layered-crash categories. — [Airborne Sound: Elements Glass](https://www.airbornesound.com/downloads/elements-glass-sound-effects/)

#### Lifetime, fading, cleanup

- Unreal Chaos has **Remove On Max Sleep**. It removes a piece and "dissolves its rendered geometry" after **Maximum Sleep Time**, over **Removal Duration** seconds (search summary of the API docs). — [UE 5.2 Python API: GeometryCollection](https://docs.unrealengine.com/5.2/en-US/PythonAPI/class/GeometryCollection.html); [FGeometryCollectionRemoveOnSleepDynamicFacade](https://dev.epicgames.com/documentation/unreal-engine/API/Runtime/GeometryCollectionEngine/FGeometryCollect-_2)
- A known bug: with Remove-on-Break, the shrinking stops when the collection sleeps. — [UE-227628](https://issues.unrealengine.com/issue/UE-227628)
- A UE5 plugin exists only to clean up jittering fragments that never fully sleep, a sign that settle detection is a real problem (search summary). — [Chaos Debris Optimizer](https://forums.unrealengine.com/t/released-chaos-debris-optimizer-1-1-0-ue5-chaos-debris-cleanup-plugin/2746154)
- three-pinata recommends despawning settled fragments. — [three-pinata](https://github.com/dgreenheck/three-pinata)

### Inferences

- **`cavity_surface` should look like glass seen edge-on:**
  - glossy (roughness about 0.03–0.12, the fracture mirror)
  - the same hue as the vessel's attenuation but noticeably more saturated or darker, with a shorter `attenuationDistance` or a higher `thickness` than the outer shell
  - optionally a slightly brighter specular or emissive edge
  - A matte or "rough cut" face is the single biggest cue toward stone or plaster.
- **Per material:**
  - Frosted: frosting is a surface treatment, so the cut face should be clearer and glossier than the outside. That contrast says "glass" strongly.
  - Opal: milky throughout, so it stays milky on the cut.
  - Amber: deep amber cut edges.
  - Crystal: clear and bright.
- Stone trims should keep rough matte cut faces, since the contrast helps the glass read. Gold "into gold" is fine. Real gilt would tear rather than cleave, but no one will notice.
- **Pieces count.** Add a debris layer of about 100–300 tiny generic splinter meshes on top of the 16–18 authored shards. Use 3–5 chip geometries, instanced or batched, emitted along the shard boundaries nearest the impact. Without it, 16–18 plates will not reach the "few hundred shards" the design asks for. Keep dust minimal: a dust puff reads as stone or plaster.
- **Glints.** Keep shard normals faceted, as the bkit shards already are after triangulation, and give the shards a bright environment and specular highlights so facets flash as they spin. Add small additive star sprites on a few shards for 1–3 frames. These are cheap and say "glass".
- **Suggested timeline:**
  - Crack anticipation, 150–400 ms: emissive or decal crack lines growing from the impact pole, optionally a faint ring.
  - Impact frame: flash plus 50–100 ms hit-stop.
  - Burst with outward velocity from the pole and strong spin.
  - A short slow-motion beat.
  - Real-time settle, with tinkles tied to bounce times.
  - Camera shake: small, trauma-based, scaled by vessel size.
- **Sound.** Map the four Naughty Dog layers to events. Strike and crack go at impact, the thump goes on the burst, and the debris tinkles go on each shard–floor contact (from physics contact events or scripted bounce times). Use brighter samples for thin glassware and thicker ones for urns.
- **Cleanup.** The design wants shards to stay. Make staying cheap: once a shard settles, freeze it into a static batch and drop its body. If a fade is ever needed, shrink pieces (Chaos-style dissolve) rather than fade alpha, since alpha fades force the transparency sorting problems of Section 4.

### Gaps

- No primary game-VFX breakdown (80.lv, Real-Time VFX forum) of a glass shatter's particle or glint recipe was found. The glint and debris guidance above is inference.
- No source quantified how long anticipatory cracks should run before a break.
- No source was found on total internal reflection making glass edges bright. Only the path-length colour effect is sourced.

## 3. Physics in the browser: engines, phone cost, convex hulls, sleeping, despawn, determinism

### Takeaway

For 16–18 shards per vessel and a few vessels at once, the cheapest and most predictable option is the scripted, seeded ballistic motion the game already has. If shards need real contacts with plinths, walls or each other, Rapier is the maintained, deterministic, convex-hull-capable choice. Its JS bindings are at 0.21.0 (Sept 2026), while the project lockfile still has 0.12.0. cannon-es has had no release since 2022. No published phone benchmark covers this workload, so it has to be measured.

### Cited Findings

#### Engine status (npm, looked up 2026-10-23)

- `@dimforge/rapier3d-compat` 0.21.0 (2026-09-25), with `-deterministic-compat` and `-simd-compat` variants at the same version. `jolt-physics` 1.1.0 (2026-07-11). `cannon-es` 0.20.0 (2022-08-12). `three` 0.186.1 (2026-09-24). — [npm: rapier3d-compat](https://registry.npmjs.org/@dimforge/rapier3d-compat); [npm: rapier3d-deterministic-compat](https://registry.npmjs.org/@dimforge/rapier3d-deterministic-compat); [npm: rapier3d-simd-compat](https://registry.npmjs.org/@dimforge/rapier3d-simd-compat); [npm: jolt-physics](https://registry.npmjs.org/jolt-physics); [npm: cannon-es](https://registry.npmjs.org/cannon-es); [npm: three](https://registry.npmjs.org/three)
- The project lockfile pins `@dimforge/rapier3d-compat@0.12.0` and `three@0.185.1`. — [pnpm-lock.yaml](../../../../pnpm-lock.yaml)
- On the three.js forum, drcmda said "my experience with cannon is that it's very slow". cannon-es gets only minor fixes, and major issues "would often require a rewrite"; "rapier is maintained, it is quite fast" (July 2023). A 2025 reply notes that some engines visibly fail (constant bouncing, tunnelling) and asks for ms-per-frame rather than FPS. The thread has no numbers. — [discourse: Rapier vs Cannon performance](https://discourse.threejs.org/t/rapier-vs-cannon-performance/53475). It links lo-th's multi-engine sandbox. — [lo-th phy](https://lo-th.github.io/phy/index.html?E=w_cannon#basic)
- Only the Rapier and Jolt browser bindings are maintained by their engines' authors (search summary). — [PlayCanvas: Alternatives to ammo.js](https://developer.playcanvas.com/user-manual/physics/ammo-alternatives/)
- A native (not WASM) Godot-forum comparison had Rapier fastest on three of five 3D scenes and Jolt unstable on a joint grid (search summary; not browser numbers). — [Godot forum](https://forum.godotengine.org/t/physics-engine-comparison-rapier-vs-godot-vs-box2d-3d-vs-jolt/142786)
- Tutorial sites quote sizes of about 1.1–1.4 MB for Rapier's WASM and about 150 KB for pure-JS cannon-es. These are unbenchmarked and weak. — [Cinevva tutorial](https://app.cinevva.com/tutorials/game-physics-libraries); [learnwithhasan](https://learnwithhasan.com/js-libraries/rapier/)

#### Rapier specifics

- **Colliders.**
  - `ColliderDesc.convexHull(points)` "will automatically compute the convex hull". `convexMesh(points, indices)` is "more efficient than the `ColliderDesc.convexHull` constructor" but gives wrong results if the input is not convex.
  - "It is discouraged to use a triangle meshes or a polylines for colliders attached to dynamic rigid-bodies". Use a convex decomposition in a compound for non-convex dynamic objects.
  - Round convex shapes collide faster than plain ones. Collision groups "should be preferred most of the time because it skips more computations". Collision events are off by default (enable with `ActiveEvents.COLLISION_EVENTS`). Default density is 1.0.
  - — [Rapier JS: Colliders](https://rapier.rs/docs/user_guides/javascript/colliders)
- **Rigid bodies.**
  - Bodies sleep when they don't move "during a few seconds", and `canSleep` defaults to true.
  - CCD is off by default (`setCcdEnabled`). Soft CCD is "a cheaper alternative to CCD for slow-but-thin or moderately fast objects", but large prediction values "impact the performances badly".
  - Linear and angular damping default to 0.
  - Kinematic bodies "ignore any contact force and go through walls".
  - — [Rapier JS: Rigid bodies](https://rapier.rs/docs/user_guides/javascript/rigid_bodies)
- **Determinism.** "The WASM/Typescript/JavaScript version of Rapier is fully cross-platform deterministic" across browsers, operating systems and processors. This holds given the same Rapier version, bodies "added/removed in the exact same order", and initial values from deterministic operations. `Math.sin` and `Math.cos` "may give different results on different platforms". The page does not mention the separate `-deterministic` npm packages. — [Rapier JS: Determinism](https://rapier.rs/docs/user_guides/javascript/determinism)

#### Jolt, Ammo

- JoltPhysics.js ships 7 build flavours (wasm-compat, wasm, asm.js, multithreaded and debug variants). SIMD is on by default in the multithreaded builds. `-DCROSS_PLATFORM_DETERMINISTIC=ON` gives results identical to native Jolt. The README makes no performance claims. — [JoltPhysics.js](https://github.com/jrouwe/JoltPhysics.js)
- The three.js shatter example (`physics_ammo_break`, formerly `webgl_physics_convex_break`) uses Ammo.js:
  - debris colliders are `btConvexHullShape` built from vertex positions, with margin 0.05
  - `subdivideByImpact(obj, impactPoint, impactNormal, 1, 2)`
  - it breaks when `maxImpulse > fractureImpulse` (250)
  - fragments are never removed
  - — [physics_ammo_break.html](https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/physics_ammo_break.html); [threejs.org examples list](https://threejs.org/examples/files.json)

#### three.js helpers

- r185.1 ships `AmmoPhysics.js`, `JoltPhysics.js` and `RapierPhysics.js` addons, with examples `physics_rapier_basic`, `_instancing`, `_joints`, `_character_controller`, `_vehicle_controller`, `_terrain` and `physics_jolt_instancing`. — [local three@0.185.1 package](../../../../node_modules/.pnpm/three@0.185.1/node_modules/three/examples/jsm/physics); [threejs.org examples list](https://threejs.org/examples/files.json)
- `RapierPhysics.js` imports `@dimforge/rapier3d-compat@0.17.3` from Skypack (confirmed in the local r185.1 copy):
  - shapes: box, rounded box, sphere/icosahedron, cylinder, capsule, and trimesh for any other BufferGeometry
  - "Convex hulls are not supported"
  - InstancedMesh supported
  - steps at 60 Hz via `setInterval` but with `world.timestep = timer.getDelta()`, a variable step
  - — [RapierPhysics.js (dev)](https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/jsm/physics/RapierPhysics.js)

#### What the project already does

- "The shatter needs no GPU compute. Bake each shard's trajectory into vertex attributes and drive the whole burst from one `uProgress` uniform". The fracture library has "Recursive convex splitting, shard bodies, integration, seeded determinism". — [glass-3d.md](../../../../apps/beside-cue/docs/games/glass-3d.md)
- In the renderer, `shardAt(launch, seconds, cfg)` is "the specification for shard motion". Shards bounce off y = 0, and per-shard matrices are composed on the CPU ("~100 matrix composes a frame, which is nothing"). — [Renderer3D.ts](../../../../apps/beside-cue/src/games/glass3d/render/Renderer3D.ts)

### Inferences

- **Cost.** Three or four vessels breaking at once gives 54–72 dynamic convex bodies. That is a small island count for any native-grade engine, and the CPU cost of WASM Rapier at this size is very likely well under a millisecond on desktop. On phones it is very likely affordable but unmeasured (see Gaps). The bigger mobile costs are the WASM download and init, plus GPU fill from the shards (Section 4).
- **Recommended tiers:**
  1. **Scripted** (current). Seeded ballistic flight plus analytic collision against the floor, plinth tops and walls as planes or boxes. It is deterministic and replayable, needs no WASM, and is enough for museum debris that only has to land and stay.
  2. **Rapier**, if shards must hit arbitrary room geometry, the player, or each other. Notes for this tier:
     - Upgrade from 0.12 to 0.21.
     - Precompute each shard's convex hull in Blender and pass it to `convexMesh` (faster than `convexHull`), or call `convexHull` on the shard vertices at load.
     - For large bowl-shaped base pieces, a single hull fills the bowl. That is acceptable for debris; use a 2–4-hull compound only if other shards must land inside it.
     - Put shards in a collision group that skips shard–shard pairs for the first second, or for good.
     - Enable soft CCD on shards over thin plinth tops.
     - Use a fixed 1/60 s accumulator step, not the three.js helper's variable step, if determinism or replays matter.
     - On sleep, copy the final transforms into a static batch and remove the bodies.
- Do not build on the three.js `RapierPhysics.js` helper for shards. It has no convex hulls, uses a variable timestep and pins Rapier 0.17.3. Call Rapier directly.
- Avoid cannon-es (unmaintained since 2022, reported slow) and Ammo.js (third-party port). Jolt is a credible alternative, but its multithreaded build's hosting needs are unverified.

### Gaps

- No published browser benchmark (desktop or phone) of Rapier, Jolt or cannon-es with about 50–100 convex-hull bodies was found. The lo-th sandbox exists, but no results were reported. A direct measurement on a mid-range Android phone and an iPhone is needed.
- Jolt's multithreaded build requirements (SharedArrayBuffer, COOP/COEP headers) are not stated in its README.
- What the `-deterministic-compat` Rapier package changes, given the docs already claim cross-platform determinism, is unverified.

## 4. Rendering shards in three.js r185.1: transmission cost, cheaper materials, batching, sorting

### Takeaway

In three.js the transmission pass runs once per frame per camera, not once per object. Its cost is one extra opaque-scene render into a full-viewport, mipmapped, multisampled target, plus the per-pixel refraction shading of every transmissive surface. Any material with `transmission > 0` is put in the transmissive list whatever its `transparent` flag. So the game's current shard material (`transmission: 0.25`, `transparent: true`) still pays full transmission shading, and alone keeps the pass running. BatchedMesh (one material, many geometries, per-instance sorting and culling, one multi-draw) is the right container for shards, with one batch per material.

### Cited Findings

#### How the transmission pass works in r185.1

- `renderTransmissionPass` runs once per `render()` call per camera, and only `if ( transmissiveObjects.length > 0 )`. It renders the opaque objects and the background into the target, with tone mapping switched off for that pass. — [WebGLRenderer.js (three.js dev)](https://raw.githubusercontent.com/mrdoob/three.js/dev/src/renderers/WebGLRenderer.js)
- It also renders the back faces of DoubleSide transmissive objects into the target, but only when `WEBGL_multisampled_render_to_texture` is absent (`// see #28131`, present in r185.1 at line 2050). — [WebGLRenderer.js](https://raw.githubusercontent.com/mrdoob/three.js/dev/src/renderers/WebGLRenderer.js); [local r185.1 WebGLRenderer.js](../../../../node_modules/.pnpm/three@0.185.1/node_modules/three/src/renderers/WebGLRenderer.js)
- The render target uses `generateMipmaps: true` and `LinearMipmapLinearFilter`, HalfFloat when supported, and `samples: Math.max( 4, capabilities.samples )`. It is resized each pass to viewport × `transmissionResolutionScale`. — [WebGLRenderer.js](https://raw.githubusercontent.com/mrdoob/three.js/dev/src/renderers/WebGLRenderer.js)
- In r185.1, `transmissionResolutionScale` defaults to 1. Its doc comment says "Lowering this value can result in significant performance improvements when using MeshPhysicalMaterial#transmission". — [local r185.1 WebGLRenderer.js](../../../../node_modules/.pnpm/three@0.185.1/node_modules/three/src/renderers/WebGLRenderer.js)
- Frame order: shadow maps, transmission pass, background, then opaque, transmissive and transparent lists. A transparent DoubleSide material is drawn twice, BackSide then FrontSide, unless `forceSinglePass` is set. — [WebGLRenderer.js](https://raw.githubusercontent.com/mrdoob/three.js/dev/src/renderers/WebGLRenderer.js)
- Using three's internal transmission buffer means "no transmissive material can 'see' other transparent or transmissive objects". drei's MeshTransmissionMaterial, by default, renders its own extra scene pass per material ("can still be expensive as it causes an additional render pass of the scene"). Its options:
  - `transmissionSampler` reuses three's buffer.
  - `samples` defaults to 6.
  - `resolution` defaults to fullscreen.
  - `backside` means "more cost".
  - A shared `buffer` prop lets materials share one texture.
  - For roughness, "consider using a tiny resolution, for instance 32x32 pixels".
  - — [drei MeshTransmissionMaterial docs](https://drei.docs.pmnd.rs/shaders/mesh-transmission-material)

#### Render lists and sorting

- `if ( material.transmission > 0.0 ) transmissive.push(...)` is checked before `transparent`, so a transmissive material set `transparent: true` still goes to the transmissive list. Sorting:
  - opaque: `painterSortStable` (groupOrder, renderOrder, material.id, materialVariant, z ascending, id)
  - transmissive and transparent: `reversePainterSortStable` (groupOrder, renderOrder, z descending, id)
  - — [WebGLRenderLists.js (dev)](https://raw.githubusercontent.com/mrdoob/three.js/dev/src/renderers/webgl/WebGLRenderLists.js). The same check is present in local r185.1 at lines 126 and 146. — [local WebGLRenderLists.js](../../../../node_modules/.pnpm/three@0.185.1/node_modules/three/src/renderers/webgl/WebGLRenderLists.js)

#### BatchedMesh and multi-draw

- BatchedMesh is for "a large number of objects with the same material but with different geometries".
  - Constructor: `(maxInstanceCount, maxVertexCount, maxIndexCount, material)`.
  - The first geometry defines the attribute layout.
  - `sortObjects` (default true) sorts instances back to front for `transparent` materials and front to back otherwise, by bounding-sphere centre depth, which is approximate. `setCustomSort` replaces it.
  - `perObjectFrustumCulled` defaults to true.
  - `setColorAt` gives per-instance colour (a Vector4 adds alpha); `setVisibleAt` toggles instances.
  - `deleteGeometry`, `deleteInstance` and `optimize()` repack the data.
  - — [BatchedMesh.js (dev)](https://raw.githubusercontent.com/mrdoob/three.js/dev/src/objects/BatchedMesh.js). The defaults are confirmed in local r185.1. — [local BatchedMesh.js](../../../../node_modules/.pnpm/three@0.185.1/node_modules/three/src/objects/BatchedMesh.js)
- Without `WEBGL_multi_draw`, the renderer falls back to a loop of individual draws, setting `_gl_DrawID` per draw. With it, it issues one `renderMultiDraw`. — [WebGLRenderer.js](https://raw.githubusercontent.com/mrdoob/three.js/dev/src/renderers/WebGLRenderer.js)
- `WEBGL_multi_draw` (WebGL2) support: 92.76 per cent overall; Android 96.36, iOS 99.99, Safari 99.99, Chrome 99.98, and Firefox only 1.12 (undated). — [Web3D Survey](https://web3dsurvey.com/webgl2/extensions/WEBGL_multi_draw)

#### Cost reports

- Transmission cost on mobile depends on the screen area of transmissive surfaces and the draw cost of the rest of the scene, and it can make an app fragment-bound (forum, search summary). — [discourse: glTF FPS low](https://discourse.threejs.org/t/issue-with-optimizing-my-gltf-file-fps-low/65775)
- One developer saw GPU usage max out with drei's MeshTransmissionMaterial on a MacBook Air M2. The suggested fix was a transmissive material on only one mesh (search summary). — [discourse: MTM poor performance](https://discourse.threejs.org/t/meshtransmissionmaterial-poor-performances-urgent/68566)
- Transmission failed to render on some Android devices, such as a Pixel 3a XL (older thread; search summary). — [discourse: transmission on Android](https://discourse.threejs.org/t/transmission-of-meshphysicalmaterial-doesnt-work-on-some-android-devices/28836)

#### An alternative to sorting: alphaHash

- r185.1 `Material.alphaHash` (default false): "The material will not be rendered if opacity is lower than a random threshold. Randomization introduces some grain or noise, but approximates alpha blending without the associated problems of sorting. Using TAA can reduce the resulting noise." — [local r185.1 Material.js](../../../../node_modules/.pnpm/three@0.185.1/node_modules/three/src/materials/Material.js)

#### The game's current shard rendering

- The intact glass uses `transmission: 1`, `thickness: 0.008`, `ior: 1.5` and `transparent: false`. — [Renderer3D.ts](../../../../apps/beside-cue/src/games/glass3d/render/Renderer3D.ts)
- The shards use their own `MeshPhysicalMaterial`: `transmission: 0.25`, `thickness: 0.004`, `transparent: true`, `opacity: 0.92`, `side: DoubleSide`. The comment reads: "A hundred transmissive pieces means a hundred reads of the transmission buffer ... Bright, thin and slightly emissive reads as flying glass and costs nothing". — [Renderer3D.ts](../../../../apps/beside-cue/src/games/glass3d/render/Renderer3D.ts)
- All shards sit in one `BatchedMesh` (one draw call), with `frustumCulled = false` because the batch bounds go stale. The batch is pre-compiled with `compileAsync` to avoid a program link on the shatter frame. On the break, the intact mesh and the back diffuser panel are hidden and the batch is shown. — [Renderer3D.ts](../../../../apps/beside-cue/src/games/glass3d/render/Renderer3D.ts)

### Inferences

- **The current shard material does not do what its comment says.** With `transmission: 0.25` it is still transmissive. It runs the full transmission shader path per pixel (the value only scales the mix). It keeps the transmission pass alive even after every intact vessel in view has broken. Being DoubleSide, its back faces are drawn into the transmission target wherever `WEBGL_multisampled_render_to_texture` is missing. And `transparent: true` changes only how BatchedMesh orders instances, not which list the batch is in. To make shards genuinely cheap, set `transmission: 0` and fake the glass.
- **Per-object transmission is not the expensive part.** The pass happens once regardless of how many transmissive objects there are. The real costs are:
  - (a) the pass existing at all: one opaque-scene re-render plus mip generation
  - (b) transmissive pixel coverage
  - (c) draw calls, which BatchedMesh already collapses
- In a museum room with several intact transmissive vessels, the pass runs anyway, so transmissive shards add only (b) and (c). Lowering `renderer.transmissionResolutionScale` to about 0.5 on phones is the first lever, since the docs promise "significant" gains.
- **Options for shards**, roughly cheapest first:

  | Option                                                                                                                                 | GPU cost                               | Read                                   | Notes                                                            |
  | -------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- | -------------------------------------- | ---------------------------------------------------------------- |
  | A. Opaque "fake glass" (`transmission: 0`, `transparent: false`, high specular, room PMREM env, faceted normals, slight emissive edge) | Lowest; no sorting, writes depth       | Bright glinting flakes; no see-through | Best for small or fast shards and the debris layer               |
  | B. Transparent fake glass (`transmission: 0`, `transparent: true`, opacity ~0.4–0.7, env reflections)                                  | Low; blended, two passes if DoubleSide | See-through but no refraction          | Overlap sorting artifacts possible; consider `alphaHash` instead |
  | C. Same material as intact (transmissive)                                                                                              | Same as intact vessel per pixel        | Identical to the vessel                | Use during hit-stop or the first ~100–200 ms only                |
  | D. Transmissive shards for the whole flight                                                                                            | Highest                                | Best                                   | Acceptable on desktop; scale resolution on phones                |

- **Recommended hybrid.**
  - During hit-stop, render the shards with the intact vessel's own materials, so there is no pop when the mesh swaps.
  - Swap to option A or B once they move: speed and motion hide the loss of refraction.
  - Hiding the intact vessel and the diffuser at the break already removes this vessel's contribution to the pass.
- **Batches per material.** BatchedMesh takes one material, but shards carry the vessel glass, `cavity_surface`, gold and stone. Split each shard by material group into up to four batches (glass, cavity, gold, stone) that share the same per-instance matrices, giving 2–4 draws per break. Use `setColorAt` for tint variety inside a batch. `attenuationColor`, `thickness` and `ior` are per-material, so amber, opal and crystal need separate batches if those differ. One batch per material family per room, not per vessel, keeps draws flat as vessels break.
- **Sorting.** The whole batch sorts as one object against other transparent objects, and inside it instances sort by bounding-sphere depth. With transparent DoubleSide, every shard's back faces draw before every shard's front faces, so a far shard can paint over a near one. At shatter speeds this is rarely visible.
  - If it is, use opaque option A (no sorting) or `alphaHash` (no sorting, but grain).
  - The pipeline has no TAA, so test whether that grain reads as sparkle or as noise.
  - Per-instance culling (`perObjectFrustumCulled`) still works when the batch's own `frustumCulled` is false.
- **Firefox** lacks `WEBGL_multi_draw`, so BatchedMesh falls back to one draw per shard. At 18–100 shards that is acceptable.
- **Through-glass visibility.** Shards and other transparent objects never appear inside the transmission buffer, so a flying shard behind an intact vessel is invisible through that vessel. This is probably unnoticeable, but avoid staging a break directly behind another vessel from the camera.

### Gaps

- No benchmark was found for many transmissive objects on mobile, or for BatchedMesh with transmission on phones. It needs an on-device test: one room, 3 intact vessels plus 1 breaking, transmission scale 1.0 versus 0.5, shard options A–D.
- Which mobile browsers expose `WEBGL_multisampled_render_to_texture` was not checked. It decides whether DoubleSide transmissive back faces get the extra draw into the transmission target.
- Whether `setColorAt` alpha works with transmissive materials in BatchedMesh was not verified.

## 5. Examples, talks and tutorials

### Takeaway

Few recent primary talks cover glass specifically. The useful references are three groups. First, Ubisoft's RealBlast talk (2016, older) and Mark Brown's 2025 survey, for the industry patterns: swap to pre-broken pieces, cover with particles, decals for damage, hide debris over time. Second, Breaking Good (2022), for precomputed impact-dependent fracture. Third, three.js material: `physics_ammo_break` with ConvexObjectBreaker, three-pinata, and the Codrops "exploding objects" vertex-shader approach, the last matching this game's baked-trajectory design.

### Cited Findings

#### Talks and articles

- "The Art of Destruction in Rainbow Six: Siege" (Julien L'Heureux, GDC 2016, older). RealBlast generates the change in an object's state at runtime with a unique outcome, "as opposed to pre-fragmented destruction" (search summary). — [GDC Vault](https://www.gdcvault.com/play/1023003/The-Art-of-Destruction-in); [YouTube](https://www.youtube.com/watch?v=SjkQxowsL0I); [Ubisoft interview](https://news.ubisoft.com/en-us/article/4GHX2yepSaKkflLjLAlpwO/the-art-of-destruction-in-rainbow-six-siege-an-interview-with-julien-lheureux)
- Mark Brown's "How Games Do Destruction" (Game Maker's Toolkit, 2025-10-02) covers several patterns:
  - Control stores intact and broken versions and swaps them, covering the swap with material-specific particles, and uses decals.
  - Battlefield: Bad Company 2 uses prefabricated pieces with intact and destroyed variants and a "pre-canned destroyed animation".
  - Red Faction: Guerrilla has a "stress" system of strength and weight per layer.
  - The Finals uses the same fractured-parts-plus-stress setup on UE5 with PhysX.
  - Teardown turns loose voxels into new rigid bodies.
  - — [GMTK Substack](https://gmtk.substack.com/p/how-games-do-destruction)
- The Last of Us Part II glass-break sound layering (2020). — [GameSpot](https://www.gamespot.com/articles/the-last-of-us-part-2-sound-designer-explains-how-/1100-6479127/)

#### Research

- Breaking Good (SIGGRAPH Asia 2022): precomputed fracture modes, with runtime impacts projected onto them. — [project page](https://www.dgp.toronto.edu/projects/breaking-good/); [arXiv](https://arxiv.org/abs/2111.05249)
- DeepFracture (2023), a generative approach to brittle-fracture prediction. — [arXiv 2310.13344](https://arxiv.org/html/2310.13344v2)

#### three.js examples and libraries

- `physics_ammo_break` (ConvexObjectBreaker plus Ammo.js; renamed from `webgl_physics_convex_break`), `physics_rapier_instancing` and `physics_jolt_instancing`. — [threejs.org examples list](https://threejs.org/examples/files.json); [physics_ammo_break.html](https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/physics_ammo_break.html)
- three-pinata, runtime Voronoi fracture with inner-face material and UVs and a Rapier demo. — [GitHub](https://github.com/dgreenheck/three-pinata)
- An SBCODE tutorial pairs ConvexObjectBreaker with Cannon physics. — [sbcode.net](https://sbcode.net/threejs/convexobjectbreaker/)
- A Wawa Sensei R3F tutorial pre-fractures models with Blender Cell Fracture and explodes them. — [wawasensei.dev](https://wawasensei.dev/tuto/react-three-fiber-tutorial-mesh-explosion-effect)
- Codrops "Exploding 3D Objects with Three.js" (2019, older): Voronoi-style fragments, with per-fragment motion in a vertex shader driven by a progress value. — [Codrops 2019](https://tympanus.net/codrops/2019/03/26/exploding-3d-objects-with-three-js/)
- Codrops' 2026 pixel-to-voxel tutorial with Rapier suggests Voronoi glass shattering as a next step but does not build it. — [Codrops 2026](https://tympanus.net/codrops/2026/01/05/how-to-create-a-pixel-to-voxel-video-drop-effect-with-three-js-and-rapier/)
- Codrops "Real-time Multiside Refraction in Three Steps" (2019, older): back-face plus front-face refraction for glass objects. — [Codrops 2019](https://tympanus.net/codrops/2019/10/29/real-time-multiside-refraction-in-three-steps/)

#### DCC documentation and tutorials

- Houdini RBD Material Fracture (Glass mode), Labs Inside Face UVs, RBD Edge Strip, Debris Source. — [SideFX](https://www.sidefx.com/docs/houdini/nodes/sop/rbdmaterialfracture.html)
- An 80.lv guide to UE5 Chaos destruction (Geometry Collections and fracture types). — [80.lv](https://80.lv/articles/unreal-engine-5-s-chaos-destruction-system-complete-guide)
- The UE 5.8.1 Radial-fracture glass tutorial. — [Epic forums](https://forums.unrealengine.com/t/community-tutorial-unreal-engine-5-8-1-chaos-destruction-for-beginners-realistic-fractures-bullet-holes/2744389)

### Inferences

- The industry pattern closest to this game is Control's and Bad Company 2's: a pre-made broken version, swapped in on the impact frame and covered by material-specific particles, with decals or shader cracks for damage before the break. RealBlast-style runtime fracture solves a different problem (unique holes in walls) that this game does not have.
- The Codrops vertex-shader approach is the same architecture as the game's planned `uProgress` baked-trajectory burst. A shader path should match the existing CPU `shardAt` specification rather than replace it.

### Gaps

- No GDC or other talk on Control's destruction was found. The only source is the GMTK summary.
- No primary talks were fetched for Red Faction: Guerrilla (Geo-Mod 2.0), Battlefield or The Finals. Only the GMTK summary covers them.
- No SIGGRAPH course notes on real-time destruction or glass were found in this pass.
- No Codrops or discourse tutorial was found that builds a full glass shatter in three.js (pre-fractured shards plus a glass material plus physics).
- No Real-Time VFX forum or 80.lv breakdown of a real-time glass shatter VFX recipe was found.
