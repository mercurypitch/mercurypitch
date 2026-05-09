# EARS Specification — Falling Notes Piano Practice

## Overview

Synthesia-style vertical falling notes game. Notes scroll top→bottom toward a virtual
piano keyboard. The user plays into a microphone; hit detection matches detected pitch
against the note at the judgment line. Scoring is dual-axis: timing accuracy (60%) +
pitch accuracy (40%).

---

## 1. Song Loading

### Ubiquitous Requirements

- **REQ-SONG-001**: The system shall display a dropdown listing all melodies from the
  melody store, showing each melody's name, note count, BPM, and key signature.
- **REQ-SONG-002**: The system shall auto-select and auto-load the first melody in the
  list when the piano practice tab is first opened.
- **REQ-SONG-003**: The system shall display an "Import MIDI" button adjacent to the
  song dropdown.

### Event-Driven Requirements

- **REQ-SONG-004**: WHEN the user selects a song from the dropdown, the system shall
  load that melody's items and convert them to `FallingNote[]` objects, reset all game
  state, and display the notes on the canvas in their correct vertical positions.
- **REQ-SONG-005**: WHEN the user clicks "Import MIDI", the system shall open a native
  file picker accepting `.mid` and `.midi` files, parse the MIDI data, convert track
  notes to melody items, and load them as the active song.

### Unwanted Behavior Requirements

- **REQ-SONG-006**: IF a MIDI file contains zero playable notes, THEN the system shall
  display the message "No notes found in MIDI file" and shall not replace the current
  song.
- **REQ-SONG-007**: IF MIDI parsing throws an error, THEN the system shall display
  "Import failed: {error}" and shall not crash or enter an undefined state.

---

## 2. Canvas & Visual Rendering

### Ubiquitous Requirements

- **REQ-VIZ-001**: The system shall render a full-window canvas divided into a note-fall
  area (top ~82%) and a virtual piano keyboard (bottom ~18%).
- **REQ-VIZ-002**: The system shall draw a horizontal judgment line at 82% canvas height
  with a blue glow effect and a center diamond indicator.
- **REQ-VIZ-003**: The system shall render each note as a rounded rectangle whose
  vertical position is computed from `y = jLineY - (endBeat - currentBeat) * visualBps`,
  where `visualBps = noteAreaHeight / 8`.
- **REQ-VIZ-004**: The system shall color each note by its pitch class using the note
  color palette (C=red, D=yellow, E=teal, F=blue, G=pink, A=cyan, B=green, with
  distinct colors for sharps).
- **REQ-VIZ-005**: The system shall render a virtual piano keyboard at the canvas bottom
  showing all white and black keys within the visible range, with note name and octave
  labels.
- **REQ-VIZ-006**: The system shall display a HUD overlay at the top of the canvas
  during active gameplay showing: current score, combo counter (when >1), hit/miss
  counts, and game state status text.

### Event-Driven Requirements

- **REQ-VIZ-007**: WHEN a note is hit successfully (perfect/great/good timing), the
  system shall change that note's fill to green and border to bright green.
- **REQ-VIZ-008**: WHEN a note is missed, the system shall change that note's fill to
  red-tinted and border to bright red.
- **REQ-VIZ-009**: WHEN a note is currently intersecting the judgment line (startBeat ≤
  currentBeat ≤ endBeat), the system shall render it in white/bright color with a white
  border to indicate it is the target note.
- **REQ-VIZ-010**: WHEN a hit or miss is registered, the system shall spawn 12 particles
  at the judgment line position that burst outward with gravity.
- **REQ-VIZ-011**: WHEN the microphone is active and a pitch is detected, the system
  shall render a green dot with glow on the corresponding keyboard key, plus the note
  name and cents deviation (±N¢) label.

### State-Driven Requirements

- **REQ-VIZ-012**: WHILE the canvas is empty (no song loaded), the system shall display
  "Select a song to start practicing" centered on the canvas.
- **REQ-VIZ-013**: WHILE game state is 'idle', the system shall hide the HUD overlay.

### Unwanted Behavior Requirements

- **REQ-VIZ-014**: IF the canvas or its parent has zero width or height, THEN the draw
  function shall return immediately without throwing.
- **REQ-VIZ-015**: IF a note's rendered position is off-screen (above the top or past
  the piano keyboard), THEN the system shall skip rendering that note entirely.

---

## 3. Audio Playback

### Event-Driven Requirements

