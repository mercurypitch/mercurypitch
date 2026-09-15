# Glassworks adventure

Scope: first playable floating museum, shared between BesideCue and a standalone web entry. Owner approved manual movement, a follow/orbit camera, required voice encounters, and modular content on 2026-09-14. Later high/low and vibrato galleries remain future work.

## Movement and content

- GA-01: While the museum is active, the game shall move Merc using keyboard or touch controls and shall use voice only within an explicitly started exhibit encounter.
- GA-02: When the player drags the view, the camera shall orbit Merc; when the player releases or cancels that contact, the camera shall stop responding to that contact.
- GA-03: While movement, camera and jump contacts are simultaneous, each control shall retain its own pointer identity.
- GA-04: When the player falls or lands on a catch shelf, the game shall restore a safe checkpoint and retain earned exhibit completion.
- GA-05: While an exhibit gate is closed, its bridge shall provide neither visible passage nor floor collision.
- GA-06: The first gallery shall have three required exhibits, three teaching jumps and three optional panorama exhibits. Optional exhibits shall not be required to reach the exit.
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

## Evidence

Pure route, hold and lifecycle tests live in `packages/glass-game/src`; real mouse, multi-touch and injected PCM browser journeys live in `apps/beside-cue/e2e/glass-adventure-*.e2e.ts`. Art recipes and source provenance live in `art/glass-adventure`. Physical iPhone/Android microphone, frame-rate and suspension acceptance remains an owner playtest.
