# Guitar recorder chord refinement

Status: C1 inference/benchmark foundation implemented in PR [741](https://github.com/mercurypitch/mercurypitch/pull/741).
The owner approved merging the recorder release separately from the remaining
chord work. Candidate quality acceptance and C2–C4 move to the next dedicated
branch/PR; they are not enabled by this recorder release.
The owner approved the corrected native Guitar Pro 8 export on 2026-09-08.
This is the next recorder phase; drum sound work stays separate.

### Current in-app behaviour — owner retest, 2026-09-08

The Live/Replay/Practice release does **not** enable this chord candidate. Direct
guitar input still contributes one detected pitch per frame in Live and in the
original recorder evidence. Hearing a chord but seeing one note is the current
feature boundary, not evidence of an input-device or buffer problem. Recording
uses the shared YIN profile, rehearsal uses MPM; neither is a polyphonic
transcriber. The known-tab scorer can judge an authored chord onset through one
supported voice and mark other voices unprovable. It does not recover their
independent pitches.

Next delivery remains C1 real-DI quality acceptance, C2 overlapping-note and
export contracts, then C3 explicit post-stop refinement/review. The first
user-facing chord test will be **Record → Stop → Refine chords → compare →
accept → Practice/export**. Real-time simultaneous-note display is not included
in that checkpoint and needs a separate quality/latency gate. Keep the existing
low-latency monitoring route untouched.

### Follow-up research: the Free-form Live test — 2026-09-08

The owner clarified that the apparent chord detections were in **Free-form
Live**, not an analysis screen. The local server on port 5217 serves this branch.
Tracing its code confirms `useGuitarListeningController` publishes the shared
MPM rehearsal profile's single pitch through `liveObservations.pitch`;
`guitar-live-history.ts` maintains one held audio note (actual MIDI is separate).
`recording-analysis.ts` still uses YIN single-note evidence. Picking out some
notes in a strum is useful but cannot establish simultaneous-pitch recall. There
is no enabled polyphonic Live engine to copy into Record. The C1 candidate below
remains offline, not secretly active in either mode.

This is not the best possible transcription. The next quality work should be:

1. **Compare decoders before replacing models.** Our onset-only decoder differs
   from upstream Basic Pitch. Its reference decoder adds onset candidates from
   note-activation rises, works backward through detected onsets to consume
   explained energy, and optionally searches remaining activation with a Melodia
   heuristic. Test these as separate benchmark candidates against our bounded
   decoder, especially retriggers, fast singles and overlapping releases. They
   are hypotheses, not guaranteed improvements; no threshold change ships just
   because it increases the number of detected notes.
   [Upstream decoder](https://github.com/spotify/basic-pitch/blob/fa5997af0a8210982619003269994a1be25eddf3/basic_pitch/note_creation.py).
2. **Measure real precision as well as recall.** Manually label a held-out dry
   set of open/power/barre chords and fast phrases. Report per-pitch/onset F1,
   exact simultaneous sets, false octaves and releases separately. A tuning-aware
   range and distinct-string assignment can flag impossible candidates, but must
   not invent missing tones or silently remove uncertainty. Preserve originals.
3. **Profile in the actual browser Worker.** Load one pinned model per job owner,
   reuse bounded buffers, transfer rather than copy PCM, and record cold-load,
   resampling, inference, decoding, memory and cancel time separately. Start with
   single-thread WASM for this small model; benchmark two threads where isolation
   allows it and WebGPU only as measured alternatives. ONNX explicitly separates
   worker UI responsiveness from inference speed. Extra threads are not audio
   priority and must not compete unchecked with monitoring.
   [ONNX performance guidance](https://onnxruntime.ai/docs/tutorials/web/performance-diagnosis.html),
   [environment/worker constraints](https://onnxruntime.ai/docs/tutorials/web/env-flags-and-session-options.html).
4. **Keep post-stop and real-time gates separate.** The current candidate sees
   roughly two-second windows. Faster-than-real-time batch throughput does not
   prove immediate causal chord display. Ship the explicit post-stop comparison
   through C2/C3 first; evaluate a separate streaming display only after measuring
   onset delay, sustained inner voices and monitor continuity. Never delay the
   direct-input audio to wait for recognized notes.

These are researched next tasks, not new accuracy/speed measurements or an enabled
chord release. The supplied video integration does not change any detector.

## Boundaries

- Analyze the retained dry, selected-channel recording after Stop. Never add a
  detector, model, queue or resampling stage to live monitoring.
- Keep original audio, the live single-note evidence, corrections and accepted
  practice revisions. A refined result is a separate, explicitly reviewed draft.
- Detect individual simultaneous pitches with their own onsets/releases. A chord
  name or guessed root must not manufacture missing notes. Rehearsal's known-tab
  matcher cannot transcribe an unknown chord.
- Missing/ambiguous pitches and impossible fingering remain visible. No silent
  octave folding, discarded notes, invented guitar techniques or automatic snap.
- No cloud audio upload. Keep private test recordings out of the repository.

## Sequenced tasks and acceptance gates

### C1 — local candidate and reproducible evidence

- [x] Evaluate the pinned Basic Pitch ONNX model with the installed ONNX runtime;
      audit source/model notices and checksums before redistribution.
- [x] Implement a bounded post-stop inference/decoding seam, with overlapping
      analysis windows and independent note durations. Test seams, final padding,
      held/repeated notes, progress, invalid input, cancellation and five-minute bounds.
      The offline runner releases input/output tensors and its session in `finally`.
- [x] Add labelled synthetic dyads, power chords, open/barre major/minor chords,
      strums, overlapping arpeggios, repeated picks, single-note and silence controls.
      Compare the same PCM against the production monophonic recorder. Report exact
      pitch/onset precision/recall, chord-set accuracy, false octaves and runtime.
- [x] Compare retained publisher DI material against its independent per-string MIDI
      annotations, and a separate unlabelled single-note DI control. Keep annotation
      alignment/quality caveats explicit; do not manufacture accuracy for the control.
- [ ] Manually verify real dry-guitar labels and acceptance quality, including
      actual owner open/power chords and fast phrases. Investigate false notes,
      retriggers and independent releases before choosing a shipping decoder.
- [ ] Verify actual browser Worker loading/cancellation and disposal under load
      during C3. The five-minute unit test is not browser memory/latency acceptance.

Candidate: [Spotify Basic Pitch](https://github.com/spotify/basic-pitch), upstream
commit `fa5997af0a8210982619003269994a1be25eddf3`, official
`basic_pitch/saved_models/icassp_2022/nmp.onnx`. Upstream ships code and model in
the Apache-2.0 repository with LICENSE and NOTICE; preserve both when bundling.
Prefer the existing ONNX runtime over introducing a second TensorFlow runtime.
The model is a candidate, not an unconditional production-detector replacement.
The checked file is 230,444 bytes, SHA-256
`2c3c1d144bfa61ad236e92e169c13535c880469a12a047d4e73451f2c059a0ec`.
No model binary, publisher audio, MIDI annotations or private recording is bundled
in this checkpoint. Preserve the pinned [LICENSE](https://github.com/spotify/basic-pitch/blob/fa5997af0a8210982619003269994a1be25eddf3/LICENSE)
and [NOTICE](https://github.com/spotify/basic-pitch/blob/fa5997af0a8210982619003269994a1be25eddf3/NOTICE)
before adding a self-hosted model asset.

### C1 implementation and measurements — 2026-09-08

- `src/lib/transcription/basic-pitch-inference.ts`: no audio graph, microphone,
  network or storage access. Receives already-resampled mono PCM and an async
  predictor. One reusable 43,844-sample window, 36,164-sample advance, at 22,050 Hz;
  trim 15 output frames at each edge. Times are anchored to each source window,
  not an accumulating rounded frame count. An unnecessary padding-only final
  inference was caught by the five-minute regression and removed.
- `src/lib/transcription/basic-pitch-decoder.ts`: our bounded onset/sustain
  hysteresis decoder, **not upstream Melodia**. Independent envelopes per MIDI
  pitch, explicit repeated attacks, bounded short gaps, maximum 10,000 notes.
  Confidence means model activation, not the live detector's clarity score.
- `src/lib/guitar/recording-chord-fixtures.ts` and
  `recording-chord-benchmark.ts`: 16 additive synthetic fixtures; same fixed PCM
  goes through the current recorder and each candidate. Exact MIDI and one-to-one
  onsets within 60 ms; independent sustained pitch-set probes; false/duplicate
  notes and false octaves count against the candidate.
- `scripts/benchmark-guitar-chords.mjs`: actual installed ONNX WASM inference,
  single thread, explicit pinned-model download option and checksum check. FFmpeg
  supplies filtered resampling. Local audio is bounded to five minutes/256 MiB;
  optional labels are bounded and validated. Reports never overwrite an existing
  file. No uploads or saved-take mutations.

On 28.5 seconds of synthetic audio, 58 labelled notes and 39 fixed probes
(including single-note and silence controls):

| Candidate                          | Matched notes | Extra/unmatched notes | Exact probe sets |
| ---------------------------------- | ------------- | --------------------- | ---------------- |
| Current recorder YIN               | 12/58         | 16                    | 16/39            |
| Basic Pitch, onset-only            | 53/58         | 8                     | 37/39            |
| Frame-assisted starts              | 54/58         | 8                     | 37/39            |
| Short-note variant (55 ms minimum) | 58/58         | 17                    | 37/39            |

The onset-only candidate took 1.18 seconds for inference/decoding in one local
run, plus 0.73 seconds for separate FFmpeg processes and 0.17 seconds cold model
initialization. Baseline streaming analysis/encoding took 3.10 seconds. These are
different workloads on one host, **not browser/monitoring latency** or a promised
speedup. An overlapping-arpeggio case had extra retriggers and poor releases; F
barre produced an extra octave. The short-note variant recovered the fast run but
more than doubled extra detections overall. Defaults have not been retuned or
enabled based solely on this synthetic set.

Real DI check: retained Guitar-TECHS `P3_music/audio/directinput/directinput_02.wav`
(37.333 seconds), compared with all 224 events in `P3_music/midi/midi_02.mid`.
At the same strict 60-ms onset tolerance, the onset candidate matched 197/224,
with 124 unmatched detections; current YIN matched 51/224, with 61 unmatched.
Exact pitch sets at fixed quarter-second probes were 76/149 versus 13/149.
Short-note recovery matched 207/224 but increased unmatched detections to 153.
The separate GuitarJam 026 single-note DI check runs successfully but has no
independently audited note labels, so its accuracy remains unmeasured.

These are **annotation-relative diagnostics, not gold-standard accuracy**:
Guitar-TECHS uses automated per-string Fishman MIDI, warns of up to 100 ms
signal misalignment, and was not manually relabelled or time-shifted here.
An unmatched event may be a false detection, retrigger, alignment mismatch or
annotation error. Do not count every unmatched event as an audible mistake or
silently tune against these labels. Dataset attribution: Hegel Emmanuel Pedroza
Villalobos, Termeh Taheri, Wallace Abreu, Ryan Corey and Iran R. Roman,
[Guitar-TECHS](https://zenodo.org/records/14963133), CC BY 4.0;
original audio/MIDI retained privately, mono downmix and model-rate resampling
only for evaluation. [GuitarJam](https://huggingface.co/datasets/Julian-br/GuitarJam)
by Julian-br is the separate CC0 control. Neither dataset is redistributed here.

Decision: viable post-stop candidate to continue evaluating, not ready for an
automatic replacement. Preserve the original, show a reviewable alternative,
and keep live monitoring and live single-note preview unchanged.

### Reproduce C1

From the checkout with the project's dependencies and FFmpeg installed:

```bash
# First run only: explicit download into a local research directory you own.
timeout 120 node scripts/benchmark-guitar-chords.mjs \
  --model /absolute/research/nmp.onnx --download-model \
  --report /absolute/research/chords-first-run.json

# Reuse the checksum-verified model. Audio never leaves this machine.
timeout 120 node scripts/benchmark-guitar-chords.mjs \
  --model /absolute/research/nmp.onnx --audio /absolute/research/dry-guitar.wav \
  --labels /absolute/research/labels.json \
  --report /absolute/research/chords-real-run.json

pnpm exec vitest run src/lib/transcription/basic-pitch.test.ts \
  src/lib/guitar/recording-chord-benchmark.test.ts
```

Reports/model downloads refuse overwrite; use a new report path per comparison.
Omit `--labels` for unlabelled audio (all accuracy fields stay null), or choose
one synthetic case with `--fixture open-e-minor`. Label shape:

```json
{
  "provenance": "Manually checked dry recording, standard tuning, no capo",
  "notes": [
    { "midi": 40, "startSeconds": 0.2, "endSeconds": 1.2 },
    { "midi": 47, "startSeconds": 0.2, "endSeconds": 0.8 }
  ],
  "probes": [
    { "seconds": 0.5, "midis": [40, 47] },
    { "seconds": 1.0, "midis": [40] }
  ]
}
```

Choose probe times and note labels independently of candidate output. Retain
source checksum, tuning/capo and annotation uncertainty alongside the report.

### C2 — polyphonic note and export contracts

- [ ] Add versioned refinement metadata separate from original evidence; accept
      independently timed overlapping notes and retain model confidence/provenance.
- [ ] Validate simultaneous pitches independently of fingering. Assign distinct
      playable strings for overlapping notes or flag uncertainty. Explicit edits
      cannot accidentally place two simultaneous notes on one string.
- [ ] Audit split/merge/delete/Undo and snapping so chord notes are not serialized
      into an arpeggio. Preserve original seconds unless the owner explicitly snaps.
- [ ] Test persistence, stale results, reload, deletion, quota and rollback.
- [ ] Carry chords into existing audition/practice/MIDI and proper GP7 chord
      beats/ties with independent releases. Keep the approved single-note GP8 cases
      green and add independent per-bar arithmetic plus native GP8 chord checks.

### C3 — review and shared editor

- [ ] Add explicit post-stop Refine chords with local progress, cancellation and
      original/refined comparison. No auto-replacement or auto-accept on completion.
- [ ] Feed accepted notes into the existing score/practice paths.
- [ ] Reuse the shared piano-roll editor through a small adapter and Guitar Night
      skin; do not create a third timing editor or change the tab-rehearsal layout.
- [ ] Cover actual browser Worker/asset loading, no input permission acquisition,
      stop/cancel/switch/unmount races, and accessible desktop/phone review.

### C4 — owner acceptance

- [ ] Compare open chords, power chords, clean singles and fast arpeggios on dry
      input. Keep false harmonics, missed inner voices and onset/release errors in the
      report, not just total note counts.
- [ ] Check five-minute resources/cancellation and unchanged monitoring behavior.
- [ ] Owner opens a chord `.gp` in Guitar Pro 8 and auditions MIDI/notes.
- [ ] Complete CI and review before making the draft PR ready. Do not merge
      without a separate owner go-ahead.

Progress and measurements below must distinguish implemented tooling from an
enabled user feature. The recorder remains single-note until C1–C3 are accepted.
