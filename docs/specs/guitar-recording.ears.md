# Guitar Night melody recorder — EARS requirements

Status: core recorder published for PR preview; GR-023–033 follow-up implemented
locally, awaiting publication and owner audition. Extends
[Guitar Night](guitar-night.ears.md), without changing its authored-tab rehearsal
or existing signal-only Jam Doctor.

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
  shall offer explicit recording/note replay, Keep and note review. The original recording
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
- **GR-018:** WHEN Practice, Attach or Guitar Pro export is chosen, valid notes
  shall become an immutable, uniquely identified accepted revision. Previous targets and
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
- **GR-022:** WHEN MIDI or Guitar Pro export is requested, the current corrections
  (MIDI) or accepted playable revision (Guitar Pro) shall be exported with a safe
  timestamped filename. MIDI shall not require guitar fingering or implicitly
  replace an accepted guitar target. `.gp` shall contain actual
  GP7 data; note timing, tuning/capo and fingering shall round-trip through the
  installed parser. Exporters shall load on demand.
- **GR-023:** IF notes need fingering, THEN review shall identify their count,
  select a problem note directly, and offer explicit undoable exclusion from the
  editable melody. Captured notes/audio shall remain unchanged. Guitar practice,
  attachment and Guitar Pro export shall remain unavailable until their actual
  requirements are met; MIDI shall use musical-data validation independently.
- **GR-024:** WHILE recording without a guiding reference, the existing stage
  shall optionally show completed and currently recognized notes at their
  captured times. The live-preview preference shall affect rendering only.
  The recent-history viewport shall not delay audio or quantize note timing.
- **GR-025:** WHEN recording stops, the draft shall remain on the stage and
  Review take shall reopen its sheet without a song or new recording. Corrections
  shall update this draft preview. Recording and note audition shall not accept
  a score; A/B and grading shall use the existing rehearsal after explicit
  Practice acceptance.
- **GR-026:** In free form, Record shall be centered. In song playback it shall
  not compress the existing speed/volume controls or displace Listening/mix.
- **GR-027:** WHILE live notes are enabled during capture, the viewport shall
  follow the owned capture audio clock between durable checkpoints. Disabling
  live notes, stopping or disposing the room shall retire its visual frame loop.
  Capture timestamps and analysis cadence shall not depend on animation frames.
- **GR-028:** WHEN My melodies is opened, a focus-managed room gallery shall
  display captured-note previews, duration, note count, range, creation date,
  input and saved/draft state. It shall load bounded pages of ending evidence
  without loading PCM chunks or audio payloads, and shall not shrink the stage
  or begin playback/input. Missing evidence shall not be shown as zero notes.
- **GR-029:** In free form, the rail shall have at most two recorder rows:
  a take timeline above centered Play/Pause, Stop and Record controls, with
  compact source/tone choices. Listening/mix shall keep independent tight rows.
  The stage illustration shall be a labelled alternative Record/Stop action,
  beside take metadata, Review and an options menu containing Live notes.
  Artwork shall remain static until its separate animation phase is approved.
- **GR-030:** WHEN Play is chosen, the selected Recording or Notes source shall
  drive the draft highway from its actual playback position. Recording shall
  replay original input with captured evidence; Notes shall synthesize valid
  pitches and exact corrected timing without requiring guitar fingering.
  Missing audio shall disable only Recording; missing valid notes shall disable
  only Notes. Playback shall never acquire input or implicitly accept a score.
- **GR-031:** The deck and review shall share one audition owner and the same
  Recording/Notes and Current amp/Clean/Saved amp controls. Current amp shall
  follow Session's on/off and parameters; Clean shall bypass app processing;
  Saved amp shall reapply the starting snapshot without changing room settings.
  Missing snapshots shall disable Saved amp. External recorded colour cannot
  be removed; saved settings shall not be labelled an exact wet recording.
- **GR-032:** WHEN source or draft changes, or corrections change during Notes
  playback, audition shall pause/rewind without auto-start. Tone changes shall apply smoothly to
  the active audition. Opening/closing review shall park playback, then offer
  explicit Play there. Capture, conflicting playback, microphone Listening and
  room exit shall retire audition; stale async completions shall not resume it.
- **GR-033:** Audition shall borrow the room output context and use its own
  shared amp/cabinet stage after the source sum, before the final fade envelope.
  It shall not double-process through the guide amp, change stored audio, or
  load DSP before Play. Cabinet loading/fallback shall be visible, failed audio
  routing shall not silently play dry, and both output channels shall be fed.
- **GR-034:** A pointer timeline gesture shall preview a target and commit on
  release; keyboard changes shall seek directly. Recording and Notes shall
  support pre-Play, paused and playing seeks with pop-free cancellation. Stop
  shall rewind; Pause shall retain position. Seek alone shall not start input
  or playback, and stale decoder/scheduler completions shall not restart it.
- **GR-035:** My melodies shall retain its full gallery and offer a distinct
  quick-switch trigger plus a held-touch shortcut. A selection shall load
  without auto-playing or opening Review. Trash actions in both views shall
  confirm the exact take and linked local data before deletion. Failed or
  stale loads shall preserve the active take; deleting another take shall not
  clear it. Capturing/locked recordings shall not be removed.

## Verification and limits

Automated coverage and owner checks: [recorder testing](../guitar-recording-testing.md).
V1 is five-minute mono dry recording, editable monophonic transcription and
local persistence. Count-in, polyphonic/bend-technique notation, wet recording,
cloud backup and MIDI-input-only recording are follow-ups. Browser latency
estimates and synthetic render tests are not physical round-trip measurements.
