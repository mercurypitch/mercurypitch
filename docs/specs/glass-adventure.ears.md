# Glassworks adventure

Scope: first playable floating museum, shared between BesideCue and a standalone web entry. Owner approved manual movement, a follow/orbit camera, required voice encounters, and modular content on 2026-09-14. On 2026-09-19 the owner approved forgiving handcrafted museum wings from reusable rooms, 10–15-minute exploratory visits, heading-follow camera with manual override, and continuing the authoring foundation. The two small authoring routes are composition proofs, not completed long levels. Later high/low and vibrato galleries remain future work.

## Movement and content

- GA-01: While the museum is active, the game shall move Merc using keyboard or touch controls and shall use voice only within an exhibit encounter. Museum encounters may begin automatically on entry to their singing circle after an intentional gameplay gesture; platform trials retain their explicit singing action.
- GA-02: While Merc moves, the camera shall smoothly follow his heading. Deliberate camera input shall temporarily override automatic heading alignment. When the player releases or cancels a camera contact, the camera shall stop responding to that contact; automatic alignment shall resume gradually after a quiet interval and movement. Automatic camera motion shall not continuously steer a held movement direction in a circle.
- GA-02a: When the normalized keyboard movement direction changes, including a changed chord without full release, movement shall use the current view as its new reference. Repeated keydown and equivalent direction aliases shall not reset that reference. A continuously held stick shall retain its reference until neutral or manual camera input.
- GA-03: While movement, camera and jump contacts are simultaneous, each control shall retain its own pointer identity.
- GA-03a: When the player begins a touch movement gesture, the visible lower-left movement surface shall acquire only that contact and start at neutral input. Releasing, cancelling or losing that contact shall release its movement ownership. It shall not make unrelated screen contacts move Merc.
- GA-03b: While a movement contact is held, a separate look contact shall remain usable, regardless of which contact began first. Releasing either contact shall not cancel the other or cause an unintended view or movement jump.
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

## Tablet navigation and physical platform support

- GA-30: When Merc travels through an enclosed narrow passage in third-person, the camera shall smoothly frame the path ahead from behind his facing and shorten its follow distance as needed to avoid walls and ceilings. Returning to open space shall restore distance gradually. This framing shall not continuously rotate held movement input.
- GA-30a: When collision redirects established corridor travel, camera follow shall confirm the redirected heading from actual movement before following it. A stationary or teleported player shall not satisfy that travel confirmation; deliberate camera override and the held movement reference shall remain intact.
- GA-31: When the player selects first-person or third-person in the pause/settings controls, the game shall persist the preference separately from campaign progress. V shall invoke the same selection only when gameplay owns keyboard focus. The initial preference shall be third-person.
- GA-32: While first-person is selected, the exploration view shall use a stable eye-height pivot without animated-head bob or self-occlusion. Starting a voice encounter shall frame its target without forcing the third-person side shot. Returning to third-person shall restore usable exploration framing.
- GA-32a: While first-person is selected, lateral movement shall strafe without turning the view. Deliberate look input shall update camera-relative movement; automatic third-person heading changes shall still not steer a held movement direction.
- GA-33: While a scroll platform extends or retracts, its visible deck and physical roller contacts shall use the same platform transform and motion state. Merc shall collide with solid roller sides and be supported by their upper surfaces. Decorative details shall not create invisible support across an authored gap.
- GA-34: When a platform's dimensions or course placement change, the game shall validate saved checkpoint safety against the revised content while preserving earned encounter completion. Simulation traversal and contact probes shall cover full extension, retraction and rotated placement; loaded visual comparison shall establish contact alignment.

## Web listing

Owner decision 2026-09-28: Glassworks belongs to Beside Cue for now. mercurypitch.com serves it without advertising it; dev.mercurypitch.com keeps it listed for testing.

- GA-35: While the web build's Glassworks listing switch (`VITE_GLASSWORKS_LISTED`) is off, as in the production web build, Home shall offer no Glassworks card, the Home tour shall have no step for it, and sitemap.xml, llms.txt and every other document's prelude navigation shall not link `/glass-game`.
- GA-36: While the switch is off, `/glass-game` shall still answer a hard load with the museum document, its staged assets and its service-worker rule, and that document shall ask not to be indexed.
- GA-37: While the switch is on, as in the dev deploy, PR previews and the local dev server, the web build shall list Glassworks on every surface named in GA-35 and its document shall be indexable. The switch shall not affect Beside Cue builds.

