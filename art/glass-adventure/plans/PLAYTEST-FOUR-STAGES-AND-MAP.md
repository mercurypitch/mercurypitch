# Floating Museum — next owner playtest

This checklist covers the shared campaign, current reward pilot and new live
map. Use a local HTTPS preview on tablet or the explicitly games-enabled native
test build. The normal store profile still hides games. No release is implied.

## Map and transitions

1. Select each island by tapping it and by using its named selector. Selection
   should move Merc/focus without entering a gallery. Dragging the scene or
   cancelling a touch must not select or enter something accidentally.
2. On phone, check the selected gallery and Enter action without a long scroll.
   On tablet, check the whole island chain, especially the Conservatory at the
   right. The catalogue below remains a second way to enter any gallery.
3. Look at the actual waterfalls: the surface should move downward, its edges
   should move, and water should spill outside the marble/cliff surface. This
   is the useful visual check; particles alone do not count as water motion.
4. Start sound with a selection or the sound control. Mute, background the app,
   and return. Backgrounding must stop sound; returning alone must not start
   it unexpectedly. Entering a gallery must fade the map sound out first.
5. Enter and leave two galleries, then repeat. Expect one map/one active game,
   preserved selection and progress, no doubled music, and no growing delay.
6. With device reduced motion enabled, check that the map remains understandable
   without continuous camera/Merc/water motion. The direct catalogue remains
   usable if WebGL fails.

## Existing galleries and new lesson

- **First Light:** quick regression for controls, mic permission, holding a
  comfortable note, gate and finish. This remains the prologue.
- **Glassworks Journey:** optional exploration is separate from assessed
  singing. There are five finite discovery tokens. Break the final portrait,
  check its collected state, finish, then replay/reload. The collection and
  personal best must survive, and tokens must not duplicate.
- **Twin Galleries:** inspect the new Amber Urn and its fracture. Check the
  lower note, higher note and ordered pair once. The current fluted decanter
  remains until the replacement Celadon source clears its production gates.
- **Resonance Conservatory:** first settle on a comfortable note, then let it
  gently sway twice. Listen to the demonstration first. A steady hold alone
  must not pass the wave step. A breath should preserve the settled note while
  restarting the wave attempt. Cancel/replay/find-note should reset cleanly.

## Reading the score honestly

The first reward pilot grades **only the final Journey portrait**, not the
whole level. Its stars use reliable, fresh captured pitch and time spent near
the target; volume is not a score. Insufficient reliable evidence stays
ungraded. Existing old completions do not acquire invented stars. Discovery
tokens reward optional exploration, and neither tokens nor stars lock progress.

Device feedback that matters most: whether the wave demonstration is easy to
follow, whether the first successful attempt feels fair, and whether repeated
attempts feel consistent. Synthetic-microphone automation cannot answer these.

## Evidence and remaining decisions

- Packed sources, receipts and rendered model proofs:
  `../journey-map/v2/`.
- Water-motion and reduced-motion evidence:
  `../journey-map/v2/water-study/`.
- Native build identities and seven-day artifact expiry:
  `../delivery/v1/proofs/native-ci-checkpoint.json`.
- Exact Celadon guide upload is pending the separately requested approval.
- Physical-device sustained frame rate, heat and mic/audio-session behavior
  still need owner testing. Emulator/SwiftShader proofs are not those results.
- More chapters, the full portrait album, recorded sung finales and sharing
  remain planned follow-ups, not features of this playtest.

## Current static preview

Built 2026-09-21 from the runtime saved as `f0d0c68a` (before the commit, so the
embedded build stamp can show the preceding commit with a dirty marker).

- Tablet: https://192.168.178.33:5291/glass-game/?campaign=1
- Desktop: https://localhost:5291/glass-game/?campaign=1
- HTTPS uses the existing LAN certificate; the LAN URL returned HTTP 200 with
  certificate validation. This is a compiled snapshot, with no HMR.
- Build output: `/tmp/glass-floating-museum-preview` (temporary, reproducible).
- The current server expires three hours after startup. A manual restart below
  runs for three hours or until its terminal is stopped with Ctrl+C. The port
  is strict: do not start another copy while this one is still running.

Restart from any directory:

```sh
env PATH=/home/maff/.nvm/versions/node/v22.22.2/bin:/home/maff/.local/bin:/usr/local/bin:/usr/bin:/bin VITE_BESIDE_CUE_GAMES=1 timeout 10800 pnpm --dir /home/maff/.codex/worktrees/00ad/mercurypitch-agent/apps/beside-cue exec vite preview --mode https --outDir /tmp/glass-floating-museum-preview --host 0.0.0.0 --port 5291 --strictPort
```

If reboot removed the temporary build, recreate it first:

```sh
env PATH=/home/maff/.nvm/versions/node/v22.22.2/bin:/home/maff/.local/bin:/usr/local/bin:/usr/bin:/bin VITE_BESIDE_CUE_GAMES=1 timeout 420 pnpm --dir /home/maff/.codex/worktrees/00ad/mercurypitch-agent/apps/beside-cue exec vite build --outDir /tmp/glass-floating-museum-preview
```
