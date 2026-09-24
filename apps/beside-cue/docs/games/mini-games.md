# B-side games

Small sung mini-games inside Beside Cue. Free, unscored, and never part of
the plan-and-cue contract: they are an optional B-side move someone can pick
as their tiny replacement action.

## Public release boundary

Beside Cue v1 goes to the stores without the games (maff, 2026-09-14): they
cannot be polished enough for a first review. They come back in a later
release, which is reviewed with them. Never as a remote switch on a shipped
build: App Review guideline 2.3.1 forbids hidden features turned on later.

Owner testing builds now include the games while that public release remains
distant. The distinction is the ref, not a runtime switch: pull requests,
pushes to `main`, and non-tag manual workflow runs use the explicit native
games profile; a `bc-v*` release tag still builds the canonical games-off
profile. Both sides are guarded against carrying the other profile's assets or
permissions.

- The build decides. `VITE_BESIDE_CUE_GAMES=1` builds the games in; unset,
  `vite.config.ts` resolves `@/games/entry` (`src/games/entry.ts`, the one
  way in) to a stub, so the Home entry is not rendered and no games module,
  pitch engine or onnxruntime wasm reaches the bundle. Vite also excludes
  public game, model and runtime files from the output, preserving their sources.
  App unit tests cover the off entry while game unit tests still run directly.
  Playwright uses separate servers: the existing suite enables games, and a
  store smoke test checks their absence.
- The canonical store projects still declare no microphone access. The
  explicit `native:games` profile selects the Android games manifest and
  generates a separate iOS Info.plist containing the microphone purpose; it
  never rewrites either store source. `src/games/glass/mic-permissions.test.ts`
  keeps the default profile honest.
- The store texts, the privacy notice and the App Store privacy answers then
  describe on-device microphone use again.

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
  runtime, and App.tsx's games loader imports it before the games screen:
  `public/models/swiftf0.onnx` (committed, 389 KB) and `public/ort/`
  (the onnxruntime-web wasm pair, gitignored). `scripts/game-assets.ts` copies
  the runtime from node_modules for games-enabled Vite dev servers and directly
  into enabled build output, including native CI builds, so games work offline
  in the Capacitor webview. Package lifecycle hooks are not required.
- `src/screens/GamesScreen.tsx` — the paper-world list; entering a game flips
  the record: the stage keeps its own dark world, the chrome (Coiny title,
  custard button, paper text) stays Beside Cue.
- Entry: a discreet card on Home (`.games-entry`), rendered only in a build
  with the games. The hardware permissions are `RECORD_AUDIO` (Android) and
  `NSMicrophoneUsageDescription` (iOS), both removed while the games are out
  (see Not in v1); the mic is acquired only while a game is open and released
  on leave.

## Native test profile

`pnpm native:games --platform android --build` and the equivalent `ios`
command build the games-enabled web app, stamp the exact offline asset
allowlist into a provenance marker, run Capacitor sync, and verify every
declared byte in the copied native tree. Android debug builds additionally use
`-PbesideCueGames=1`; iOS simulator builds point
`BESIDE_CUE_INFO_PLIST_PATH` at the generated games plist. The dedicated
`beside-cue-games-native.yml` workflow remains the short unsigned smoke test
for both platforms. The distribution workflow also uses this profile on every
non-tag owner testing build:

- Android keeps the games-enabled debug APK as a GitHub Actions artifact. When
  the upload-signing secret is present, it also keeps the signed release AAB
  and APK for a manual Google Play internal-track upload. There is no Google
  Play publisher or service-account credential in the workflow, so nothing is
  uploaded to Play automatically. A sideloaded APK uses the RevenueCat Test
  Store; Play Billing requires the Play-installed AAB.
- A pull request builds and signs the games-enabled iOS archive but does not
  upload it. A push to `main` uploads the games-enabled archive to TestFlight
  automatically. A manual workflow run on a non-tag ref also uploads under the
  current `main-and-tags` policy. App Store Connect signing secrets must be
  present for either archive or upload.
- A `bc-v*` tag ignores the testing-profile inputs and uses the canonical
  games-off Android manifest, iOS plist, and web output. Its original 90 MiB
  warning and 150 MiB failure budgets remain unchanged.

CI hydrates only the native runtime paths before a games build:

```text
apps/beside-cue/public/games/**
apps/beside-cue/public/models/**
apps/beside-cue/public/ort/**
```

The games-enabled web tree measured 378.07 MiB unpacked and 288.72 MiB with
ordinary ZIP compression on 2026-09-24, so preview Android packages use a
separate 300 MiB warning and 340 MiB failure ceiling. This is a testing budget,
not a public-store size claim; release tags retain the smaller budget above.

The iOS target validates that pairing on every build. `App/App/public` is an
ignored Capacitor output, so a games playtest can leave its web bundle there
after the test ends. Before a normal store archive, replace that output with a
games-off build:

```bash
VITE_BESIDE_CUE_GAMES=0 pnpm --filter @irchiinnuss/beside-cue-app exec vite build
pnpm --filter @irchiinnuss/beside-cue-app exec cap sync ios
cd apps/beside-cue/ios/App
xcodebuild -project App.xcodeproj -scheme App -configuration Release \
  -archivePath build/BesideCue.xcarchive archive
```

That archive uses the canonical `App/Info.plist`. The build fails if the copied
web tree still contains any game, model, runtime, or games-profile marker. The
unsigned games test profile stays a separate command and plist:

```bash
pnpm --filter @irchiinnuss/beside-cue-app native:games -- --platform ios --build
cd apps/beside-cue/ios/App
xcodebuild -project App.xcodeproj -scheme App -configuration Debug \
  -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' \
  BESIDE_CUE_INFO_PLIST_PATH=build/games/Info.plist \
  CODE_SIGNING_ALLOWED=NO build
```

The games build also checks the stamped SHA-256 manifest immediately before
Xcode copies resources, so changing or dropping a declared offline asset after
Capacitor sync stops the package.

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

- Games gate nothing and are gated by nothing; Beside Cue Deluxe stays
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
