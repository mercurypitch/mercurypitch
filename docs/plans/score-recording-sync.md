# Hanging a tab on the record

**Status:** phases 1 and 2 shipped. Phase 3 is designed, not built.

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

## 3. Phase 2 — the written part, read on the recording — **shipped**

The room could already measure a stem into a line on the recording's clock, and
could already attach a tab counting musical beats. It could not put the two on
one page, because their clocks mean different things.

**The measurement is the bridge.** It is a transcription of this recording, so
the matcher can say where each part of the written score lands against it. Put
the written notes through that map and the tab is on the record.

- `alignScoreToRecording` measures the fit and hands back the alignment plus
  enough evidence to refuse a bad one.
- `scoreOnRecording` places the written part, and what comes back is an
  ordinary measured reference — one beat per second, no tempo claimed, because
  once notes are pinned to a recording that speeds up and slows down there is
  no musical tempo left to claim. Every surface that draws a measured line
  draws this with no changes at all.
- Note lengths travel through the map too, not just note starts. The recording
  runs at a different rate, so keeping the written duration would leave every
  note wrong by exactly the drift.
- Notes the map puts before the recording began are dropped, which is what a
  tab with a count-in bar needs.

**It refuses rather than guesses.** The matcher always returns its best offsets,
even for a tab of a different song, so two gates stand in front of it: at least
one window has to align at all, and at least a quarter of the written notes have
to be confirmed by the recording. Recall against the written part, not precision
against what was heard — a stem holds notes the tab never claimed, and that is
not the tab being wrong. A confidently wrong alignment reads to a player as
their own timing being wrong, which is the worst failure this feature could
have.

**What landed where**

| Piece                                   | File                                                      |
| --------------------------------------- | --------------------------------------------------------- |
| Measure the fit, place the written part | `src/features/guitar-night/score-on-recording.ts`         |
| Offer it, remember it, take it back     | `useGuitarNightReferenceController.ts`                    |
| The offer itself                        | `GuitarNightApp.tsx`, `.referenceOnRecording*` in the CSS |

**Still per-session, still not on the score.** The alignment lives with the
attached reference and is forgotten when it is detached. It is never written
onto `SavedMidiSong.tempoChanges`: the score's tempo map is what the file says,
one recording's alignment is not a property of the score, and two recordings of
the same song would fight over it. Persisting it across sessions is a small,
separate change and is worth doing only once a reader asks for it twice.

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