## Recorded speech and crystal art studies

- GA-38: While Merc's recorded narration plays, his mouth presentation shall follow the decoded clip's audio clock without reading microphone input or creating another audio context. Capturing the player's voice, hiding or pausing the visit, and retiring a narration source shall suppress that presentation. Hosts without a narration envelope shall remain supported.
- GA-39: Procedural attentive and speech poses shall be bounded layers over the authored animation. Each update shall restore the preceding authored pose before evaluating the next frame. Paused frames shall not advance the pose; reduced motion shall suppress the added idle gestures. Hands, eye morphs and upright jump behavior shall retain their accepted constraints.
- GA-40: A living-crystal art study shall separate its physical glass shell, permanent hardware and dimensional interior. Its walkable support shall match the declared asset dimensions and orientation. Variant palette and animation tuning shall be content data; pausing, reduced motion and disposal shall not leave an independently running effect.
- GA-41: Museum automatic singing shall default on and expose a persisted pause-menu preference and a tutorial explanation. It shall not request microphone access during loading, a tutorial, pause or artwork inspection. A cancelled or failed encounter shall not automatically restart until Merc physically leaves and re-enters its circle. Audio preparation shall originate in a user gesture, own no microphone, and release its audio claim when capture takes ownership or the visit stops.
- GA-42: Development and branch-test builds shall permit entering every gallery and island trial without fabricating progress. Release builds shall require completed preceding galleries, beginning with the prologue, and retain island-trial star requirements. Previewing a future island or using a direct URL shall not bypass release progression. A local earned-progression option may remove preview access but shall not grant release access.
- GA-43: Completion shall present earned difficulty stars, singing accuracy, discoveries and a tappable collected portrait in a compact result card. The primary action shall identify the next level; an available secondary action shall offer the next unearned difficulty. Exact-difficulty replay shall remain in the overflow menu and optional Encore shall remain available without crowding the main actions. Its melody ribbon shall retain readable height in the real game layout at phone, tablet and desktop widths.

## Moving-course readiness and recovery

- GA-44: While a moving course waits for its starting note, the game shall show the comfortable target, the fresh observed note and a direction cue, and distinguish missing detector input from captured silence. Valid capture duration shall accumulate independently of permitted delivery delay; stale, duplicate, future or missing evidence shall not earn duration.
- GA-45: When the player resumes a moving course after falling, including before breaking any glass, the game shall immediately present the safe checkpoint while acquiring audio. Movement and scoring shall stay paused until fresh starting-note evidence and count-in succeed. Retry shall retain earned discoveries and shall not reuse an audio epoch.

## Optional slide-under courses

- GA-46: When a course declares the versioned slide capability, held Slide, Down or S input shall lower Merc's physical collision body and visible pose together. Courses without that capability shall retain their existing movement and omit the Slide control.
- GA-47: Releasing Slide beneath an obstacle shall keep Merc low until the full standing body can safely rise. Sliding shall exclude jumping; airborne slide activation shall be rejected without retaining hidden held intent. Pause, background, recovery and disposal shall clear held slide input.
- GA-48: The course compiler shall reject a slide opening that cannot pass the lowered body, fails to block the standing body, lacks sufficient supported approach or exit runway, or overlaps an incompatible obstacle. Collision shall preserve the visible arch's solid feet and overhead shape.
- GA-49: The development-only Low Arch lesson shall introduce sliding with the existing arch art and preserve the identities and saves of accepted runner courses. Both steering modes shall support independent steering, slide and jump contacts within their physical movement constraints.

## Evidence

Pure route, hold and lifecycle tests live in `packages/glass-game/src`; real mouse, multi-touch and injected PCM browser journeys live in `apps/beside-cue/e2e/glass-adventure-*.e2e.ts`. Art recipes and source provenance live in `art/glass-adventure`. Physical iPhone/Android microphone, frame-rate and suspension acceptance remains an owner playtest. GA-35 to GA-37: `scripts/assert-glassworks-listing.mjs` on every web build, `tools/glassworks-listing.test.ts`, `src/tests/home-destinations.test.tsx` and `src/e2e/glass-game.spec.ts`.
