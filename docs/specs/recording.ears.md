# Recording — EARS Requirements

Requirements for capturing sung or keyed input as notes on the piano roll.

**Source:** `src/features/recording/useRecordingController.ts` — capture and
note commit; `src/lib/pitch-pipeline/` — denoise and note segmentation;
`src/lib/mic-manager.ts` — the shared device owner; `src/lib/piano-roll.ts` —
rendering committed notes
**Tests:** `src/e2e/practice-playback.spec.ts` (`REQ-REC-001..020`) — partial
coverage

EARS keywords: **WHEN** (event), **WHILE** (state), **IF/THEN** (unwanted
behaviour), **WHERE** (optional feature), otherwise ubiquitous ("shall").

## Activation — `REQ-REC-001..004`

### REQ-REC-001 — Start control
The user **shall** be able to start recording from the record control.

### REQ-REC-002 — Recording state is visible
**WHILE** recording, the app **shall** show an active recording indicator.

### REQ-REC-003 — One session at a time
**IF** a recording is started **WHILE** another is active, **THEN** the app
**shall** end the previous one first.

### REQ-REC-004 — Mic lease released
**WHEN** recording ends, or the surface unmounts, the controller **shall**
release its mic lease unconditionally. See
[MISTAKES.md](../agent/MISTAKES.md) — a conditional release leaks the mic into
the next page.

## Input — `REQ-REC-005..010`

### REQ-REC-005 — Keyboard input
The user **shall** be able to enter notes from the computer keyboard.

### REQ-REC-006 — Keys map to the scale
Keyboard keys **shall** map to notes of the current scale.

### REQ-REC-007 — Press and release bound the note
**WHEN** a key is pressed the note **shall** sound, and **WHEN** released the
note **shall** end.

### REQ-REC-008 — Microphone input
**WHERE** the mic is active, the app **shall** derive notes from sung or hummed
pitch.

### REQ-REC-009 — Detected notes align to the timeline
Notes derived from the mic **shall** be placed at the transport position at
which they were sung.

### REQ-REC-010 — Threshold is adjustable
The user **shall** be able to adjust the input threshold that gates note
detection.

## Note commit — `REQ-REC-011..014`

### REQ-REC-011 — Commit on boundary
A note **shall** be committed to the melody only once its end boundary is
determined; the in-progress note is held separately until then.

### REQ-REC-012 — Rendered as blocks
Committed notes **shall** appear on the piano roll as blocks aligned to the
timeline, with visible start and end boundaries.

### REQ-REC-013 — Velocity is expressed
**WHERE** a note carries velocity, the piano roll **shall** reflect it
visually.

### REQ-REC-014 — Unlabelled until named
A newly recorded melody **shall** be marked unlabelled until the user names it.

## Transport — `REQ-REC-015..018`

### REQ-REC-015 — Stop
**WHEN** the user stops recording, the app **shall** end any note still open.

### REQ-REC-016 — Pause preserves the take
**WHEN** recording is paused, the app **shall** stop audio while preserving
everything captured so far.

### REQ-REC-017 — Resume continues the take
**WHEN** a paused recording resumes, the app **shall** continue the same take
rather than starting a new one.

### REQ-REC-018 — Stopping playback is not destructive
**IF** playback is stopped, **THEN** the app **shall** not delete recorded
notes.

## Persistence — `REQ-REC-019..020`

### REQ-REC-019 — Saveable as a melody
The user **shall** be able to save a recording as a new melody, after which it
persists per [media-library.ears.md](media-library.ears.md).

### REQ-REC-020 — Unsaved takes are volatile
**IF** the page reloads before a take is saved, **THEN** that take **may** be
lost. This is accepted behaviour, not a defect.
