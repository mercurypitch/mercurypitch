# Guitar recorder: implementation and preview checks

Contract: [Guitar recorder EARS](specs/guitar-recording.ears.md).
Work item: [PR 739](https://github.com/mercurypitch/mercurypitch/pull/739).
Drum sound work is intentionally separate and deferred.

## Implemented phases

1. Selected-channel capture borrows Listening's source/context. An AudioWorklet
   copies sequential PCM into eight reusable 8,192-frame buffers. A Worker runs
   pitch/onset analysis and PCM16 encoding. The amp path is unchanged.
2. Play free form opens the existing song room without fake assets. Explicit
   Record works with no backing or fixed-rate backing, up to five minutes.
   Route changes, page hiding and resource failure preserve recoverable drafts.
3. Dexie v12 adds local recording metadata, checkpointed evidence, accepted score
   revisions and song placements. Keep atomically promotes dry audio into Hear
   Yourself; raw staged PCM is removed only after successful promotion.
4. Jam Doctor hosts take replay, corrections/Undo and Keep/Practice. Accepted
   melodies enter the existing score chooser and tab practice, not a new player.
   Removing only Hear Yourself audio retains practice notes.
5. Accepted revisions can be placed on a song using existing alignment controls,
   and exported as actual GP7 `.gp`. MIDI exports the current corrections even
   when a pitch does not fit the guitar neck, without accepting an invalid guitar
   target. Notes and captured evidence remain
   separate; newer revisions do not change previous practice targets.
6. The Play/Stop/Record group is centered in free form. Optional Live notes uses the existing stage
   and worker's pending/completed notes; the runway shows recent history so new
   notes remain visible. This is a visual window, not added audio latency.
   Stop retains the draft; Review take reopens it. Fingering problems have a
   count, direct selection and undoable exclusion; original evidence survives.
   Live notes is in Recorder options in free form and Session for a staged song.
7. The optional live highway follows the capture AudioContext between durable
   checkpoints. An isolated Chromium run measured median visible clock steps
   of 168.7 ms before and 16.6 ms after, with median canvas drawing below 1 ms.
   These measure visual smoothness, not physical audio latency.
8. Free form has a two-row timeline/transport, independent Listening/mix rows,
   and a stage-mounted tape deck with metadata, Review and Recorder options.
   Its empty-state invitation replaces the overlapping generic hint; Attach a
   tab remains available in Recorder options. Song-room invitations are unchanged.
   The existing preview player handles audition; practice still requires
   accepting notes into the existing tab host.
9. My melodies opens a focus-managed translucent gallery with actual captured
   note contours, counts, ranges, dates, duration and input/save metadata.
   It reads only note-ending evidence, eight tiles at a time; no audio blobs are
   fetched for thumbnails. The room remains its original size behind it.
   [Recorder artwork and animation boundary](guitar-recorder-art.md).
10. Deck and review share Recording/Notes playback plus Current amp (default),
    Clean/bypass and Saved amp. Original input audio remains unchanged; Notes
    uses corrected pitches/times, including notes outside guitar fingering.
    Current amp follows Session while auditioning. Saved amp reapplies the
    start-of-recording snapshot in an independent stage, never room settings.
    Sources rewind on change; tone switches smoothly. The existing room output
    context hosts the same amp/cabinet implementation as monitoring, with one
    post-effects fade envelope. No extra input permission or monitor is opened.

11. Original audio and Notes support exact-second seeking before Play, paused
    and while playing, with safe output envelopes and last-request-wins
    cancellation. Stop rewinds; Pause retains the position. The amp artwork
    opens Current/Clean/Saved choices instead of a native dropdown.
12. My melodies retains its gallery and adds a quick-switch chevron and held
    touch shortcut. Both views offer confirmed deletion. Switching does not
    autoplay or open Review, and failed/stale loads preserve the selected take.

Publication: the recorder and final review fixes belong to the existing PR 739.
Merge and dev deployment follow the repository workflow; drum sound work remains separate.

The authored-tab host, Studio Lead DSP and operating-system/browser audio
settings are unchanged by the recorder implementation. There is no cloud upload,
new asset licence, background recording, polyphonic model or second monitor.

## Automated checks

Focused Vitest coverage lives alongside the recording analysis, capture core,
score conversion, export, persistence, attachment and controller modules. It
includes cancellation/late permission, stream ownership, interruption, bounded
buffers, held/repeated/legato notes, upgrade from v11, transaction rollback,
concurrent Keep, quota retry, stale revision rejection, original-audio deletion,
capo/tuning, reversible edits and MIDI/GP7 parser round trips.

`src/e2e/guitar-night-recording.spec.ts` exercises the real worklet, Worker,
IndexedDB and exported download path with generated audio:

- No-song Record → Stop → corrections/Undo → Keep → Practice → reload.
- Reopen from Hear Yourself and export MIDI/GP without opening a microphone.
- Record with backing, stop at its boundary, attach, nudge and reload placement.
- Record while monitoring remains active: one output context, unchanged level
  within the test tolerance, continuous rendered frames and no input release.
- Live preview on/off without ending capture, frozen draft after Stop, centered
  transport and unchanged song speed/volume proportions.
- Intermediate canvas paints between checkpoints; dry playback and gallery
  reopening without another input request; gallery Escape/focus restoration,
  unchanged stage bounds.
- Unit coverage for lazy/bounded gallery reads, real note counts, unavailable
  versus empty evidence, retry, interrupted/removed-audio states, and replay
  pause/disposal/late-start races.

`src/e2e/guitar-recorder-layout.spec.ts` separately checks review, transport and
gallery screenshots, reachable actions and overflow at 1440/390/320px. It shares
a deterministic IndexedDB fixture with the pointer transport suite. Keeping
responsive checks separate leaves the real capture-to-practice flow within its
30-second CI budget without extending the timeout or removing assertions.

`src/e2e/guitar-recording-playback.spec.ts` checks actual rendered stereo PCM
with deterministic local audio and different note evidence. It compares original
input versus synthesized notes, clean versus current Studio Lead versus saved
Lead, current-amp bypass, cabinet loading, and unchanged room settings/input
permission counts. This proves routing and processing, not subjective tone quality.

`src/e2e/guitar-recorder-transport.spec.ts` uses real pointer scrubbing and rendered
PCM to verify that both sources seek before Play and during playback, Stop rewinds,
and the two-row transport stays independent of Listening at 320/390/1440px. It also
checks quick switching, cancelled/confirmed deletion, and real mobile long press.

### Requirement-to-test coverage

This is behavioral coverage, not a claim of 100% line coverage or every hardware
combination. Colocated tests exercise actual controllers/services; browser-port
fakes are complemented by the real worklet/Worker and audio-render browser tests.

| Contract / risk                                                                                             | Automated evidence                                                                                                                                                                                 |
| ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GR-001–003: inert free-form entry, explicit Record, cancellation, MIDI-only refusal                         | `useGuitarRecordingController.test.ts`, `GuitarNightRoom.test.tsx`, `guitar-night-recording.spec.ts`                                                                                               |
| GR-004–008: selected-channel ownership, bounded buffers, Stop/interruption, frame limit                     | `recording-capture.test.ts`, `recording-analysis.test.ts`, `useGuitarRecordingController.test.ts`, real capture/monitoring in `guitar-night-recording.spec.ts`                                     |
| GR-009–014: checkpoints, live-draft locks, atomic Keep/retry, exact deletion, local-only migration          | `recording-lock.test.ts`, `guitar-recording-service.test.ts`, `useGuitarRecordingController.test.ts`, reload/Hear Yourself browser flow                                                            |
| GR-015–018, 021–023: immutable evidence, free timing, corrections/Undo, accepted revisions and real exports | `recording-analysis.test.ts`, `recording-score.test.ts`, `recording-export.test.ts`, `GuitarRecordingReview.test.tsx`, `guitar-recording-service.test.ts`, capture-to-Practice/export browser flow |
| GR-019–020: existing tab practice and exact-song attachment                                                 | `guitar-score-attachment-service.test.ts`, `useGuitarNightReferenceController.test.tsx`, `guitar-night-recording.spec.ts` and the existing Guitar Night A/B/scoring suites                         |
| GR-024–029: live/draft highway clock, gallery, compact responsive controls                                  | `useGuitarRecordingStage.test.ts`, `GuitarRecordingGallery.test.tsx`, `GuitarRecordingControls.test.tsx`, `guitar-recorder-layout.spec.ts`, `guitar-recorder-transport.spec.ts`                    |
| GR-030–034: audio/notes, Current/Clean/Saved amp, stereo, seeking and stale completion                      | `recording-note-player.test.ts`, `recording-playback.test.ts`, `useGuitarRecordingPlayback.test.ts`, `preview-player.test.ts`, real rendered PCM and held-pointer browser tests                    |
| GR-035: gallery/quick switch, long touch, exact deletion and stale loads                                    | `GuitarRecordingQuickMenu.test.tsx`, `GuitarRecordingGallery.test.tsx`, `useGuitarRecordingController.test.ts`, `guitar-recorder-transport.spec.ts`                                                |
| Studio Lead / cabinet and preset migration                                                                  | `guitar-studio-head.test.ts`, `guitar-amp-stage.test.ts`, `guitar-amp-cabinet.test.ts`, amp-settings tests, `guitar-night-amp.spec.ts`, `guitar-night-lead-monitor.spec.ts`                        |
| DI monitoring / diagnostics / shared song controls                                                          | `guitar-input-monitor.test.ts`, `useGuitarListeningController.test.tsx`, `useGuitarMonitorDiagnostics.test.ts`, `GuitarNightMonitorLatency.test.tsx`, song audio/listening/controls browser suites |
| Shared-component and store regressions                                                                      | `OverflowMenu.test.tsx`, `use-focus-trap.test.tsx`, `uvr-store-startup.test.ts`, `karaoke-rail-song-switch.spec.ts`                                                                                |

The final capture-boundary audit adds explicit checks for ordered durable writes
before buffer recycling/completion, failed module retry, partial-allocation
cleanup, worker failure during a checkpoint, and bounded start/stop/analysis
timeouts. Its regression reproduces Stop before a queued start acknowledgement:
the late acknowledgement must not remove the newer stop deadline. Frame-limit
and disconnected-input tests retain the exact delivered prefix without silently
appending silence. Web Locks tests cover held, unavailable, failed and unsupported
cases; browsers without Web Locks retain a best-effort fallback, not cross-tab
exclusivity.

Run against a freshly built local bundle (the Playwright config does not rebuild):

```bash
pnpm build:e2e
VITE_E2E_PORT=35219 PLAYWRIGHT_HTML_OPEN=never pnpm exec playwright test \
  src/e2e/guitar-night-recording.spec.ts src/e2e/guitar-recording-playback.spec.ts \
  src/e2e/guitar-recorder-transport.spec.ts src/e2e/guitar-recorder-layout.spec.ts \
  --workers=1 --reporter=line
```

Use `VITE_E2E_PORT=5217` for an already running development server. Tests use
isolated browser storage and generated input; do not point them at production.

## Owner audition on dev

- [ ] Enter Play free form. Confirm nothing plays or requests input until asked.
- [ ] Select Direct input / the guitar channel. Enable Listening and You, then
      compare monitor-only with Record running at the same amp/rate/route.
      Note output estimate and underruns, but judge feel by playing.
- [ ] Record 10–20 seconds: low sustained notes, silence, repeated picks,
      hammer-ons/pull-offs and a faster phrase. Stop without playing a song.
- [ ] Check Recording with Clean/bypass, note pitch/endings and suggested frets. Correct a note,
      collapse/reopen corrections, Undo, then Keep and reload Hear Yourself.
- [ ] Toggle Live notes while recording; confirm the monitored sound is unchanged.
      Stop and close review: the melody remains visible. Review take reopens it.
- [ ] Use the rail's Play control to replay the take; check the highway
      follows it. Open My melodies and review the actual note miniature/details.
      Approve the static recorder artwork and placement before animation work.
- [ ] Scrub before Play and during playback, then use Stop to return to zero.
      Tap the stage recorder to start/stop recording. Check the quick-switch
      chevron or held touch on My melodies, then cancel and confirm a deletion.
- [ ] In the deck and Review, compare Recording/Notes with Current amp, Clean
      and Saved amp. Turn Session Amp off/on while Current amp plays; adjust
      drive. Confirm both speakers, smooth Pause/resume/source changes, and no
      new input request. Saved amp must not move Session's knobs. Notes should
      use current corrections; Recording must remain the original performance.
- [ ] With out-of-neck notes, try MIDI export; then Review problem notes and
      correct or explicitly exclude them. Undo restores them. Practice/Attach/GP
      should become available once fingering and note timing are valid.
- [ ] Practice these notes; test preferred views, an A/B loop and a new scored
      attempt. The original improvisation itself must remain ungraded.
- [ ] Record along with a song; attach and nudge if needed. Reload and verify
      placement. For unrelated free play, use manual first/last-note placement.
- [ ] Download `.mid` and `.gp`; open `.gp` in Guitar Pro or a compatible reader.
      Automated parser round trips do not replace a notation-reader audition.

## Explicit limitations / remaining decisions

- Capture remains mono, pre-app-amp input. Reamping is reversible playback, not
  a second wet file or baked export. Saved amp is the starting snapshot, not
  later knob automation or monitor volume. Clean bypass cannot undo processing
  recorded from external equipment. Notes use synthesis, not the original audio.
- Single-note transcription is approximate. Original pitch evidence is retained,
  but bend/vibrato technique notation and overlapping chords need correction.
- Free time uses a labelled 120 BPM display grid; optional snapping helps produce
  simpler notation. Count-in and automatic tempo detection are not shipped.
- Browser storage can be evicted. Local persistence is not a cloud backup.
- Automated browser coverage is Chromium with synthetic input. Real-interface
  latency, transcription quality, Firefox and Safari require explicit testing.
- The independent UI review found lost Undo on collapse and editing during save;
  both are fixed and covered. The established two-room UI remains intact.
- The full reusable Pitch Studio editor is planned next, not implemented here.
  Stem Mixer supplies the established editing behavior; shared second-domain
  operations, gesture transactions and optional snapping will have host adapters
  for Guitar/Compose rather than duplicate recording or playback controllers.

## Processing headroom follow-up

Cloud PR Gate 34147643262 exposed bounded-queue exhaustion in the original
recorder. A local Chrome benchmark of twelve 8,192-frame / 48 kHz voiced blocks
(2.048 seconds) measured 1,606/1,580 ms before and 389/372 ms after replacing
per-sample Float32 stores in YIN's difference sum with one store per lag.
Same buffer sizes, hop, algorithm, thresholds and amp path; accumulated arithmetic
now rounds once per lag. Existing pitch fixtures and recorder PCM tests pass.
These are machine-specific processing measurements, not physical latency claims
or a guarantee that every device can record without backpressure. Pool limits
and safe interruption remain unchanged. Fresh cloud CI is still required after
publication; an older failed run is not changed by local verification.
