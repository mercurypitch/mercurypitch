# Guitar Night melody recorder — EARS requirements

Status: implemented for PR preview; real-interface audition remains an owner
acceptance check. Extends [Guitar Night](guitar-night.ears.md), without changing
its authored-tab rehearsal or existing signal-only Jam Doctor.

## Entry and capture

- **GR-001:** WHEN the player chooses Play free form, the room shall open without
  a song, automatic playback, microphone permission or recording.
- **GR-002:** WHEN Record is pressed with an audio route selected, the recorder
  shall capture that selected mono channel's dry audio and note evidence on one
  frame-relative timeline. MIDI-only mode shall explain that audio input is
  required instead of creating an audio-less take.
- **GR-003:** WHILE Record is preparing, Cancel shall prevent a late permission
  grant from starting capture. Preparation shall not enable live monitoring.
- **GR-004:** WHILE recording, the existing input and output context shall remain
  owned by Listening. The capture branch shall be parallel to the amp, with a
  bounded transferable pool and pitch analysis/PCM16 encoding in a Worker.
- **GR-005:** WHEN Stop recording is pressed, the recorder shall flush durable
  evidence and close the final note. It shall release input only if Record opened
  it, preserving pre-existing Listening and live monitoring.
- **GR-006:** WHILE recording, seeking, speed changes and loop wrapping shall be
  unavailable; mute, mixer levels and amp controls shall remain available.
  Capture may start without backing or while backing plays at a fixed rate.
- **GR-007:** IF playback, input route, selected channel or room lifetime changes,
  or the page becomes hidden, THEN recording shall stop with an explicit partial
  take reason. Reload shall never automatically resume recording or Listening.
- **GR-008:** IF five minutes, backpressure, capture failure or storage failure
  ends recording, THEN the UI shall explain the interruption and retain the
  durable prefix. It shall not silently omit dropped audio or claim a full take.

## Local persistence and review

- **GR-009:** WHILE recording, audio and evidence shall be checkpointed to local
  IndexedDB. A draft currently owned by another tab shall not be recovered.
- **GR-010:** WHEN Stop completes, the existing focus-managed Jam Doctor sheet
  shall offer explicit dry replay, Keep and note review. The original recording
  shall have no invented accuracy grade.
- **GR-011:** IF audio contains no stable melody, THEN Keep audio only shall
  remain available; Practice shall explain why it cannot accept a target yet.
- **GR-012:** WHEN Keep succeeds, one local transaction shall publish Hear
  Yourself audio, metadata, evidence links and any accepted score. Retry shall
  not duplicate audio, and failure shall retain the recoverable draft.
- **GR-013:** WHEN the original audio is removed from Hear Yourself, accepted
  practice notes shall survive and identify unavailable audio. Explicit Remove
  recording and notes shall confirm before removing all owned revisions and
  placements. Other recordings shall be preserved.
- **GR-014:** Recorder tables shall be local-only, excluded from cloud sync and
  Voice Atlas. Upgrading the database shall preserve existing room data.

## Melody correction and reuse

- **GR-015:** The detected melody shall be labelled a draft for single-note
  guitar/bass, with suggested fingering. Raw frames, pitches and onsets shall
  remain immutable through corrections. Chords and bends shall not be promised
  as fully transcribed notation.
- **GR-016:** The initial 120 BPM / 4/4 grid shall be labelled a display grid,
  not a measured tempo. Changing display tempo shall preserve note seconds;
  explicit snapping shall change the practice rhythm and be undoable.
- **GR-017:** WHEN notes are corrected, the editor shall support pitch, timing,
  fingering, split, merge, delete and bounded Undo. Collapsing it shall retain
  Undo; saving shall disable edits until the snapshot completes.
- **GR-018:** WHEN Practice, Attach or Export is chosen, valid notes shall become
  an immutable, uniquely identified accepted revision. Previous targets and
  measured evidence shall not be overwritten by later corrections or attempts.
- **GR-019:** WHEN an accepted melody is selected, it shall load through the
  existing score chooser and tab rehearsal with its views, A/B and scoring.
  IndexedDB shall remain authoritative, not the pruned imported-song cache.
- **GR-020:** WHEN an accepted score is attached to a song, placement shall be
  scoped to that exact song and revision. Captured backing anchors may seed it;
  unrelated free play shall require manual placement. Replacing an attached
  reference shall require confirmation and preserve both saved sources.
- **GR-021:** WHEN timing corrections invalidate captured alignment, the new
  revision shall not reuse that alignment as if it were still measured.
- **GR-022:** WHEN MIDI or Guitar Pro export is requested, the accepted revision
  shall be exported with a safe timestamped filename. `.gp` shall contain actual
  GP7 data; note timing, tuning/capo and fingering shall round-trip through the
  installed parser. Exporters shall load on demand.

## Verification and limits

Automated coverage and owner checks: [recorder testing](../guitar-recording-testing.md).
V1 is five-minute mono dry recording, editable monophonic transcription and
local persistence. Count-in, polyphonic/bend-technique notation, wet recording,
cloud backup and MIDI-input-only recording are follow-ups. Browser latency
estimates and synthetic render tests are not physical round-trip measurements.
