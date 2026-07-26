# Zen Singing Exercises

## Delivery shape

The feature is intentionally split into two pull requests.

1. The first pull request delivers the local, user-visible vertical slice:
   shared
   Pitch Stage chrome, live loop capture, guided targets, scoring, retained
   pitch takes, seed exercises, example audio, Singing/Exercises entry points,
   and static Ascent launches.
2. The second pull request delivers Content Studio authoring, immutable
   publishing, managed media, and database-pinned Ascent assignments. Published
   content replaces local seeds only after the whole response has passed the
   runtime validator; seeds remain the offline and rollout fallback.

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

The bundled prototype uses
`public/exercises/examples/exercises-develop-strong.mp3`, the strongly denoised
sample selected for the demo. Playback is lazy and starts only after a user
gesture. It pauses an active pass and resumes it when the example ends.

Final recordings should be archived as mono 48 kHz, 24-bit WAV masters. Web
derivatives can use mono MP3 or AAC at an appropriate speech/music bitrate.
Every asset needs duration, MIME type, byte length, locale, transcript, and a
single `pronunciation-tone` purpose. Content Studio reserves and uploads these
short derivatives to the dedicated `GUIDED_MEDIA_BUCKET`; the public app streams
them through the same-origin `/api/guided-media/:id` route.

## Admin Studio and publishing

Content Studio is available at `#/admin/exercises`, `#/admin/ascent`, and
`#/admin/weekly`. One verified owner key unlocks all three sections. The guided
exercise implementation adds four database concepts:

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

The exercise authoring screen builds on the existing challenge creator and
provides:

1. catalogue metadata and instruction fields;
2. a relative-note/glide timeline editor;
3. cue text per event;
4. BPM, loop, root/range, visibility, and scoring controls;
5. a live Pitch Stage preview;
6. example-audio upload, listen, replace, and remove controls;
7. validation issues grouped by section; and
8. draft preview, publish, supersede, archive, and version-history actions.

Public reads expose the current catalogue, one current or exact immutable
version, media streams, and path assignments. Admin writes continue to use the
existing `X-Admin-Key` mechanism. Draft saves use an optimistic
`draftRevision`; stale editors receive a conflict instead of overwriting newer
work.

The custom API surface is:

- `GET /api/guided-exercises`
- `GET /api/guided-exercises/:id`
- `GET /api/guided-exercises/:id/versions/:version`
- `GET|HEAD /api/guided-media/:id`
- `GET /api/guided-paths/:pathId/assignments`
- `/api/admin/guided-exercises/*`, `/api/admin/guided-media/*`, and
  `/api/admin/guided-paths/*` for owner authoring

Media is served through a same-origin frontend proxy so the current content
security policy does not need a broad remote-media exception. A ready object
becomes streamable only after a saved exercise version references its opaque
media ID; this supports owner draft preview without exposing abandoned upload
reservations.

## Ascent integration

Database rows pin every Ascent slot to an exact published or superseded
exercise version. The runtime installs remote assignments only after every
pinned definition resolves and validates; otherwise that week keeps its static
seed links. Opening a lesson loads the guide but never auto-starts the
microphone; Begin remains the required user gesture. Closing Zen returns to the
underlying Path surface.

## Provisional starter catalogue

Content Studio can import the eight bundled exercises as initial published
versions. Their text and coach recordings remain deliberately replaceable:

| Exercise              | Primary cue | Practice intent                 |
| --------------------- | ----------- | ------------------------------- |
| Major Scale Ascending | Ah          | Even connected scale steps      |
| Three-Note Run        | Gee         | Clean compact agility           |
| Octave Repeat Nay     | Nay         | Light octave access             |
| Descending Nya        | Nya         | Consistent descending tone      |
| NG Five-Tone          | NG          | Easy connected resonance        |
| Mam Arpeggio          | Mam         | Speech-like chord leaps         |
| Mah Meh Mee Moh Moo   | Five vowels | Clear articulation on one pitch |
| Noo Siren             | Noo         | Smooth continuous range glide   |

## Deployment

Before deploying the database worker:

1. Run `node scripts/check-guided-exercise-schema.mjs`.
2. Apply `scripts/migrate-guided-exercises.sql` to each existing D1 database.
3. Create the `GUIDED_MEDIA_BUCKET` names configured in
   `workers/db-worker/wrangler.jsonc` for local/default, dev, and production.
4. Keep `ADMIN_KEY` configured as a Worker secret in each environment.
5. Confirm the frontend build uses the matching `VITE_API_BASE_URL`, and that
   the main Worker has the matching `DB_API_URL` for same-origin media proxying.
