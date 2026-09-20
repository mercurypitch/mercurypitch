# Glass adventure

A shared, content-driven 3D platformer for MercuryPitch and BesideCue. The player moves and jumps manually; voice is used only after explicitly starting a nearby glass encounter. The implemented first level is the floating Glassworks museum with three required held-note exhibits, two unlocked bridges, three teaching jumps, checkpoints, catch shelves and three optional panorama exhibits.

## Boundaries

- `contracts.ts` describes level data, simulation snapshots, input and captured pitch evidence.
- `content/` owns stable IDs and authored geometry. `glassworks.ts` is the first level.
- `authoring/` composes reusable local rooms and exhibit prefabs into a validated `LevelDefinition`. It is pure TypeScript; hosts and renderers consume the compiled result.
- `core/` is pure TypeScript. It owns fixed-step movement, floor collision, holds, progress and route gates; it has no browser, rendering or microphone imports.
- `render/` owns Three.js, the follow/orbit camera, Merc, materials and fracture presentation. `render/catalog.ts` maps content variants and platform skins to asset/material recipes.
- `host.ts` defines injected assets, persistence, foreground lifecycle, voice and sound. `browser/` adapts the existing shared microphone, pitch stream and audio-context lease services.
- `ui/` is the reusable Solid surface and session controller. The standalone web entry and BesideCue Games screen mount the same `GlassAdventure` component with their own host. The standalone entry is currently built by BesideCue's Vite configuration; publishing it at MercuryPitch's final public route is a separate host/deployment step.

The renderer never decides whether a display was earned. The host persists the core's successful break event before playing its effects. Stable saved completion IDs restore opened bridges and settled displays without replaying their sound or fracture.

## Author another flat level

1. Add a module in `content/` exporting a `LevelDefinition`. Use a new stable level ID and globally distinct exhibit IDs. Match checkpoint and gate dependencies to those IDs.
2. Express platforms as metres with +Y up. `top` and all player/anchor positions are **feet coordinates**, not mesh centres. Each platform is a rectangular solid defined by x/z bounds, top and thickness. Equal-height touching rectangles form continuous floors.
3. Put each checkpoint on a safe supported deck. A `catch` platform can name `catchCheckpointId`; landing there restores that checkpoint. Ordinary falls use the last reached checkpoint.
4. A bridge with `unlockAfter` has neither floor collision nor visible enabled state until that exhibit succeeds. Use an unjumpable unsupported span to protect progression; test diagonal and late-coyote approaches rather than adding invisible walls.
5. Give each breakable a visual `variant`, position, safe interaction anchor, `optional` flag and held-note parameters. `requiresCompleted` controls when its encounter is eligible. The exit declares its required IDs separately; optional exhibits do not block it.
6. Mount `<GlassAdventure host={host} level={newLevel} />`. Add the level to a host's selection UI only when its route and asset tests pass. This package currently has no multi-level selector or unlock campaign.

The default move speed is 1.15 m/s, jump apex 0.5 m and gravity 6.2 m/s². Movement normalizes diagonals, accelerates over 0.14 s, uses 0.11 s coyote time and a 0.13 s jump buffer, and requires a fresh jump press after cancellation. Simulation steps at 120 Hz with at most five physics steps per host call. It discards excess catch-up work after a stall. Pass real foreground elapsed time and the same monotonic `nowMs` used for voice callbacks to `game.step(input, elapsedSeconds, nowMs)`; renderers may clamp their separate presentation delta.

The collision adapter supports flat rectangular floors and authored `solids`: box props and tapered round props, with side, top and underside contact independent of Merc's animated silhouette. `content/solid-props.ts` shares the exhibit plinth dimensions with the renderer and defines reachable planter bases, arch supports and columns. Give an optional-floor prop a `platformId` so its collision follows that floor's activation. Decorative bundles can replace visible fallback proxies without changing collision.

Supporting the whole outer footprint would incorrectly bridge the 0.30 m teaching gap; floor support uses the foot centre. Props also recover side overlap when Merc steps off a rim. `CourseCollider` remains the replacement boundary for a future validated slope or moving-platform controller. **Slopes, moving platforms, capsule dynamics and rigid-body shard simulation are not implemented.** Intact glass, foliage and distant decorative architecture currently remain nonblocking.

## Compose rooms from a shared kit

`content/foundation-room-kit.ts` and `content/foundation-routes.ts` are worked examples: two 6 m square rooms arranged straight or around a quarter turn, each with two required holds, one optional exhibit and a permanent doorway gate. They are small composition proofs, not the planned longer museum levels.

