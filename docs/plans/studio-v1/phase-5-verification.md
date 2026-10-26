# Phase 5: Sound, meters and delivery

26 October 2026. The commit containing this receipt is the Phase 5 source checkpoint. The PR remains draft for acceptance.

## Implemented

- Sound exposes seven flavours, five centre-zero macros, three loudness targets and explicit Auto-balance. A pointer drag commits one undoable edit. Escape cancels the entire gesture, including subsequent pointer movement before release.
- Compare prepares the current revision without autoplay. Before and After retain the same playback position and match the quieter side through attenuation only. Editing invalidates prepared audio.
- Export freezes the project, reports real rendering/measurement stages, supports cancellation and offers an explicit WAV download only after measuring the encoded bytes. It never presents the target as an achieved result.
- Live output shows L/R sample peaks, held peaks, clipping, 400 ms momentary LUFS and 3 s short-term LUFS. The full Sound panel includes peak-hold reset. Export reports integrated LUFS, sample peak and estimated true peak.
- Playback uses preview levels until Export or Compare supplies whole-song measured settings. This is stated in Sound. Applying measured settings while paused does not start playback.
- Both themes remain available. Mute uses the speaker/slash icon; Solo uses a readable S with a complete accessible label. Phone keeps adding, mixing, Sound, Export and playback reachable; arranging remains the desktop/tablet surface.
- Studio has a permanent tour ID, library and workspace tours, and responsive selectors for desktop, tablet and phone. Optional controls are included only when their real mounted targets exist.

## Verified locally

The [DSP receipt](phase-5-dsp-verification.md) records 245 focused tests, the 87-fixture FFmpeg comparison, an actual downloaded browser WAV and native worklet shutdown proof. The output file measured −14.0 LUFS and −9.4 dB true peak in FFmpeg. This is one synthetic song, not listening acceptance.

The six Sound/Export/Compare suites pass 27 focused tests. Meter presentation and the panel/tour tests also pass. A browser pass against the emitted application passed all four selected interactions in 18 seconds: matched Compare, Escape during a macro drag, touch Sound/Export at 1024 and 390 pixels in both themes, and tablet/phone mix reachability. Earlier real native export and cancellation cases passed; the combined final-source regression belongs to the Phase 6 receipt.

Responsive testing found the phone transport covering header actions after a positioning change. The phone transport now belongs directly to the workspace; it remains in the panel footer while a panel is open. The repaired test taps Sound, edits a macro, exports/downloads a WAV, verifies a 44-pixel download target, checks horizontal overflow and confirms focus returns to Export.

The existing database upgrade test used fixed version 120, while Studio installs version 130. Its intended upgrade to 130 therefore performed no upgrade. The fixture now reads the actual opened version before requesting a higher one. All four original lifecycle, banner and blocked-upgrade browser assertions pass unchanged.

The code-health ratchet passed without changing its baseline. Scoped lint/format checks passed. Raw logs and traces are in registered run `65ec899582844d85b822516ac60d308e`, outside the creative handoff. Selected theme/device screenshots are preserved in the personal Studio directory under `implementation/phase-5/`.

## Build and acceptance limits

This remains a lightweight checkout: all 1,514 LFS entries are pointers. Vite emits the app and service worker used for these browser checks, then the existing Glassworks asset guard fails on `glass3d/merc-v2.glb`. The full local build is therefore not claimed successful. The guard was not weakened, and large assets were not downloaded.

The finite true-peak estimator is not certified; observed reference differences and the 0.75 dB engineering margin are documented in the DSP receipt. Browser-private memory remains an estimate within admission checks. Physical tablet/phone, Safari/WebKit, maximum admitted projects and headphone/speaker listening remain explicit acceptance items. No production testing, merge or release occurred.