- **REQ-AUD-001**: WHEN the playhead beat reaches a note's `startBeat` (i.e., the start
  of the note reaches the judgment line), the system shall begin playing that note's
  target frequency tone via the Web Audio API.
- **REQ-AUD-002**: The system shall play each note for `(note.duration / audioBps) *
1000` milliseconds, where `audioBps = BPM / 60 * speed`.
- **REQ-AUD-003**: WHEN a note's end beat crosses the piano keyboard (the full note
  rectangle is consumed), the system shall stop the tone, and the note rectangle shall be
  clipped by the keyboard area.

### Unwanted Behavior Requirements

- **REQ-AUD-004**: IF a note has already been played (tracked in `playedNotes` set),
  THEN the system shall not retrigger audio for that note.
- **REQ-AUD-005**: IF a note has a duration of 0 or less, THEN the system shall use a
  default tone duration of 300ms.

---

## 4. Hit Detection & Scoring

### Ubiquitous Requirements

- **REQ-HIT-001**: The system shall evaluate every note exactly once — after the timing
  window has closed, the note shall be marked as judged and never re-evaluated.
- **REQ-HIT-002**: The system shall compute a per-note score as `round(timingScore \* 0.6
  - pitchScore \* 0.4)`, where timingScore ∈ {100, 75, 50} and pitchScore is derived from
`ratingToScore(centsToRating(abs(cents)))`.

### Event-Driven Requirements

- **REQ-HIT-003**: WHEN the detected MIDI pitch matches the target note's MIDI within
  the timing window, the system shall record a hit with the following timing
  classification:
  - deltaMs ≤ 30ms → 'perfect' (timingScore=100)
  - deltaMs ≤ 75ms → 'great' (timingScore=75)
  - deltaMs ≤ 150ms → 'good' (timingScore=50)
- **REQ-HIT-004**: WHEN a hit is recorded, the system shall increment the combo counter
  and update `maxCombo` if the new combo exceeds the previous maximum.
- **REQ-HIT-005**: WHEN a hit is recorded, the system shall add the per-note score to
  the total score.
- **REQ-HIT-006**: WHEN a note passes the good timing window (deltaMs < -150) without a
  matching pitch detection, the system shall record a miss with 0 score and reset the
  combo counter to 0.

### Unwanted Behavior Requirements

- **REQ-HIT-007**: IF the detected pitch is null (no mic signal) and the note is within
  the timing window, THEN the system shall not record a miss immediately — it shall wait
  until the timing window closes.
- **REQ-HIT-008**: IF the detected pitch does not match the target MIDI note, THEN the
  system shall wait until the timing window closes before recording a miss.

---

## 5. Pitch Accuracy Rating

### Ubiquitous Requirements

- **REQ-PITCH-001**: The system shall classify pitch accuracy from cents deviation using
  `centsToRating()`:
  - |cents| ≤ 5 → 'perfect' (score=100)
  - |cents| ≤ 15 → 'excellent' (score=90)
  - |cents| ≤ 25 → 'good' (score=75)
  - |cents| ≤ 50 → 'okay' (score=50)
  - |cents| > 50 → 'off' (score=0)
- **REQ-PITCH-002**: WHEN cents data is null (no pitch detected during hit), the system
  shall default to 'perfect' pitch rating for scoring purposes.

---

## 6. Game State Machine

### State-Driven Requirements

- **REQ-STATE-001**: WHILE game state is 'idle', the system shall display the song
  picker and canvas with notes visible but not moving.
- **REQ-STATE-002**: WHILE game state is 'countdown', the system shall display a
  countdown indicator (number of beats remaining) and scroll notes toward the judgment
  line.
- **REQ-STATE-003**: WHILE game state is 'playing', the system shall:
  - Advance the playhead beat using `performance.now()` relative to `gameStartTime`
  - Run hit detection on every animation frame
  - Play audio tones when notes reach the judgment line
  - Update the HUD with live score/combo information
- **REQ-STATE-004**: WHILE game state is 'paused', the system shall freeze the playhead
  and hide the HUD, preserving all game state for resumption.
- **REQ-STATE-005**: WHILE game state is 'finished', the system shall display a score
  summary overlay with grade classification.

### Event-Driven Requirements

- **REQ-STATE-006**: WHEN the user clicks "Start", the system shall:
  - If count-in beats are configured (>0), transition to 'countdown' state and count
    down from the configured beat count
  - Otherwise, transition immediately to 'playing' state and set `gameStartTime` to
    `performance.now()`
