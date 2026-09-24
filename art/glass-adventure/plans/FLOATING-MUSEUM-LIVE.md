# Floating Museum — live map production

Approved direction A, 2026-09-21. Build after the current four-stage pass;
retain the other two image auditions for later. Reference:
`../journey-map/v1/a-floating-museum.png`. This is a live Three.js scene with
modeled architecture and animated water, not that image drawn behind buttons.

## First playable scope

- Four existing chapters retain their IDs, progress and independent saves.
  First Light, Glassworks Journey, Twin Galleries and Resonance Conservatory
  become miniature museum islands connected by marble bridges and gold trails.
- Keep the welcoming introduction and an accessible chapter list. A selected
  island opens a readable gallery panel with a real Enter/Continue/Replay button.
  Canvas selection is an enhancement; keyboard and touch need equally clear
  HTML controls. Do not unexpectedly lock previously accessible galleries.
- The current earned Journey portrait is displayed only when its saved reward
  says it is owned. Future portraits remain mysterious; do not invent earned
  stars for ungraded lessons or infer them from completion.
- Separate map stage definitions from playable levels. In this first version
  the four stages each contain one gallery. Later a stage can contain several
  levels, and a window of nearby stages can serve a 10–50-level campaign.

## Model and composition plan

Use the existing accepted Meshy/Blender marble architecture, gilded columns,
canopy and crystal plants as a shared visual kit. Create a dedicated Meshy rock
island donor if the existing hulls cannot match the reference's suspended cliffs.
Do not regenerate identical architecture for each chapter. Finalize map-scale
geometry in Blender, retain a packed `.blend`, and export named glTF groups.

Use an isometric perspective, real depth, warm skylight, pale cloud distance,
dark-jade accents and gold specular edges. Distinguish the low/high Twin domes
with amber and celadon. Conservatory has a botanical crown and additional water.
Merc sits on the selected node, with his existing idle animation and a short
travel/focus transition. Buildings, path medallions and portraits are geometry.
Keep text and interactive labels in the DOM so they remain sharp on tablets.

## Water research and implementation decision

Blender fluid simulation is an authoring/cache system, not a browser runtime.
Its baked meshes/particles live in their own cache files. glTF exports object
transforms, skeletal animation and shape keys; a changing-topology liquid cache
does not simply become a compact glTF animation. Bake studies can inform the
shape and motion, but shipping all simulated frames would inflate the map.

Use genuine 3D waterfalls: curved, segmented water ribbons flowing over modeled
spillways, animated vertex motion, two advancing flow phases for continuous
normal/foam detail, separate impact foam and a small mist volume. Water moves
down the geometry and changes silhouette; mist alone is not the effect. Small
basin surfaces receive ripple motion and environment highlights. Keep effects
bounded and pause their clocks when hidden. Reduced-motion users retain a calm
recognizable water surface without camera bob or continuous travel effects.

Three.js Water2 demonstrates dual-phase flow maps but also performs reflection
and refraction renders. Use that as a reference, not one full secondary scene
render per waterfall. Prefer one lightweight purpose-built water material with
the same owned clock, exported geometry and explicit disposal. Reuse the
museum's environment lighting; avoid a reflection recursion chain.

Primary references checked for this decision:

