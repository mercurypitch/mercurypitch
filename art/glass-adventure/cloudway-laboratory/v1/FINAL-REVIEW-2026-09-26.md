# Crystal Promenade final device handoff — 26 September 2026

This pass responds to the owner's camera, platform spacing and floating-museum loading feedback. The owner authorized review and merge for Android/TestFlight testing. It does not approve a public store release or the remaining sixteen source donors.

## Delivered behavior

- A floating thumb pad acquires only a touch on the game surface within the lower-left movement area. Mouse orbit and other UI remain usable; move, look and jump keep separate pointer ownership. Blur, pause and encounter state release or invalidate pending movement/turn intent.
- Gallery follow is calmer and bounded. A held thumb gesture keeps its movement basis; manual orbit persists until a fresh movement gesture or recenter. Authored platform sections change composition after stable landings and automatic route yaw freezes during jumps.
- Safe courts join two unscaled Pearl modules. Challenge platforms stay separate: 0.70 m before and after the fully extended scroll, 0.55 m at arrival and 0.50 m around the crystal duet. The Rose landing gives two seconds and Amethyst four seconds. Static courts retain singing/checkpoint anchors; all three voice challenges are required before the exit opens.
- Crystal Promenade has a Preview card in B-side Games for games-enabled owner builds. Production ignores the local development-layout query. The private level editor is not bundled in the application.
- The floating-museum error was reproduced as unresolved Git LFS pointer text in local GLB responses. Nine exact required runtime files were hydrated. URL-aware loader guards, cancellation and late-disposal tests now identify this failure without obscuring a navigation cancellation.

## Validation and review

Final local shared-game verification after the main rebase and camera extraction passed **121 files / 869 tests**. V8 coverage of exercised source: **92.30% lines, 90.57% statements, 83.60% branches and 91.58% functions**. This is not a whole-application 100% claim. `pnpm pr:prepare`, the shared package check and Beside Cue typecheck passed. Remote checks on PR #863 remain the authoritative full gate before its authorized merge.

- Real browser interaction: camera 5/5, controls 9/9, explicit phone voice-blur 1/1 and the complete mobile flow 7/7 (short/narrow portrait, landscape, tablet, desktop, locked exit and native Preview entry). Controls include actual mouse orbit in the enlarged touch area and simultaneous movement, look and jump.
- The mobile flow now verifies a canvas-backed touch origin, active-pad acquisition, actual travel in both directions and visible-control separation. It caught a real 2 px Sing/thumb-pad overlap on narrow phones; lifting the offer resolves it without relaxing the overlap assertion. Independent review also caught the related caption clearance under an iPhone bottom safe area. Moving the stack with the offer leaves 9.52 px at zero inset and 12.52 px at a 34 px inset, measured against the full offer wrapper on 320 × 740 and 390 × 844 viewports with the browser safe-area override.
- CI includes all 23 automatic adventure spec files, including the previously omitted cloudway-layouts and message-stack files. Two additional actual-render proof specs remain explicitly opt-in.
- The phone blur regression preserves real CDP touch acquisition, movement greater than 0.03 m, bounded braking, stale-contact rejection and fresh-contact movement. Controlled simulation time isolates these input checks from software-rendering throughput; the final CI-mode repeat passed 3/3. Real microphone test timing is unchanged.
- Pure helper coverage: floating-stick, route-camera and camera-heading-intent each reached 100% lines/statements/branches/functions. Museum resources reached 100% lines/statements/functions and 96.66% branches across 15 cases, including the real Three parser. The bundled-audio response helper added in PR861 reached 100% in all four metrics with six cases.
- Independent review found and resolved held-stick turn intent surviving pause/encounter. It also verified asset ownership/disposal, repeated-platform instancing, native inventories, Preview entry and camera/manual-input semantics. PR861 review additionally fixed iOS status-0 bundled Encore audio.
- After the main rebase, all 180 required local runtime game files were nonempty real deliveries; no unresolved LFS pointer remained in the required inventory.
- Twenty-four focused course/asset/renderer cases verify exact GLB hashes, certified contact, 30/60 Hz traversal, deliberate falls through gaps, scroll timing, checkpoints and a locked exit. No collision widening hides an intended gap.

## Actual visual evidence

Heavy evidence lives under the Proton-linked `source-assets/proofs/runtime/` directory. Copies and hashes were checked locally; cloud synchronization is not inferred.

- `2026-09-26-final-review/mercurypitch-gallery-5301-20260926.png`: loaded floating museum with three islands, stairs, ponds and portrait displays.
- `2026-09-26-final-review/mercurypitch-museum-5301-20260926.png`: actual loaded Glassworks room.
- `2026-09-26-final-review/after-normal-arrival-scroll.png`: actual 1600 × 900 Promenade normal-play view, SHA-256 `8c7d81ccd3e8e58625069ebe4e7273469ac7ac5445e26b8ce870583b27138349`.
- `2026-09-26-final-review/floating-stick-active-overlay.png`: phone control-layout proof only; its flat background is not accepted as scene-art proof. SHA-256 `034622a527cb673170b2d020d0ac782a642be1dcf23c9fe15b2b3b5af08e7c5d`.
- `crystal-promenade-first-slice/2026-09-26-final-review/after-elevated-scroll-gaps.png`: actual 1280 × 960 view of both clear scroll gaps, SHA-256 `ba1b85a770d615d0963f6d4d735e4e8d2b2e1df20c1e8936be6d7d4ec750e2b3`.
- `crystal-promenade-first-slice/2026-09-26-final-review/after-elevated-crystal-duet.png`: actual 1280 × 960 view of the separated timed landings and final court, SHA-256 `6c984dd7a299a0fdac676e34d36d60065ff9a81feb65c3c1f08b03c13b409bd5`. Existing orbit/zoom inputs and version-2 checkpoint restores produced these views; they are not a recorded full playthrough.
- Historical before and fresh after images are separately labelled in `crystal-promenade-first-slice/2026-09-26-final-review/`.

## Device acceptance

Open B-side Games → Crystal Promenade (Preview). Test a continuous thumb movement, a second finger to look, jump while steering, camera recovery after singing, the two scroll gaps and the two-/four-second crystal landings. Complete all three voice rests, verify checkpoint recovery after a fall and pass through the unlocked exit. Also reopen Glassworks and the floating museum.

The four prepared GLBs total 35,516,820 bytes. Their authored geometry includes mutually exclusive intact/fractured states. They preserve reviewed source detail and use bounded runtime maps; physical-device sustained performance remains an acceptance check. SwiftShader capture time is not native FPS evidence. Remaining donor finalization and a longer exploratory course stay separate followups.
