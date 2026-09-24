# Glassworks adventure

Scope: first playable floating museum, shared between BesideCue and a standalone web entry. Owner approved manual movement, a follow/orbit camera, required voice encounters, and modular content on 2026-09-14. On 2026-09-19 the owner approved forgiving handcrafted museum wings from reusable rooms, 10–15-minute exploratory visits, heading-follow camera with manual override, and continuing the authoring foundation. The two small authoring routes are composition proofs, not completed long levels. Later high/low and vibrato galleries remain future work.

## Movement and content

- GA-01: While the museum is active, the game shall move Merc using keyboard or touch controls and shall use voice only within an explicitly started exhibit encounter.
- GA-02: While Merc moves, the camera shall smoothly follow his heading. Deliberate camera input shall temporarily override automatic heading alignment. When the player releases or cancels a camera contact, the camera shall stop responding to that contact; automatic alignment shall resume gradually after a quiet interval and movement. Automatic camera motion shall not continuously steer a held movement direction in a circle.
- GA-02a: When the normalized keyboard movement direction changes, including a changed chord without full release, movement shall use the current view as its new reference. Repeated keydown and equivalent direction aliases shall not reset that reference. A continuously held stick shall retain its reference until neutral or manual camera input.
- GA-03: While movement, camera and jump contacts are simultaneous, each control shall retain its own pointer identity.
- GA-04: When the player falls or lands on a catch shelf, the game shall restore a safe checkpoint and retain earned exhibit completion.
- GA-05: While an exhibit gate is closed, its bridge shall provide neither visible passage nor floor collision.
- GA-06: The first gallery shall have three required exhibits, continuous same-height floor joins, one raised teaching jump and three optional panorama exhibits. Optional exhibits shall not be required to reach the exit.
- GA-07: A new level shall be describable with stable content IDs, platform bounds, checkpoint positions, exhibit definitions and exit requirements. Visual variants shall resolve through render recipes, independently of collision and scoring.

## Voice, ownership and persistence

- GA-08: When the player chooses Sing near an eligible supported exhibit, the game shall lock movement and acquire microphone ownership for that encounter.
- GA-09: When no comfortable note has been saved, the game shall discover it from fresh stable captured pitch, then play a reference before enabling hold scoring.
- GA-10: While the reference or its quiet gap is playing, captured sound shall not earn completion.
- GA-11: Hold scoring shall credit consecutive fresh, confident, in-target capture duration. Silence, stale or repeated observations shall not manufacture progress. Scoring shall not depend on animation polling frequency.
- GA-12: When a required hold succeeds, the host shall save completion before fracture presentation and sound; restoring that save shall open the appropriate bridge without replaying fracture effects.
- GA-13: When the player cancels, pauses, leaves, backgrounds the app, or encounters an audio interruption, the game shall retire capture and pending reference ownership. Returning shall require an explicit action to restart capture.
- GA-14: If microphone access or reference playback fails, the game shall offer recoverable guidance and shall not award completion.
- GA-15: When the player reaches the unlocked exit, the game shall show completion and offer a fresh replay of the gallery.

## Presentation and host boundary

- GA-16: On first entry, the game shall offer a two-page skippable tutorial; Help shall make it available again.
- GA-17: Keyboard focus shall stay inside an open dialog, and keyboard activation of focused buttons shall remain available alongside movement shortcuts.
- GA-18: The same game surface and simulation shall support web and native hosts through injected assets, persistence, microphone, audio and foreground lifecycle services.
- GA-19: Default store builds shall omit the game entry and game assets. Explicit native games builds shall pair the games payload with microphone declarations.
- GA-20: Fracture effects shall use bounded fragment counts and release their owned graphics/audio resources when the visit ends. Reduced-motion mode shall reduce fracture motion without changing completion rules.

## Focus and reusable room foundation

- GA-21: When a visible browser window loses focus, including to a microphone permission prompt, the game shall release held movement/jump/camera contacts without opening Pause or cancelling a pending microphone request solely because of that blur. Actual hidden-page, pagehide and native-inactive events shall still cancel capture and pause the game, including requests whose permission resolves afterward.
- GA-22: A handcrafted room instance shall compose its visuals, floor/solid proxies, exhibit anchors, checkpoint positions/facing and connection ports using one local transform. The initial authoring system shall accept translations and quarter-turn yaw and reject unsupported transforms with an actionable diagnostic.
- GA-23: Compiled IDs shall derive from authored level/layout and instance identities rather than array order. Reordering instances shall not change completion identity. Moving geometry shall not be assumed save-compatible without validating the affected checkpoint/route.
- GA-24: The authoring validator shall reject duplicate or missing references, cyclic prerequisites, mandatory dependencies on optional encounters, required encounters omitted from the exit's transitive prerequisites, unsupported spawn/checkpoint/encounter pads and mismatched connection ports. Static validation shall not be presented as proof that the route is physically traversable.
- GA-25: When a permanent solid gate opens after a successful encounter, both collision and visible gate state shall derive from the saved completion. Restoring progress shall restore an open gate independently of any interrupted opening animation.
- GA-26: Two different small routes shall reuse the same room kit, including a quarter-turned room. Selecting a proof route shall preserve the original Glassworks route and its save. The proof selector shall be a development entry, not a public campaign or store-game enablement change.
- GA-27: Room sound regions and scene/light bounds for authored routes shall be declared as data. Adding another supported route shall not require route-ID branches in rendering, movement or audio lifecycle logic.
- GA-28: Camera obstruction, input release, earned gates and microphone cancellation shall remain correct in both original and authored routes. Physical phone/tablet performance and camera usability require device acceptance in addition to automated tests.
- GA-29: When the main app loads GLB assets with embedded texture images, its Content Security Policy shall allow the local blob fetch/image paths used by the loader while retaining existing script and remote-network restrictions. A missing embedded texture shall not count as a successful texture-loading regression check.

## Evidence

Pure route, hold and lifecycle tests live in `packages/glass-game/src`; real mouse, multi-touch and injected PCM browser journeys live in `apps/beside-cue/e2e/glass-adventure-*.e2e.ts`. Art recipes and source provenance live in `art/glass-adventure`. Physical iPhone/Android microphone, frame-rate and suspension acceptance remains an owner playtest.