- [Blender fluid cache](https://docs.blender.org/UATEST/manual/en/4.5/physics/fluid/type/domain/cache.html)
- [Blender glTF animation](https://docs.blender.org/manual/en/3.0/addons/import_export/scene_gltf2.html#animation)
- [Three.js flow-map water design](https://github.com/mrdoob/three.js/issues/10036)
- Installed Three.js `examples/jsm/objects/Water2.js` is the version-specific
  implementation to inspect before borrowing flow timing or shader structure.

## Budget and lifecycle targets

Targets to measure, not claims already achieved: map visible geometry under
150k triangles, under 100 draws in the ordinary view, DPR capped at 1.5 on
coarse pointers, four waterfall ribbons plus bounded pooled mist, no ongoing
offscreen map renderer after entering a gallery. Prefer shared atlas materials
and instancing for repeated small vegetation/medallions. Start with no bloom
pass and add it only if measured headroom warrants it.

Lazy-load the map renderer and its small asset set at campaign entry. Dispose
controls, animation frame, observers, geometry/material/texture ownership and
audio when leaving. Show a useful retry/list fallback on WebGL or asset failure.
No second microphone, recorder or audio context ownership path is needed.
Water ambience starts only after a user gesture, respects mute/volume, and fades
out before a level. ElevenLabs effects are authorized if the existing ambience
does not suit the map; save original prompt, receipt, WAV and runtime derivative.

## Acceptance and handoff

- [ ] Stage 1–4 commits are pushed before map integration begins.
- [x] Named models, packed source, exact hashes and provenance are saved.
- [x] Water visibly changes geometry/surface flow across real rendered frames.
- [x] Desktop mouse and actual emulated touch selection; keyboard list/focus.
- [x] Portrait hidden/revealed states read existing saves correctly.
- [x] Narrow phone, tablet and desktop composition inspected in the real host.
- [x] Map → gallery → map does not retain duplicate canvas/audio/render loops.
- [x] Reduced motion, tab hide/resume, context failure and asset retry checked.
- [x] Measured renderer cost recorded separately from physical-device FPS.
- [ ] Commit/push, fresh static HTTPS preview, owner polish test instructions.

## Implementation boundaries for the first build

- `content/museum-journey.ts`: stable stage IDs, chapter references, island
  transforms, bridge endpoints and waterfall spillways. Keep this outside the
  physics level definition; a map destination is not a playable room collider.
- `journey/scene.ts`: renderer/camera/environment ownership, selective model
  loading, raycast selection and one visibility-aware animation loop.
- `journey/water.ts`: segmented flow geometry, owned animated uniforms, basin
  ripples and pooled mist. Use shared resources and no recursive reflector.
- `journey/models.ts`: named exported assemblies and material reuse. Map-scale
  derivatives must be exported separately instead of loading every full-size
  breakable or 40K-triangle canopy from the gameplay kit.
- `ui/MuseumJourney.tsx` and its own CSS module: responsive canvas plus a proper
  selected-gallery card, accessible chapter buttons, status, mute and retry.
- `ui/GlassCampaign.tsx`: retains save parsing, enters only one adventure,
  refreshes progress on return. A normal gallery list remains available when
  WebGL is unavailable and as a deliberate keyboard-friendly alternative.

The selected stage is selection state, not completion. Read finished/reward
state through `readProgress`. Only show stars when a saved quality result exists.
The Journey portrait plane can reveal the existing earned art; unrevealed
monuments have a branded etched silhouette, never a fake badge or score.

In the first view use four islands, not dozens: a small prologue pavilion, an
archive rotunda, paired amber/celadon domes and a botanical conservatory. Frame
all four on tablet landscape. On phone, frame the selected island more closely
and expose a compact horizontal chapter selector; keep the Enter action above
the bottom safe area. Do not shrink the entire desktop map into tiny phone dots.

Selecting a stage eases the camera/selected Merc marker without unexpected
entry. A separate Enter/Continue/Replay action begins the level. Pointer taps
select geometry; pointer drag pans gently with bounded orbit, and releasing
capture never accidentally enters a chapter. Respect cancelled pointers and
multitouch. Keyboard buttons trigger exactly the same selection operation.

Existing raw model cost inspection (2026-09-21): the gameplay canopy is 40,424
triangles, the gilded column 23,148, the crystal planter 9,236, and Merc 12,178.
Cloning these unchanged over four islands would spend the map's budget quickly.
Use Blender map LODs (rough targets: canopy 5–7K, column 1–2K, planter 1–2K,
frame 1K) and compare them at actual map-camera size. Existing v2 island root
is only 480 triangles but lacks the selected cliff silhouette; a dedicated
Meshy donor is justified. Reuse the already authored marble PBR atlas.

Installed Three.js Water2 was inspected: it owns both Reflector and Refractor,
normal-map scrolling and two phase offsets. Borrow the continuous-flow idea,
not its two full secondary scene renders per surface. Water motion must remain
visible after mist is disabled, and appear downward on every waterfall.

Keep the existing chapter list as a real visible section below the map for the
first implementation, preserving its independent Enter/Continue/Replay names
and direct-entry behavior. The map is an additional way to explore the journey;
its selected-card action uses a distinct accessible name such as “Enter selected
gallery” and names the chapter via its heading/description. This avoids duplicate
button-name ambiguity and lets existing keyboard navigation and host smoke tests
keep working. Once owner testing confirms the map flow, the list presentation can
be refined separately without removing the fallback.

Existing approved A02 is already a water-basin ambience (12.02-second repaired
loop, about 224 KB runtime). Start by using the shared garden audio scene/M03+A02
and its user preferences; additional ElevenLabs water effects are optional only
if the live waterfall still sounds unconvincing during audition. Avoid a second
uncoordinated soundtrack or mandatory sound before a user gesture.

## Reviewed ownership and failure contracts

- Campaign owns storage, progress migration and active visits. Stage selection
  is separate from an active visit and survives returning from a gallery.
- Stage data contains chapter IDs, not complete level definitions. Validate
  duplicate/unknown references and bridge endpoints. A stage may later contain
  multiple chapters without changing physics authoring.
- The lobby stays mounted as usable HTML while a dynamic scene import loads.
  Do not lazy-load the whole lobby with a cached rejected import. An import or
  WebGL failure leaves the chapter list usable; scene retry disposes the old
  attempt first. Late imports and asset parses check their retired token.
- Scene returns a synchronous handle with `ready`, selection/foreground/motion
  setters, metrics and `dispose`. It owns one RAF, renderer, observer, pointer
  capture state and abort controller. Shader time advances only on visible
  frames. Repeated foreground signals cannot create a second RAF.
- Water owns geometry, shared materials/uniforms and pooled mist, with
  `update(visibleSeconds, dt)`, reduced-motion mode and disposal. It owns no
  independent RAF, sound or DOM. Inspect motion with mist disabled too.
- Map assets use abortable fetch followed by GLTF parsing. A late parsed asset
  is disposed if its attempt retired; shared clones have one explicit GPU
  resource owner. Never load the entire gameplay kit to show four miniatures.
- Every entry action uses the same guarded audio fade before entering. Create
  one shared-host music service per lobby mount; start inside a user gesture.
  Backgrounding pauses it; foregrounding alone does not restart sound.
- Browser foreground subscription must emit initial visibility as well as
  later events. Context loss stops rendering and offers retry/list fallback;
  ordinary disposal removes the listener before forcing context loss.
- Taps select only. Track pointer IDs and movement; drags, cancelled pointers
  and multiple fingers cannot accidentally select or enter a gallery.
- Portraits and numeric stars use saved rewards, never completion as a proxy.
  Historical/ungraded results retain honest labels.

Focused checks: late import/parse disposal, retry race, initial-hidden state,
one loop across hide/resume, cancelled/dragged/multitouch input, one faded entry,
map → gallery → map resource lifecycle, and old/historical/ungraded saves. Record
actual mouse and emulated touch evidence separately from owner device testing.

## First live version and art follow-up

The first runtime uses the approved local Meshy architecture prepared as a
separate Blender map kit. Rounded marble terraces and suspended tapered cliffs
carry four distinct arrangements; paired amber/celadon domes identify Twins.
Long, segmented waterfall surfaces spill outside the cliff perimeter, with
visible downward surface flow and pooled mist. They have no artificial basin
floating in midair. A generated warm sky and three distant cloud layers replace
the temporary blue background. All motion uses the scene's foreground clock.

This is a playable interpretation of the audition, not pixel-equivalent finished
concept art. After owner inspection, prioritize the island silhouettes and lush
hanging gardens, fuller dome glazing, and convincing water-source channels before
adding more islands. Keep the shared model kit and bounded render cost. Preserve
B/C concepts unchanged for future chapters; they are not discarded.

The current soundtrack reuses the owner's approved M03 garden music and A02
water ambience. No new ElevenLabs expenditure was needed for this first map.
The Celadon upload block is independent of the map, which uses existing accepted
local source assets; it does not authorize uploading the pending guide.

## Integration checkpoint — f0d0c68a

The map is integrated into the shared campaign. Package suite: 421/421; package
TypeScript and scoped ESLint pass. The focused map/campaign browser cases pass
10/10 across the main run and a deterministic interrupted-fade follow-up. The
Home destination regression also passes after updating the new room order.
Construction rollback has a regression that forces PMREM setup failure plus a
throwing disposer and checks cleanup without masking the original failure.
The root web host and compiled BesideCue host both open the map without browser
errors. New-head cloud gates remain authoritative.

Compiled desktop/tablet/phone proofs and reproducible capture script are saved
under `../journey-map/v2/proofs/runtime/` and `production/capture-runtime.mjs`.
Measured totals include the shadow pass: desktop/tablet 157 draws and 253,126
triangles; phone 113 draws and 186,599 triangles. Water contributes 5 draws and
2,688 triangles, with no reflection/refraction pass. These are SwiftShader
render counts, not device FPS. They must not be compared with a visible-pass-only
budget as if shadows were free. Physical-device profiling remains open.

Source, public and compiled-preview map GLBs share SHA-256
`17294f9ccec6aa5fb18c9a3a3c31ce501750fd4375d0a2abbfdcdb33c7a00709`.
The collected portrait currently appears in the selected HTML keepsake panel;
revealing its art on the 3D monument is a later visual pass.
