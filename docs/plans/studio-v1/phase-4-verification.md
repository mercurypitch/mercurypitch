# Phase 4 verification: editing and song assembly

Date: 26 October 2026. Built on `7fd71bac1`; the phase commit containing this receipt identifies the complete source. Local browser evidence does not establish physical-device or listening acceptance.

## Implemented

Desktop and tablet now support direct clip moves, head/tail trims, source-anchored fades, snapping, horizontal edge scrolling and an explicit New lane drop target. Occupied placement restores the original clip and explains the conflict. Pointer previews commit once; cancellation, revision changes, lease loss and view changes discard them. Keyboard nudges, split, duplicate, copy/paste, delete and track mute/solo have focus-scoped shortcuts and undo. Narrow clips retain focus after an editing handle disappears.

External audio drops import a batch onto new lanes at the drop time as one undoable edit. Kept-take drag cancels any pending preview read. Repeat schedules successive cycles on the audio clock while retaining lane FX. Backup, restore and project copies now admit retained audio and archive working copies against the shared memory budget before allocation, and release the reservation with its result.

Both approved themes, speaker/slash Mute and readable S Solo remain in place. CI feedback also led to smaller playback, waveform and gesture functions, a state-based pause assertion and a specific Studio browser-chrome color expectation. No metric baseline or quality gate was weakened.

## Checks

- Focused arrangement, playback, feature and persistence pass: 26 files, 170 tests. The storage/archive admission pass covers 23 tests. After the final complexity refactors, the affected playback/timeline/source-picker pass covers 13 files, 62 tests.
- Seven real-browser editor `@smoke` cases passed: scrolled move/Undo/cancel; occupied-drop rejection and explicit new lane; source-offset head/tail trims; retained fade anchors; keyboard edits/history; native touch scroll versus selected drag; extreme-trim focus recovery. The drag tests include meaningful red-to-green evidence.
- Five existing Studio browser cases passed: import/reload/backup restore, writer takeover, both themes and numeric edits, tablet/phone controls and four-lane playback. Two additional browser cases passed for a two-file drop with one revision/Undo and repeat wrapping without stopping.
- Final emitted-bundle regression: all fourteen browser cases passed together in 49.8 seconds. The entry-page model suite passed all 57 tests after correcting the Studio theme expectation. Scoped lint and staged diff checks passed.
- Tests use synthetic PCM fixtures. File drops use the browser DataTransfer API; they are not physical operating-system file-drag acceptance. Tablet input uses Chromium touch events, not a physical tablet.

Raw evidence is retained in registered run `65ec899582844d85b822516ac60d308e`: `scratch/raw-logs/phase4-red/`, `phase4-green/`, `playwright-phase4-foundation/`, and `playwright-phase4-drop-repeat/`. Final emitted-bundle regression evidence is in `playwright-phase4-checkpoint/` and `studio-phase4-checkpoint.json`.

## Limits

The lightweight build emits the app before its separate Glassworks asset staging rejects the retained LFS pointer `glass3d/merc-v2.glb`. No large assets were fetched or guard bypassed. Browser evidence uses the emitted Studio bundle; this is not a successful full local build. GitHub Build & Deploy App passed for `7fd71bac1`; the phase commit needs its own CI.

Song Sound controls, level-matched comparison, continuous loudness meters and final encoded WAV measurement are Phase 5. Looping retains FX state; a fresh seek still initializes it after silent warmup rather than reconstructing prior reverb. The complete tour will accompany the finished sound/export controls. Physical tablet/phone testing, real-recording audition and owner acceptance remain Phase 6.
