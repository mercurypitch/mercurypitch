# B-side games

Small sung mini-games inside Beside Cue. Free, unscored, and never part of
the plan-and-cue contract: they are an optional B-side move someone can pick
as their tiny replacement action.

## Why they live here

Break Glass began as its own Capacitor app (`com.mercurypitch.glass`, branch
`feat/shipaton-glass-game`). Beside Cue already carries a registered
application ID, Android/iOS shells, CI, and RevenueCat through
`@irchiinnuss/mobile-runtime`, so the games shipped into this app instead of
duplicating a store lifecycle. The standalone branch stays as the archive of
the original scaffold and docs.

## Architecture

- `@irchiinnuss/pitch-engine` (`packages/pitch-engine`): mic lifecycle
  (`micManager`), SwiftF0 ONNX pitch detection, the smoothed `createF0Stream`,
  note math, and the target-hum synth. Extracted verbatim from the root app's
  `src/lib`; the root app migrates onto it incrementally.
- `src/games/glass/` — game code. `JourneyPrototype.tsx` is the playable
  stage engine; every tunable lives in `journey-config.ts`
  (`JOURNEY_CONFIG`). It hosts two play modes behind a `variant` prop:
  Merc's Journey (flow — the voice is Merc's position) and Jump Trials
  (platformer — keys/touch pads walk, the voice is the jump, apex = the
  sung note's height). See melody-levels.md for the mode contract.
- `src/games/glass/pitch-assets.ts` points the engine at this app's bundled
  runtime: `public/models/swiftf0.onnx` (committed, 389 KB) and `public/ort/`
  (the onnxruntime-web wasm pair, gitignored; `scripts/sync-ort-assets.mjs`
  copies it from node_modules on predev/prebuild so games work offline in the
  Capacitor webview).
- `src/screens/GamesScreen.tsx` — the paper-world list; entering a game flips
  the record: the stage keeps its own dark world, the chrome (Coiny title,
  custard button, paper text) stays Beside Cue.
- Entry: a discreet card on Home (`.games-entry`). The hardware permissions
  are `RECORD_AUDIO` (Android) and `NSMicrophoneUsageDescription` (iOS); the
  mic is acquired only while a game is open and released on leave.

## Art pipeline

- `public/games/journey/`: three parallax layers (far starfield, screen-blended
  nebula and crystal-dust), two material tiles (crystal, cosmic basalt), and
  four Merc pose sprites. Painterly-cosmos direction, brand palette (navy
  `#05060b`/`#0d1117`, signal blue `#58a6ff`, violet `#bc8cff`, teal
  `#2dd4bf`).
- Backdrops/tiles are generated with the `ask-antigravity` Gemini image skill
  (no Higgsfield credits); prompts live beside the masters in
  `~/agent-out/beside-cue-games/<date>/*.prompt.txt`.
- Merc poses are cropped from the canonical **merc-lumen** sheets in
  `disjoint-colliders/packages/showcase-gallery/assets/characters/merc-lumen/`
  (idle, listening, celebrate, singing). Fly/fall are not drawn: velocity-based
  squash-and-stretch, lean, fall wobble and shed mercury beads animate the
  droplet in code (`art` section of `journey-config.ts`). The listening "o"
  face doubles as the falling face.
- Character system direction: more playable characters (the Beside Cue cue
  creatures among them) later — a character is a sprite set plus accent
  palette, chosen by the player.

## Synthetic-voice E2E harness

For automated playtests without a microphone, override `getUserMedia` in the
page with an oscillator routed to a `MediaStreamDestination` — mint a FRESH
destination per call (a released stream's tracks are stopped by the mic
manager). Driving `osc.frequency` through the level's semitone offsets plays
the whole slice; used via Playwright to verify climb, gate burst, bridge,
wall, glass-crumble fall and both orientations.

## Design contract

- Games gate nothing and are gated by nothing; BeSideCue Pro stays
  support-only.
- Silence is rest, not failure — only glass platforms give way, after their
  configured timeout. This holds at the moment of success too: every pane
  approach spot sits over a platform, and for `pane.rescueMs` after a pane
  bursts, silence glides Merc to the nearest perch instead of dropping him.
  The perch stays unlit — its note still has to be sung to land and advance.
  A stopping voice's downward collapse is filtered out (release-glide
  median), silence over a void sinks slowly before the real fall, and a
  voiced note catches Merc mid-fall while `fall.catchable` — see the
  melody-levels spec ([melody-levels.md](melody-levels.md)) for the full
  feel model and the level system it belongs to.
- Planned input modes beyond voice (tap rhythm, hear-and-select) are specced
  in [input-modes.md](input-modes.md); the mechanics library and the Merc's
  Journey spec live in [game-design.md](game-design.md).