- **REQ-STATE-007**: WHEN all notes in the song have been judged (hit or miss), the
  system shall transition to 'finished' state.
- **REQ-STATE-008**: WHEN the user clicks "Pause" during 'playing' state, the system
  shall transition to 'paused' and store the current playhead beat.
- **REQ-STATE-009**: WHEN the user clicks "Resume" during 'paused' state, the system
  shall transition to 'playing' and rebase `gameStartTime` so the playhead continues
  from the paused beat.
- **REQ-STATE-010**: WHEN the user clicks "Reset" in any state, the system shall return
  to 'idle' with all score, combo, hit results, and playhead reset to zero/empty.

---

## 7. Grade Calculation

### Ubiquitous Requirements

- **REQ-GRADE-001**: The system shall calculate final grade as `(totalScore /
(totalNotes * 100)) * 100`, expressed as a percentage of maximum possible score.
- **REQ-GRADE-002**: The system shall classify the final percentage using `scoreGrade()`:
  - ≥ 90% → 'Pitch Perfect!' (`grade-perfect`)
  - ≥ 80% → 'Excellent!' (`grade-excellent`)
  - ≥ 65% → 'Good!' (`grade-good`)
  - ≥ 50% → 'Okay!' (`grade-okay`)
  - < 50% → 'Needs Work' (`grade-needs-work`)

---

## 8. Microphone Integration

### Event-Driven Requirements

- **REQ-MIC-001**: WHEN the user toggles the microphone on, the system shall initialize
  the AudioContext (if not already running), request microphone access via
  `getUserMedia()`, and begin pitch detection at ~60fps.
- **REQ-MIC-002**: WHEN the user toggles the microphone off, the system shall disconnect
  the AudioContext stream and stop all pitch detection.
- **REQ-MIC-003**: WHEN the microphone permission is denied or an audio device is
  unavailable, the system shall display an error message and shall not transition to
  'playing' state.

### Unwanted Behavior Requirements

- **REQ-MIC-004**: IF the AudioContext sample rate differs from the engine's expected
  sample rate, THEN the system shall log a warning and continue with the actual sample
  rate.

---

## 9. Canvas Lifecycle & Performance

### Ubiquitous Requirements

- **REQ-PERF-001**: The system shall use `requestAnimationFrame` for the render loop.
- **REQ-PERF-002**: The system shall handle device pixel ratio (DPR) scaling using
  `window.devicePixelRatio` to ensure crisp rendering on high-DPI displays.
- **REQ-PERF-003**: The system shall observe parent element resizing via `ResizeObserver`
  and recalculate canvas dimensions accordingly.

### Event-Driven Requirements

- **REQ-PERF-004**: WHEN the component unmounts, the system shall cancel the animation
  frame, disconnect the ResizeObserver, and stop the microphone to prevent resource
  leaks.

---

## 10. Note Identity

### Ubiquitous Requirements

- **REQ-ID-001**: Every `FallingNote` object shall have a unique numeric `id` field
  usable as a key for hit-tracking via `judgedNotes` and `playedNotes` sets.

---

## Traceability Matrix

| Requirement                               | Tests                                                          | Files                                            |
| ----------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------ |
| REQ-HIT-003, REQ-HIT-006                  | falling-notes.test.ts: Timing window classification (10 tests) | useFallingNotesController.ts                     |
| REQ-HIT-002, REQ-PITCH-001, REQ-PITCH-002 | falling-notes.test.ts: Note score calculation (7 tests)        | useFallingNotesController.ts, practice-engine.ts |
| REQ-GRADE-001, REQ-GRADE-002              | falling-notes.test.ts: scoreGrade (5 tests)                    | practice-engine.ts                               |
| REQ-STATE-010                             | falling-notes.test.ts: resetGame resets all (1 test)           | falling-notes-store.ts                           |
| REQ-STATE, REQ-SONG-004                   | falling-notes.test.ts: loadSong sets all state (1 test)        | falling-notes-store.ts                           |
| REQ-HIT-004                               | falling-notes.test.ts: maxCombo tracks highest (1 test)        | falling-notes-store.ts                           |
| REQ-AUD-001                               | falling-notes.test.ts: beatsPerSecond (1 test)                 | falling-notes-store.ts                           |
| REQ-ID-001                                | falling-notes.test.ts: FallingNote identity (1 test)           | types                                            |
