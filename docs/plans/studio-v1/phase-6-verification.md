# Phase 6: browser acceptance

26 October 2026. Tested the emitted application from source commit
`c6fd199200b7a3b45d36ac93b0cf6f222898d63d` on localhost. The independent
acceptance flow passed all eight stages. This is browser acceptance, not a
production release or physical-device/listening sign-off.

## Complete song workflow

The pass used actual browser buttons, file inputs, keyboard edits, a mouse drag
and browser downloads. IndexedDB was read only to verify the resulting data;
project records were not seeded or changed through a test bridge. Welcome and
plan preferences were initialized before opening the integrated Studio tab.

1. Created and named a local song.
2. Imported an original generated twelve-second melody encoded as real 44.1 kHz
   mono MP3, plus a separate twelve-second 48 kHz stereo rhythm WAV. The MP3
   became canonical 48 kHz audio while its original bytes remained intact.
3. Moved the rhythm one second right with the mouse. Trimmed the melody to source
   bounds 0.25–11.5 seconds and added a 50 ms fade-in and 300 ms fade-out through
   the numeric controls.
4. Played the arrangement, observed nonzero output meters, muted the melody,
   soloed the rhythm, restored both lanes, paused and returned to the start.
5. Selected Warm, adjusted Tone and ran Auto-balance. Lane volume and pan stayed
   unchanged while the separate balance gains changed.
6. Reloaded and reopened the same saved project without autoplay. Its persisted
   arrangement and sound settings matched the pre-reload snapshot.
7. Downloaded a 9,270,451-byte `.mpstudio` backup and restored a copy. The restored
   project and assets received new IDs at revision 0; the original revision-15
   project remained unchanged. Both stored original MP3 copies and the source
   file had the same SHA-256 hash.
8. Played the restored song, rendered its complete WAV and explicitly downloaded
   it after measurement. Rendering alone caused no download.

A separate development-server check opened the backup in a completely fresh
browser profile and database: one new project, two clips/assets, unchanged MP3
bytes and no autoplay. The final emitted-bundle run had no page exceptions or
failed requests. Its isolated browser remained off the user's visible workspace;
the foreground window was unchanged at every recorded milestone and after close.

## Downloaded audio

The delivered file contains 48 kHz stereo signed 16-bit PCM, lasts 14.770333 seconds
including effect tails, and occupies 2,835,948 bytes. Its RIFF/data lengths and
nonzero sample energy were checked from the actual download. FFprobe independently
confirmed the format and duration; FFmpeg `ebur128=peak=true` measured the file.

| Measurement         | Studio output | Independent file check         |
| ------------------- | ------------- | ------------------------------ |
| Integrated loudness | −14.1 LUFS    | −14.1 LUFS, FFmpeg             |
| Sample peak         | −2.5 dBFS     | −2.4593 dBFS, direct PCM scan  |
| Estimated true peak | −2.4 dBTP     | −2.4 dB, FFmpeg true-peak mode |

The selected target was −14 LUFS and the peak ceiling was −1.5 dBTP. These results
describe this synthetic song; they do not establish a certified estimator or
subjective sound quality. Hashes and format details are preserved in the
[sanitized result](evidence/phase-6-browser-result.json).

## Issues found and repaired before acceptance

The initial MP3 pass found a native scheduling failure with the exact legal fades
above: separately calculated adjacent gain-curve times overlapped through
floating-point rounding. Curve durations now derive from their absolute endpoint
times. A native matrix reproduced 1,154 failures across 4,096 start times before
the repair and zero afterward. The full acceptance rerun kept the same fades.
The source-controlled browser regression is
[`studio-audio-envelope.spec.ts`](../../../src/e2e/studio-audio-envelope.spec.ts).

Independent audio ownership review also found retained reverb caches outside the
released memory budget, cancellation beginning another full render after a latency
probe, and disconnected meter worklets continuing to process empty input. The
repairs give reverb caches active owners, check cancellation between native stages,
and stop meter processors through an acknowledged shutdown before releasing their
reservation. Focused regressions and native shutdown evidence are recorded in the
[Phase 5 DSP receipt](phase-5-dsp-verification.md).

Raw screenshots, traces, downloaded files and the machine-specific acceptance
driver remain in registered run `65ec899582844d85b822516ac60d308e`, under
`scratch/raw-logs/phase6-browser-final-c6fd1992/`. The driver is not linked here
because it contains local paths.

## Combined regression and integration checks

The same emitted source passed all 28 selected Playwright cases in 1.5 minutes:
24 Studio cases plus four database-upgrade cases. Coverage includes actual mouse
and touch edits, occupied-drop rejection, explicit new lanes, numeric editing,
undo/redo, source-anchored fades, native envelope scheduling, matched Compare,
export cancellation, measured WAV downloads, both themes, mobile panels,
fresh-profile backup restore, writer takeover, repeat, live meters and all three
responsive tour layouts. The report is retained as
`scratch/raw-logs/studio-phase6-rebased.json` in the same registered run.

CI on `c6fd1992` identified overly narrow audio-node/test types and formatting in
one evidence JSON file. The acceptance commit corrects these type annotations,
test lookups and formatting without changing application runtime behavior. Its
root TypeScript check passes after these corrections. Its own CI results remain
the authoritative gate; local browser proof is separate.

## Remaining acceptance

- Physical tablet/phone and Safari/WebKit behavior, including audio interruption,
  touch ergonomics and device storage pressure.
- Headphone/speaker listening with real vocal and instrument recordings. Browser
  device output was muted during this pass; native rendering and meters still ran.
- Maximum admitted project sizes, sustained sessions and device-specific resource
  behavior. These short fixtures do not establish those limits.
- Owner review of the resulting interface and sound, plus the PR's own CI result.

The lightweight checkout retains its LFS pointers. Vite emitted the tested app and
service worker, then the existing Glassworks asset guard rejected a retained LFS
pointer. No asset guard was bypassed, large assets fetched, full local build claimed
successful, or production behavior tested.
