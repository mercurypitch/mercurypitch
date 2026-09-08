# Guitar recorder: implementation and preview checks

Contract: [Guitar recorder EARS](specs/guitar-recording.ears.md).
Original recorder: merged [PR 739](https://github.com/mercurypitch/mercurypitch/pull/739).
Recorder follow-up: merged [PR 741](https://github.com/mercurypitch/mercurypitch/pull/741).
Experimental chord refinement: `feat/guitar-chord-refinement` (separate PR).
Drum sound work is intentionally separate and deferred.

## Implemented phases

1. Selected-channel capture borrows Listening's source/context. An AudioWorklet
   copies sequential PCM into 32 reusable 2,048-frame buffers. A Worker runs
   pitch/onset analysis and PCM16 encoding. The amp path is unchanged.
   Four deliveries share each 8,192-frame durable checkpoint, retaining the
   original 65,536-sample pool budget and storage cadence.
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

Publication: recorder fixes shipped in PR 741. The chord integration is separate;
drum sound work remains deferred.

## Chord refinement preview checks

1. Record a dry chord phrase, Stop, then open Review take. Refine chords is
   explicit; merely opening review must not fetch the model or start input.
2. Run Refine chords. Compare Current/Refined with the shared Notes Play control
   and highway. Check open/power chords, picked arpeggios and independent releases.
   More detected notes is not itself a quality improvement.
3. Keep current notes discards the proposal only. Repeat and Use refined notes;
   Keep, reload, then Restore previous notes. Original input/evidence must survive.
4. Correct uncertain pitches/fingerings, then Practice through the existing input
   setup and scoring. MIDI/GP7 preserve chord voices; verify the GP7 in native GP8
   for balanced bars, correct strings, ties and independently ending notes.
5. Cancel analysis, close review during loading, remove source audio, or switch
   takes. No late proposal, automatic monitoring or phantom playback may appear.

Coverage: `guitar-recording-refinement.test.ts` (service and Worker lifecycle),
`guitar-refinement-audio.test.ts`, `recording-refinement-score.test.ts`,
`recording-score.test.ts`, `recording-export.test.ts`,
`useGuitarChordRefinement.test.tsx`, `recorded-score-reference-port.test.ts`,
`guitar-refinement-worker.spec.ts` (real bundled model), and
`guitar-chord-refinement.spec.ts` (real UI/persistence/reload).
Synthetic/browser results do not establish real-guitar accuracy or round-trip
latency. Full shared piano-roll extraction and live polyphony are follow-ups.

## Compact score downloads

MIDI and GP7 downloads use lowercase `melody-<name>-YYYYMMDD-HHmmss.mid` or
`.gp`, with local 24-hour time and no milliseconds. Unnamed takes omit the name
and their auto-generated title date; saved display titles remain unchanged.
Names are sanitized and limited to 48 characters. Repeated exports of the same
name/format within a second add `-2`, `-3`, etc. during the page session; the
browser handles conflicts with files already on disk.

Guitar Pro export is not GPX: it writes a real GP7 `.gp` file. It requires valid
string/fret assignments for every note, just like Practice and Attach. A pitch
outside the recorded tuning blocks those actions but not MIDI export. Use
Review problem notes to correct or explicitly exclude those notes; exporting
must not silently drop them or shift them by an octave.

### GP8 notation compatibility follow-up

The owner's two native GP8 checks exposed a hole in the original same-library
round-trip test. Free timing had been represented by isolated, arbitrary tuplets
(159 and 329 beat markings in the two files). GP8 displayed ratios such as
240:173 and red bars. [GP8 documents red bars as incorrect bar lengths](https://www.guitar-pro.com/docs/gp8/score/bars).
Passing alphaTab export/import alone did not prove a usable native score.

The `.gp` export now makes an explicitly disclosed notation copy on a
thirty-second-note grid. It uses ordinary/dotted durations, ties and complete
rests; at 120 BPM the maximum onset rounding is 31.25 ms. Very short notes are
given one grid unit without overlapping the next attack. If distinct attacks
round to one position, export explains the conflict instead of dropping notes
or shifting the rest of the phrase; MIDI remains available. There is no automatic
tempo detection, swing/triplet inference or change to saved practice timing.
MIDI retains the corrected performance timing at MIDI tick resolution.

Guitar/bass use their normal octave-displaced written pitch without transposing
the sounding notes; bass uses its bass clef. A scoped adapter fixes alphaTab
1.8.3's incorrect GPIF tuning Instrument and FretCount element in our generated
single-track file. It does not patch the installed library or imported scores.

Regression tests inspect ZIP/GPIF directly for independent bar arithmetic,
absent arbitrary tuplets, instrument, clef, octave, key and escaping, then
round-trip pitches, repeats, ties, capo and rounded timings. Cases cover 3/4,
4/4, 5/8, 7/16, 6/8 and 2/2. The browser flow checks the actual downloaded GPIF.
Both owner files were re-exported locally without changing their inputs: all
124/238 included notes and fingerings retained, 25/51 balanced bars and no
tuplets. On 2026-09-08 the owner opened the corrected comparison take in native
Guitar Pro 8 and confirmed the exports look good. Excluded notes cannot be
recovered from these exports; originals remain in the local take evidence.

## Recorder overlay and camera polish

- Melody deletion reuses the shared confirmation with an explicit, opaque
  Velvet skin. Both the gallery and quick-switch portal supply those semantic
  colours; room transparency cannot erase the dialog or destructive action.
- The shared Listening picker is a body portal, fixed above its trigger and
  clamped on resize/scroll/content changes. It clears the stage recorder in
  both hosts without increasing the recorder rail's stacking level.
- Song/recorder and Rehearse the Tab already share `GuitarNightStage`. Its old
  Phrase follow setting intentionally moved the camera between note positions.
  The three remaining presets are fixed, and old saved Phrase follow choices
  fall back to Runway. Notes no longer enter camera calculations. Manual camera
  gestures remain intact through seeks and playback; Reset restores fixed framing.
- Corrections start with note selection, pitch and fingering. Tempo and snapping
  are one optional disclosure, with the same explicit actions and Undo. The full
  shared editor remains a later phase rather than a second editor built here.
- The short owner-facing loop prompt is in [recorder artwork](guitar-recorder-art.md).
  No animation or audio-path changes are part of this polish.

`guitar-recorder-overlays.spec.ts` reproduces the original transparent dialog,
covered picker and saved camera-follow behavior before the fix. It verifies
both deletion entry points (Cancel only), focus return, real hit targets,
desktop/phone bounds, re-anchoring, optional notation tools and manual orbit
through a real-pointer seek/play cycle. Companion recorder-layout and song
Listening/score transport checks cover 1440, 390 and 320px layouts.

## Live recording follow-up (G1 and G2 evidence baseline)

G1 removes the three-second visual clock offset. Flow now places captured notes
at NOW / You played and carries them toward the player as history without
practice-hit effects. Tab has its own behind-NOW history window. Replay and
accepted rehearsal retain the existing upcoming-note layout. Live projection
only compiles recent notes (including long sustains), so a five-minute draft is
not rebuilt in full at every preview; raw evidence and stopped views stay whole.

Preview deliveries are 2,048 frames (~42.7 ms at 48 kHz), previously 8,192
(~170.7 ms), and publish before asynchronous storage finishes. These are delivery
cadences, not input-to-display or input-to-speaker measurements. Analysis still
uses 4,096-frame windows and 1,024-frame hops. Buffer recycling remains gated by
durability; slow storage, terminal notes, overflow and disposal have regressions.

G2 centralizes recorder/rehearsal pitch profiles without changing either
production default. Run the repeatable comparison from the checkout:

```bash
timeout 90 node scripts/benchmark-guitar-recording.mjs --chunk-frames 2048
timeout 90 node scripts/benchmark-guitar-recording.mjs --chunk-frames 8192
```

Both use identical generated 48 kHz PCM and recorder segmentation; the MPM
candidate uses rehearsal detector settings, not its display cadence or known-tab
score matcher. On 50 labelled synthetic notes, recall was 38/50 for recorder YIN,
43/50 for rehearsal MPM and 45/50 with MPM stabilization disabled; precision was
100% on these fixtures. MPM helped strongly damped repeated picks but cut a quiet
sustain roughly 315 ms early versus 16 ms with YIN, and ran about 2.4 times slower
in one local comparison. This does not justify a blanket production switch.
All 39 fixture/config pairs retained identical note/evidence results at both
delivery sizes. Throughput varies with host load; matched/backdated onset errors
are not display latency. Chord, bend, slide and vibrato fixtures preserve raw
contours but make no full-note/technique accuracy claim.

Remaining G2 work is labelled real-guitar evaluation before segmentation changes,
recorder-specific evidence visualization, and separately scoped post-stop
polyphonic/technique refinement with score/editor/export compatibility. Known-tab
chord scoring is not a general chord transcriber. The C1 evaluation below adds
explicit offline model testing, not a shipping model or sample bank.

### Next priority: chord transcription after export/UI acceptance

Chord recognition is **not enabled during live capture** by the shared detector
configuration. Explicit post-stop refinement now integrates the C1 candidate;
see [the detailed implementation checklist and results](guitar-chord-refinement.md).
The bounded next phase is reviewable polyphonic notes, before resuming drum
sound work. Do not put an unbenchmarked model in the live monitor path.

1. **Evidence and baseline:** build a labelled dry-DI set of two-note intervals,
   power chords, major/minor open and barre chords, sustained/strummed chords,
   muted strings and overlapping arpeggios. Include silence, single notes and
   distortion monitoring as negative/regression cases. Retain known note sets,
   tuning/capo, attack order and approximate releases. GP/MIDI exports cannot
   recover simultaneous notes the current detector missed.
2. **Candidate gate:** compare local post-stop multi-pitch approaches against
   those labels, with note precision/recall, chord-set accuracy, false octaves,
   timing, decode/analysis time, memory and cancellation. Audit implementation
   and model-weight redistribution licences before choosing a shipping model.
   Report weak/ambiguous results honestly; do not infer every chord tone merely
   from a guessed root or reuse score-conditioned matching as transcription.
3. **Versioned notes:** keep original audio/evidence immutable and store a
   separate refined draft. Add overlapping-note/chord-group support, individual
   durations/confidence and uncertainty. Assign playable distinct strings where
   supported; never hide extra pitches or force an impossible fingering. Audit
   validation, corrections/Undo, audition, acceptance, deletion and migrations.
4. **Shared editor and integration:** reuse the piano-roll timing/editing work
   for the new polyphonic draft, with Guitar Night styling. Feed accepted notes
   into the existing practice/score paths. Extend MIDI and GP7 with real chord
   beats, voices/ties for independent sustains, and native GP8 regression checks.
5. **Release gate:** compare owner listening and labelled chord results with the
   original single-note draft. Test cancel/reload/failure, large takes, storage
   and memory limits. Live preview stays explicitly single-note initially;
   real-time multi-note preview is a later, separately measured optimization.

Only the C1 inference/benchmark foundation is implemented so far. The candidate
improves simultaneous-note recall but still adds false/duplicate notes; its
quality gate and C2–C4 review/storage/editor/export work remain open. Nothing
automatically replaces the original single-note draft.

The authored-tab host, Studio Lead DSP and operating-system/browser audio
settings are unchanged by the recorder implementation. There is no cloud upload,
background recording, bundled polyphonic model or second monitor. The explicitly
downloaded, checksum-pinned research model stays outside the application bundle.

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
- First live evidence from actual Worker deliveries, history mode during capture
  and Stop, then normal presentation during audition. A separate
  `guitar-recording-history.spec.ts` observes the first actual canvas note draw,
  then checks at least six seconds of active history and moving-tab NOW at each
  desktop/phone viewport. It does not resize during capture or encode recording-time
  screenshots; review screenshots follow explicit Stop. Responsive transitions
  remain separate from this real-time capture check.
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

### Free-form modes

The [mode contract and implementation checklist](plans/guitar-free-form-modes.md)
keeps Live, Replay and Practice separate from the explicit Record action.
`src/e2e/guitar-free-form-modes.spec.ts` covers empty Live without persistence,
fresh rendered DI-monitor audio, source/position retention through Live, accepted
revision reuse, an actual scored attempt, mouse seek/A–B and 320/390/1440px hit
targets. The score uses the production detector, target builder and scorer with
deterministic input, not a stubbed grade. This is not a physical latency test.

Colocated Session/Practice tests exercise real controllers around deferred input,
scheduler and IndexedDB boundaries: cancelled admission, rapid mode/source
changes, stale completions, result opening, partial results, Keep, and rearm.
The live collector tests bound history/voices, silence, pitch enrichment and
actual polyphonic MIDI release without adding another detector or recorder.

### Requirement-to-test coverage

This is behavioral coverage, not a claim of 100% line coverage or every hardware
combination. Colocated tests exercise actual controllers/services; browser-port
fakes are complemented by the real worklet/Worker and audio-render browser tests.

| Contract / risk                                                                                             | Automated evidence                                                                                                                                                                                                       |
| ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| GR-001–003: inert free-form entry, explicit Record, cancellation, MIDI-only refusal                         | `useGuitarRecordingController.test.ts`, `GuitarNightRoom.test.tsx`, `guitar-night-recording.spec.ts`                                                                                                                     |
| GR-004–008: selected-channel ownership, bounded buffers, Stop/interruption, frame limit                     | `recording-capture.test.ts`, `recording-analysis.test.ts`, `useGuitarRecordingController.test.ts`, real capture/monitoring in `guitar-night-recording.spec.ts`                                                           |
| GR-009–014: checkpoints, live-draft locks, atomic Keep/retry, exact deletion, local-only migration          | `recording-lock.test.ts`, `guitar-recording-service.test.ts`, `useGuitarRecordingController.test.ts`, reload/Hear Yourself browser flow                                                                                  |
| GR-015–018, 021–023: immutable evidence, free timing, corrections/Undo, accepted revisions and real exports | `recording-analysis.test.ts`, `recording-score.test.ts`, `recording-export.test.ts`, `GuitarRecordingReview.test.tsx`, `guitar-recording-service.test.ts`, capture-to-Practice/export browser flow                       |
| GR-019–020: existing tab practice and exact-song attachment                                                 | `guitar-score-attachment-service.test.ts`, `useGuitarNightReferenceController.test.tsx`, `guitar-night-recording.spec.ts` and the existing Guitar Night A/B/scoring suites                                               |
| GR-024–029: live/draft highway clock, gallery, compact responsive controls                                  | `useGuitarRecordingStage.test.ts`, `GuitarRecordingGallery.test.tsx`, `GuitarRecordingControls.test.tsx`, `guitar-recorder-layout.spec.ts`, `guitar-recorder-transport.spec.ts`                                          |
| GR-030–034: audio/notes, Current/Clean/Saved amp, stereo, seeking and stale completion                      | `recording-note-player.test.ts`, `recording-playback.test.ts`, `useGuitarRecordingPlayback.test.ts`, `preview-player.test.ts`, real rendered PCM and held-pointer browser tests                                          |
| GR-035: gallery/quick switch, long touch, exact deletion and stale loads                                    | `GuitarRecordingQuickMenu.test.tsx`, `GuitarRecordingGallery.test.tsx`, `useGuitarRecordingController.test.ts`, `guitar-recorder-transport.spec.ts`                                                                      |
| GR-036: truthful NOW/history, sustains, live projection bounds and ordinary replay                          | `recording-history.test.ts`, `Canvas2dTabRenderer.test.ts`, `useGuitarRecordingStage.test.ts`, `GuitarNightMovingTab.test.tsx`, `tab-window.test.ts`, real history/capture browser tests                                 |
| GR-037: preview before storage, bounded pool, final/stale evidence and recovery                             | `guitar-recorder.worker.test.ts`, `recording-pcm-capture.test.ts`, `recording-capture.test.ts`, `useGuitarRecordingController.test.ts`, persistence and real monitoring browser tests                                    |
| GR-038: profile parity, chunk-size invariance and honest comparison metrics                                 | `recording-benchmark.test.ts`, existing Listening/analysis suites and `benchmark-guitar-recording.mjs`                                                                                                                   |
| GR-039–040: free-form voice transport and explicit capture                                                  | `guitar-night-voice-commands.test.ts`, `voice-command-registry.test.ts`, Practice asynchronous restart regression                                                                                                        |
| GR-041–048: Live/Replay/Practice, retained DI, pinned revisions, shared score results and safe transitions  | `useGuitarFreeFormModes.test.ts`, `useGuitarFreeFormSession.test.ts`, `useGuitarFreeFormPractice.test.tsx`, `useGuitarNightScoreResults.test.tsx`, `accept-recording-practice.test.ts`, `guitar-free-form-modes.spec.ts` |
| GR-049: silent recorder-only animation, fallback and decoder lifetime                                       | `GuitarRecorderArtwork.test.tsx`, real decoded reel pixels/loop plus capture/Keep in `guitar-recorder-animation.spec.ts`; existing monitor/record PCM regression                                                         |
| Studio Lead / cabinet and preset migration                                                                  | `guitar-studio-head.test.ts`, `guitar-amp-stage.test.ts`, `guitar-amp-cabinet.test.ts`, amp-settings tests, `guitar-night-amp.spec.ts`, `guitar-night-lead-monitor.spec.ts`                                              |
| DI monitoring / diagnostics / shared song controls                                                          | `guitar-input-monitor.test.ts`, `useGuitarListeningController.test.tsx`, `useGuitarMonitorDiagnostics.test.ts`, `GuitarNightMonitorLatency.test.tsx`, song audio/listening/controls browser suites                       |
| Shared-component and store regressions                                                                      | `OverflowMenu.test.tsx`, `use-focus-trap.test.tsx`, `uvr-store-startup.test.ts`, `karaoke-rail-song-switch.spec.ts`                                                                                                      |

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
  src/e2e/guitar-recorder-overlays.spec.ts \
  --workers=1 --reporter=line
```

Use `VITE_E2E_PORT=5217` for an already running development server. Tests use
isolated browser storage and generated input; do not point them at production.

## Owner audition on dev

- [ ] With Listening off, choose Practice then Play (or Space/voice Play).
      The input prompt should explain scoring, offer all three routes and Replay
      without scoring. Enable Direct input, then explicitly Play; the timeline
      should move. Monitoring remains opt-in. Try denied permission and close
      during a pending request: controls must recover immediately and late
      permission must not reopen capture. Reload the local page after updating;
      Record/Practice/Live transitions should not log ownerless Solid warnings.

Recovery regression coverage: `GuitarNightSourceOwnership.test.tsx` exercises
the actual compiled App/Room prop getters outside an owner; the original
implementation fails with four warnings. `GuitarPracticeInputPrompt.test.tsx`
checks focus/actions/errors; `useGuitarFreeFormPractice.test.tsx` verifies no
delayed Play. `guitar-practice-input.spec.ts` checks desktop/mobile presentation,
real scheduled Practice, denied permission, deferred device enumeration and
closing/reopening before an old input promise resolves. The existing real-score
free-form browser test still covers completed grading with opt-in DI monitoring.

- [ ] Enable voice control and use a microphone that can hear speech (a guitar
      DI channel alone cannot). In free form say Record a melody / Record idea,
      then Stop recording. Replay Recording and Notes with Play, Pause, Forward,
      Back five seconds, Go to start, From the top and Stop. Prefix Mercury if
      wake-word-while-playing is enabled. Check capture blocks seeking, repeated
      Record does not stop it, and Pause/seek never start input. See the saved
      [voice plan and command contract](guitar-recording-voice.md).
- [ ] Enter Play free form. Confirm nothing plays or requests input until asked.
- [ ] With no melody loaded, Live is selected. Enable Listening/You; play without
      pressing Record. NOW/history should respond without creating a take.
      Toggle Live notes off/on without muting or reacquiring the input.
- [ ] Select Direct input / the guitar channel. Enable Listening and You, then
      compare monitor-only with Record running at the same amp/rate/route.
      Note output estimate and underruns, but judge feel by playing.
- [ ] Record 10–20 seconds: low sustained notes, silence, repeated picks,
      hammer-ons/pull-offs and a faster phrase. Stop without playing a song.
- [ ] Check Recording with Clean/bypass, note pitch/endings and suggested frets. Correct a note,
      collapse/reopen corrections, Undo, then Keep and reload Hear Yourself.
- [ ] Toggle Live notes while recording; confirm the monitored sound is unchanged.
      Check notes appear beside NOW, then move toward you as history. Switch to
      Tab: recent notes should remain behind NOW, not appear as future targets.
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
- [ ] Switch Replay → Live → Replay. Preserve the melody, corrections and replay
      position; changing input does not switch modes. Choose Practice explicitly,
      test tempo/count-in, the optional synthesized guide, score results and Keep.
      On a local development build inspect the existing score debug panel.
      Pause/open results/Play again and switch modes during count-in. Confirm
      enabled DI monitoring remains audible, with no second input request.
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
  simpler notation. Practice has its own count-in and playback tempo; automatic
  tempo detection and a recording count-in are not shipped.
- Practice uses a synchronized synthesized guide, not original-audio accompaniment.
  Original audio remains available in Replay. Retiming corrected notes alongside
  original audio needs an explicit compatibility policy before that is supported.
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