1. Define a `RoomPrefab` in local metres with floors, box/round solid proxies, checkpoints, exhibit mounts, cardinal connection ports and exit zones. Optional visuals name render recipes; sound regions and room/camera bounds are data. A mount names its supporting local platform and safe listening anchor.
2. Define an `ExhibitPrefab` with a supported held-note recipe, vessel variant and shared plinth dimensions. Those dimensions place both the visible mount and its collision proxy. Put each exhibit in an explicit room/mount; give encounters stable IDs and prerequisite references.
3. Create an `AuthoredLevelSource` with stable `levelId`, `layoutId` and room instance IDs. Room transforms support translation and `yawQuarterTurns: 0 | 1 | 2 | 3`; arbitrary rotation and scale are rejected. All gameplay and presentation coordinates transform together. `audioSceneId` may override a placed room's sound regions.
4. Connect two `room.port` references with matching position, opposing direction and matching width/height. Their authored seals are removed. An optional connection gate declares `opensAfter`; completion removes the same visible and physical solid. `solidActivations` can also enable a permanent bridge. Platforms cannot disappear after completion in this foundation.
5. Call `composeLevel(source, catalog)`. Its diagnostics identify invalid transforms/geometry, unknown recipes/references, duplicate identities, prerequisite cycles, declared required routes depending on optional exhibits, required encounters omitted from the exit's transitive prerequisites, and unsupported or blocked safe pads. It does not prove global reachability: exercise the real controller through every required route and its closed gates.

Compiled identities include level, layout, room, member type and local ID. Reordering arrays does not change them. `contentRevision` is metadata, not an automatic progress reset; moving a saved checkpoint or changing prerequisites still needs a deliberate compatibility decision. The explicit `spawnCheckpoint` controls fresh and reset visits independently of checkpoint sorting. Each layout has a distinct progress namespace; original Glassworks IDs remain unchanged.

`getActiveCourseSolids` is the shared authority for physics, visible proxies and camera obstacles. The renderer consumes `snapshot.activeSolidIds`, so a saved open gate is absent immediately, without depending on an animation. Static imported art needs matching proxies and reviewed dimensions before replacing these visible shapes. Room `cameraBounds` are transformed metadata; this milestone uses mesh obstruction, not a new room-constrained camera or streaming system.

In a games-enabled Vite development server, open `/glass-game/?layout=straight` or `/glass-game/?layout=quarter-turn`. The default `/glass-game/` still opens Glassworks directly without BesideCue onboarding. Development proof content uses a separate package entry; the query selector is excluded from production. There is no public campaign selector, new voice judge, grade system or store-profile change in this milestone.

## Add an exhibit or platform appearance

Register a new breakable `variant` in `BREAKABLE_RENDER_CATALOG`. A recipe names its asset bundle, intact node, shard/persistent node prefixes, display height, glass parameters, optional portrait texture/material and fragment budget. Asset identifiers resolve through `host.assetUrl`; they are not product-specific URLs inside core data. Unknown recipe IDs fail explicitly.

Platform data can set `renderId` to a `PLATFORM_RENDER_CATALOG` recipe, leaving the solid proxy unchanged. The catalog can select a kit mesh and named `MUSEUM_MATERIAL_CATALOG` materials/textures. Adding a visual island or plinth does not add movement mechanics. Keep sculpture, frames and decorative shards out of collision unless an explicit proxy is authored and tested.

Imported meshes need a tested intact-to-fracture correspondence, consistent UV/material mapping, bounded fragment counts and resource disposal. Procedural fallbacks support a playable course while assets load; they are not evidence that art or physical-device performance has passed review.

The Meshy-derived fluted carafe, amphora, coupe and decanter each declare 23 matching fragments. The adapter prepares the entire set before replacing a vessel, retains indexed geometry, UV channels and material groups, and owns imported material/texture copies through disposal. Marble, limestone and brass use separate color, normal and roughness channels with explicit color-space and scale recipes. See `art/glass-adventure/STORAGE.md` for restoring the image masters, provider archives and editable Blender sources through Git LFS. Runtime assets remain ordinary Git files.

## Voice and lifecycle contract

The first supported mechanic is a comfortable held note. The UI discovers a stable comfortable pitch, plays its reference, waits for the audio-clock release and quiet gap, then enables scoring. The default hold is 1.2 s within 150 cents with confidence at least 0.5. A 150 ms breath grace precedes gradual decay. These are game tuning values, not clinical thresholds. The safe interaction radius is currently 0.75 m, with grounded whole-body support on a deck; this intentionally broadens the original 0.30 m blockout proposal.

