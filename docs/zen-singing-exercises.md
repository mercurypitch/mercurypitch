# Zen Singing Exercises

## Delivery shape

The feature is intentionally split into at most two pull requests.

1. The first pull request is the local, user-visible vertical slice: shared
   Pitch Stage chrome, live loop capture, guided targets, scoring, retained
   pitch takes, seed exercises, example audio, Singing/Exercises entry points,
   and static Ascent launches.
2. The second pull request adds Admin Studio authoring, immutable publishing,
   managed media, and database-pinned Ascent assignments. It should not replace
   the local seeds until the published API response has been validated; seeds
   remain the offline fallback.

## Runtime contract

- `usePracticeController` remains the only owner of
  `PracticeEngine.update()`. Zen subscribes to its frame stream.
- A monitor pass is seconds-based and defaults to eight seconds. Guided pass
  duration is derived from authored beats and BPM.
- Pitch is sampled at no more than 30 Hz. Continuous silence creates one gap
  marker, so the renderer never joins notes across a breath.
- The current pass moves from the left edge to the right edge. At the boundary
  it is finalized once, retained, and a new pass begins immediately at zero.
- The visible pitch window is fixed during a pass. It starts at 24 semitones,
  uses target notes as the priority range, and may refit only between passes.
- Ten takes remain immediately navigable in the open stage. IndexedDB keeps the
  newest 50 compact pitch-only takes; raw microphone audio is never retained.

## Exercise specification

The current `ZenExerciseDefinition` is the version-one runtime shape. A
published exercise needs:

- stable ID and integer version;
- `en-GB` locale;
- title, category, level, summary, goal, instructions, optional safety and
  pronunciation copy;
- BPM, count-in beats, loop beats, and a voice-fitted default root;
- note or glide events with relative semitone offsets and independent cue text;
- target visibility and playhead defaults;
- exact-octave scoring configuration; and
- optional user-initiated pronunciation/tone media.

Pitch, timing, and visible text must stay independent. A note can therefore
carry cue text such as `NG`, `Nya`, `Mam`, or `Myam` without changing its
musical target. Pronunciation copy and cue spelling remain coach-editable.
Pitch input must never be presented as pronunciation scoring.

## Scoring

Guided takes currently report:

- pitch accuracy from time-aligned cents error;
- coverage so silence is not mistaken for successful data;
- steadiness from variance around the authored target; and
- a configured weighted total.

Glides use continuous interpolation between their endpoints. Future scoring can
add authored segment completion and timing, but a published version must keep
its scoring configuration frozen so historical results remain comparable.

## Example audio

The prototype uses
`public/exercises/examples/exercises-develop-strong.mp3`, the strongly denoised
sample selected for the demo. Playback is lazy and starts only after a user
gesture. It pauses an active pass and resumes it when the example ends.

Final recordings should be archived as mono 48 kHz, 24-bit WAV masters. Web
derivatives can use mono MP3 or AAC at an appropriate speech/music bitrate.
Every asset needs duration, MIME type, byte length, locale, transcript, and a
single `pronunciation-tone` purpose.

## Admin Studio and publishing

The second pull request should add four database concepts:

- `guidedExercises`: stable identity, category, difficulty, order, lifecycle
  status, and published-version pointer;
- `guidedExerciseVersions`: immutable versioned JSON specification, locale,
  example-media pointer, and publish timestamps;
- `guidedExerciseMedia`: R2 object metadata and lifecycle status; and
- `pathLessonAssignments`: path/week/day/slot assignment pinned to one
  published exercise version.

Drafts are editable. Publish validates the full schema, freezes the version,
and atomically advances the exercise’s published-version pointer. Published or
path-referenced versions and media are never hard-deleted.

The authoring screen should build on the existing challenge creator and add:

1. catalogue metadata and instruction fields;
2. a relative-note/glide timeline editor;
3. cue text per event;
4. BPM, loop, root/range, visibility, and scoring controls;
5. a live Pitch Stage preview;
6. example-audio upload/listen/replace controls;
7. validation issues grouped by section; and
8. draft preview, publish, supersede, archive, and version-history actions.

Public reads should expose the catalogue, one published version, its media
stream, and resolved path lessons. Admin writes continue to use the existing
admin-key mechanism. Media is served through a same-origin endpoint so the
current content security policy does not need a broad remote-media exception.

## Ascent integration

Static week-to-seed links prove the end-to-end launch in the first pull request.
The second pull request replaces these assignments with database rows pinned to
published versions. Opening a lesson loads the guide but never auto-starts the
microphone; Begin remains the required user gesture. Closing Zen returns to the
underlying Path surface.
