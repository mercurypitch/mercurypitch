# Guitar recorder chord refinement

Status: C1 inference/benchmark foundation merged in PR [741](https://github.com/mercurypitch/mercurypitch/pull/741).
The dedicated `feat/guitar-chord-refinement` branch integrates experimental
post-stop refinement, optional live chord preview, overlapping-score/export contracts and reversible review in PR [746](https://github.com/mercurypitch/mercurypitch/pull/746).
Real-guitar quality and native GP8 chord acceptance are still owner gates.
The owner approved the corrected native Guitar Pro 8 export on 2026-09-08.
This is the next recorder phase; drum sound work stays separate.

### This PR: reversible refinement and optional live preview

- Refine chords is available inside the existing stopped-take review. It lazily
  loads a pinned, self-hosted Basic Pitch model and single-thread ONNX WASM into
  a disposable Worker. Bounded WAV decoding/resampling happens there too.
- Current/Refined comparison borrows the existing Notes audition and stage.
  Only Use refined notes writes corrections, with a reloadable one-step backup.
  Original audio/evidence and immutable practice revisions remain untouched.
- Pitches retain independent releases and exact seconds. Suggested chord
  fingerings use separate available strings; unresolved notes are flagged.
  MIDI and native GP7 support simultaneous notes and individual releases/ties.
- Cancellation, stale source/edits, missing audio, quota failure and disposal
  retain the original. No live audio or monitoring implementation changes.
- The full shared piano-roll port remains separate: `PianoRollCanvas` currently
  creates a Compose-specific audio owner/global registrations. This PR reuses
  existing corrections rather than embedding that owner or creating a third editor.
- Existing decoder defaults are retained, not declared optimal. Decoder comparison,
  manual dry-guitar truth, fast-arpeggio quality and native GP8 chord audition are
  still outstanding. The optional live preview below is experimental, not a
  real-guitar accuracy or physical-latency guarantee.

#### Session preferences — owner-requested follow-up

- **Live chords** defaults off. In Free form Live and Record it borrows the
  selected dry input channel on a silent side branch. It never acquires a mic,
  creates an AudioContext, processes the audible path or changes known-score
  Practice. Single-note preview remains the fallback; MIDI retains its own voices.
- **Refine after Stop** defaults on, independently. Only a freshly completed,
  nonempty take schedules one proposal. Opening an old/recovered melody does not
  trigger analysis; cancellation/closing does not restart it on reopen. Automatic
  means prepare Current/Refined, never choose Use or save/replace notes.
- Live and post-stop reuse the pinned model/tensor loader, decoder, resampling
  kernel and chord fingering. The bounded PCM worklet registration is shared
  with the recorder; each side tap has its own finite pool and disposal.
- Live retains about 2.1 seconds of source PCM and six seconds of note history.
  Roughly two-second model windows advance at most every 330 ms. In-flight work
  is not duplicated; the next pass uses the newest window. Source-frame times,
  not message arrival times, anchor notes. Model frames are consumed once.
- Session reports measured preview lag and analysis time, **not audio latency**.
  Short context/lookahead and note confirmation mean visible notes follow the
  sound; monitoring never waits. Three consecutive passes over 500 ms, missing
  PCM, inference gaps or worker failure stop this optional preview with a reason.
- Toggle off, Listening/channel/route changes, hidden page, Replay/Practice,
  review and unmount dispose the live worker/tap. Recording and monitored audio
  remain owned by their original controllers. Full-take refinement starts only
  after the live worker is retired. Live results are not persisted as evidence.

Follow-up verification (2026-09-08): 162 focused tests and 17 relevant browser
checks passed. The real bundled live model detected the synthetic power-chord
fixture's MIDI 40/47/52 pitches both in Live and during Record. Turning the
switch off preserved fresh nonzero monitored PCM and the original input lease;
Stop retired live analysis before starting exactly one unapplied proposal.
Desktop and 390 px Session screenshots passed visual review. In that local
13-window run, analysis took 80.7 ms median / 125.2 ms maximum per pass; these
fixture timings are not audible latency or real-guitar accuracy measurements.

The following C1 research records the earlier monophonic release and the
post-stop-first decision. It is historical context; this follow-up explicitly
adds the opt-in live path described above without replacing its saved evidence.

#### Browser verification, 2026-09-08

The production bundle's real single-thread Worker identifies overlapping MIDI
40/47/52 in the labelled synthetic power-chord fixture. Corrupt model bytes and
cancellation during model loading are rejected. The complete app flow verifies
compare → apply → Keep → reload → restore and MIDI download, with no ownerless
Solid warnings. These are integration checks, not real-guitar quality acceptance.

A separate local five-minute silence capacity probe completed 183 model windows
in 10.85 seconds of Worker time and returned no notes. Whole-headless-browser
PSS rose from 142.0 MiB to a sampled 338.8 MiB and was 303.2 MiB immediately after
termination; that includes the source fixture and browser allocator retention,
not an isolated model-memory measurement or proof of a leak. Mobile headroom,
physical latency and real-guitar precision are not inferred from these numbers.
No long capacity probe is added to the regular CI suite.

### Previous release behaviour — owner retest, 2026-09-08

The Live/Replay/Practice release does **not** enable this chord candidate. Direct
guitar input still contributes one detected pitch per frame in Live and in the
original recorder evidence. Hearing a chord but seeing one note is the current
feature boundary, not evidence of an input-device or buffer problem. Recording
uses the shared YIN profile, rehearsal uses MPM; neither is a polyphonic
transcriber. The known-tab scorer can judge an authored chord onset through one
supported voice and mark other voices unprovable. It does not recover their
independent pitches.

The first user-facing chord test is **Record → Stop → Refine chords → compare →
Use refined notes → Practice/export**. Real-time simultaneous-note display is not included
in that checkpoint and needs a separate quality/latency gate. Keep the existing
low-latency monitoring route untouched.

### Follow-up research: the Free-form Live test — 2026-09-08

The owner clarified that the apparent chord detections were in **Free-form
Live**, not an analysis screen. That test used the previous recorder branch
served on local port 5217, not this separate refinement worktree.
Tracing its code confirms `useGuitarListeningController` publishes the shared
MPM rehearsal profile's single pitch through `liveObservations.pitch`;
`guitar-live-history.ts` maintains one held audio note (actual MIDI is separate).
`recording-analysis.ts` still uses YIN single-note evidence. Picking out some
notes in a strum is useful but cannot establish simultaneous-pitch recall. There
is no enabled polyphonic Live engine to copy into Record. The C1 candidate below
remains offline, not secretly active in either mode.

This is not the best possible transcription. Continuing quality work should be:

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

- Analyze the retained dry, selected-channel recording after Stop. Optional live
  analysis uses a silent side branch; never add a model, queue or resampling stage
  to the audible monitoring path.
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
- [x] Verify actual browser Worker loading/cancellation and disposal during C3,
      including a separate local five-minute capacity probe. This is not mobile
      headroom or monitoring-latency acceptance.

Candidate: [Spotify Basic Pitch](https://github.com/spotify/basic-pitch), upstream
commit `fa5997af0a8210982619003269994a1be25eddf3`, official
`basic_pitch/saved_models/icassp_2022/nmp.onnx`. Upstream ships code and model in
the Apache-2.0 repository with LICENSE and NOTICE; preserve both when bundling.
Prefer the existing ONNX runtime over introducing a second TensorFlow runtime.
The model is a candidate, not an unconditional production-detector replacement.
The checked file is 230,444 bytes, SHA-256
`2c3c1d144bfa61ad236e92e169c13535c880469a12a047d4e73451f2c059a0ec`.
The integration now bundles this model with its pinned
[LICENSE](https://github.com/spotify/basic-pitch/blob/fa5997af0a8210982619003269994a1be25eddf3/LICENSE)
and [NOTICE](https://github.com/spotify/basic-pitch/blob/fa5997af0a8210982619003269994a1be25eddf3/NOTICE)
under `public/models/basic-pitch/`, alongside ONNX runtime redistribution notices.
Publisher audio, MIDI annotations and private recordings are not bundled.

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
and keep live monitoring unchanged. The subsequent Session preference adds an
optional experimental live preview without replacing original single-note evidence.

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

- [x] Add versioned refinement metadata separate from original evidence; accept
      independently timed overlapping notes and retain model confidence/provenance.
- [x] Validate simultaneous pitches independently of fingering. Assign distinct
      playable strings for overlapping notes or flag uncertainty. Explicit edits
      cannot accidentally place two simultaneous notes on one string.
- [x] Audit split/merge/delete/Undo and snapping so chord notes are not serialized
      into an arpeggio. Preserve original seconds unless the owner explicitly snaps.
- [x] Test persistence, stale results, reload, deletion, quota and rollback.
- [x] Carry chords into existing audition/practice/MIDI and proper GP7 chord
      beats/ties with independent releases. Keep the approved single-note GP8 cases
      green and add independent per-bar arithmetic.
- [ ] Owner verifies the new chord exports in native Guitar Pro 8 (C4).

### C3 — review and shared editor

- [x] Add explicit post-stop Refine chords with local progress, cancellation and
      original/refined comparison. No auto-replacement or auto-accept on completion.
- [x] Feed accepted notes into the existing score/practice paths.
- [ ] Reuse the shared piano-roll editor through a small adapter and Guitar Night
      skin; do not create a third timing editor or change the tab-rehearsal layout.
- [x] Cover actual browser Worker/asset loading, no input permission acquisition,
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
