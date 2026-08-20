# Hanging a tab on the record

**Status:** phase 1 shipped. Phases 2 and 3 are designed, not built.

Asked for 2026-08-20:

> research how could we sync the GPx or MIDI to actual same song audio/stem
> separated, as we do for guitar/bass, should it not be somewhat easy to try to
> map the notes, and try to sync the tempo, playback, if we find the correct
> first note... songsterr is doing something like this for YT sync to a guitar
> pro tab source

## 1. What the research found

**The hard part is already built and working.** The Analysis Lab's
`scoreAgainstTruth` aligns a transcribed stem against an authored score in
six-second windows and reports where each window landed. That output —
`windowOffsets` — is an anchor list in everything but name.

**A single offset is not enough, and this is measured, not assumed.** Dance of
Death's own MIDI export runs 528 s against a 517 s recording. Two percent long
is eleven seconds of drift by the last chorus. "Find the first note and shift
everything" puts the ending a bar and a half out, and it degrades badly rather
than gracefully: a global fit lands on whatever offset matches most, which can
be tens of seconds from the truth.

**Songsterr's model is the same model.** A tab is hung on a recording by
anchoring measures to timestamps and interpolating between them, with a person
free to drag an anchor. Per-measure rather than per-window, but that is a
difference in where anchors come from, not in what an anchor is.

**Two problems were already solved along the way and are worth not
re-discovering:**

- _Riff aliasing._ A window in isolation often scores higher one riff-period
  away — every note lands on its neighbour and the whole window silently shifts
  onto the wrong bar. `OFFSET_CONTINUITY_SECONDS` is the continuity prior that
  stops it: real drift between adjacent windows is a fraction of a second, so
  an offset that jumps seconds from its neighbour is an alias, not a
  measurement.
- _Octave errors dragging the ruler._ Candidate offsets are scored on pitch
  class rather than exact pitch, so the octave error being measured cannot pull
  the alignment off and hide itself in the result.

## 2. Phase 1 — an alignment is a thing you can hold — **shipped**

`src/lib/transcription/score-alignment.ts`.

- A `ScoreAlignment` is a list of anchors, each naming one instant on both
  clocks, plus where it came from: `measured` or `manual`. Measured alignments
  are re-derived whenever the transcription changes; a manual one is somebody's
  work and is never silently overwritten.
- `alignmentFromWindowOffsets` turns the Lab's existing output into anchors,
  so nothing new has to be measured.
- `createScoreToAudioClock` / `createAudioToScoreClock` are the map, in both
  directions, as the line through the anchors.
- `nudgeAlignment` slides the whole thing along the recording without
  flattening the measured drift — the knob for "right, but late".
- `alignmentDriftSeconds` answers "is a single slider honest here at all".

Three decisions worth stating:

- **Between anchors, a line, not a step.** The Lab held the nearest previous
  window's offset, which made the tab jump every six seconds and threw away the
  drift happening inside the window.
- **Past the last anchor, keep the slope.** Freezing the offset at the end
  reintroduces exactly the error the anchors exist to remove. One anchor alone
  becomes a constant shift, because that is all one point can honestly claim.
- **An anchor that runs the score backwards is dropped, not clamped.** Later in
  the recording and earlier in the score is never a real measurement; it is an
  aliased window. Clamping would hide a bad measurement behind a plausible
  picture.

## 3. Phase 2 (next) — the room plays the record and the tab follows

The score room can already lease separated stems of the actual song. What it
cannot do is put the authored tab on that recording's clock.

- Persist an alignment per `(sessionId, songId, trackId)`. **Never** onto
  `SavedMidiSong.tempoChanges`: the score's tempo map is what the file says,
  and one recording's alignment is not a property of the score. Two recordings
  of the same song would fight over it.
- Measure on an explicit gesture, the way stem measurement already works, using
  the stem the part is most likely to be in — bass part against the bass stem,
  guitar against guitar.
- Convert once, at the edge: audio seconds through the alignment to score
  seconds, then through `createSecondsToBeatClock` to score beats. Everything
  downstream keeps counting beats and needs no changes at all.
- Offer the nudge, and say the drift out loud. A tab that drifts eleven seconds
  cannot be fixed with one slider, and a surface offering one is lying.

## 4. Phase 3 (later) — anchors a person can place

Per-measure anchors that a reader can drag, for recordings the matcher cannot
measure: a live version, a cover, a song with no separated stems. The data
shape does not change — a dragged anchor is an anchor — so this is a surface,
not a rebuild.

## 5. Testing

`score-alignment.test.ts` covers the module at 100% of statements, branches,
functions and lines, including round-tripping an instant through both clocks,
the backwards-anchor drop, and that a nudge preserves measured drift. The Lab
rewiring is covered by the existing bench tests, which pass unchanged.