`PitchObservation` carries a stable sequence, capture-clock seconds and the original capture time mapped to `performance.now()`. `F0Stream.subscribeCaptured` publishes every raw accepted worker result, including silence, independently of render polling. Duplicate, out-of-order, stale, weak and out-of-target frames cannot manufacture hold time. Success uses consecutive valid capture duration; absolute-clock decay prevents double-counting intervals between audio callbacks and slow render frames. High/low and vibrato remain future mechanics requiring their own definitions, judges and tests.

The browser adapter reuses `micManager` and `createF0Stream`; it does not open a second microphone stack. Cancellation releases only its session ID, including a permission grant that arrives after cancellation. The shared detector still has its existing analyser/rAF fallback when AudioWorklet is unavailable; only the worklet/worker path is independent of render cadence. Existing BesideCue games-on build rules still bundle their required ONNX/ORT assets even though this voice path uses YIN.

Each sound owner holds a separate shared-context lease and bus. Cancellation requests a 180 ms release plus 60 ms cleanup allowance. Actual suspended/interrupted states retire its graphs immediately so they cannot replay on resume. A reference rejects unavailable, cancelled, interrupted or stalled output; it never silently permits scoring after an unheard or frozen reference. Old release timers cannot stop a newer sound owner. Physical OS suspension can occur before any scheduled fade finishes.

Pause, background and unmount cancel microphone capture and pending reference ownership. Returning does not automatically restart the voice challenge. Save success separately from scene effects and retain it after falls, reloads or backgrounding.

A visible-window blur only clears held keys, stick/jump contacts and camera capture. It does not open Pause or retire a pending permission request; the host's hidden-page/pagehide/native-inactive events still do.

Movement commits a camera heading that can finish settling after a short step ends. Manual orbit cancels that commitment and owns the view while held; an idle manual view stays put. Movement after released orbit resumes follow with a 0.2 s grace. Zoom only changes distance, so scrolling cannot suppress a turn. Pause, encounters and teleports cancel pending alignment. Recenter retains zoom/pitch, and reduced-motion mode keeps automatic heading rotation off. Merc's visible turn is smoothed independently of physical running speed and jump reach.

Held movement keeps a stable basis so automatic camera rotation cannot steer it into a circle. That reference currently resets on neutral input or manual orbit; continuous changes of stick direction still use the held reference. When a nearby wall compresses the view, bounded steeper camera rays can find room above it; easing and clearance hysteresis retain the player's chosen pitch for open space. This obstruction fallback is not final room-aware framing: the enclosed-level milestone still needs full-character and landing visibility at doorways, corners and ceilings.

## Museum soundtrack

`host.createMusic` is optional so another host can provide or omit its own output adapter. The browser adapter lazily loads the approved M01 museum and M03 garden music with A01/A02/A03 ambience; scene selection is presentation data in `content/soundscapes.ts`. M02 is not used. Audio starts from a player gesture, preserves loop positions across encounters, and stores mute/music/ambience preferences independently from progress.

`ui/soundscape.ts` coordinates voice and playback intent. Microphone permission and audio unlock begin in the Start gesture, but pitch detection waits until `silenceForVoice()` resolves after the soundtrack's release. Cancellation, late loads and foreground recovery cannot restart a retired output. The pause dialog exposes separate music and ambience sliders. Original WAVs and derivation receipts are under `art/glass-adventure/audio/v1`; the shipped five MP3 loops total about 6.2 MB.

## Focused verification

From this package, run `pnpm exec vitest run src/core src/browser`. From `packages/pitch-engine`, run `pnpm exec vitest run src/pitch-f0-stream.test.ts` for the shared observation seam. Core tests walk the real route, test all three authored jumps and closed gates, prove optional completion is independent, and exercise stale/silent/duplicate voice evidence. Browser adapter tests control microphone and Web Audio boundaries; they do not claim native-device performance or microphone usability.

For room composition, run `pnpm exec vitest run src/authoring src/render/camera.test.ts src/render/museum.test.ts`. BesideCue's `glass-adventure-authoring.e2e.ts` covers the development routes and real embedded GLB texture loading under the main app's CSP. Texture images embedded in GLBs need `blob:` in both `connect-src` (ImageBitmap fetch) and `img-src` (image fallback); scripts retain their existing restrictions. Seeded browser saves verify restoration, not earned singing; pure route tests exercise fresh holds through the actual game coordinator. Actual mobile camera/microphone and sustained rendering acceptance remain device checks.
