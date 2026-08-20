# Hanging a tab on the record

**Status:** all three phases shipped.

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

## 4. Phase 3 — anchors a person can place — **shipped**

The matcher needs a transcription of this recording, and there is not always
one: a live version, a cover, a song whose stems were never separated. Before
this, an attached tab in the play-along room could only say out loud that it
"keeps its own BPM" and could not follow the record. That note is what phase 3
replaces.

**The gesture is the loop's gesture,** because the room already taught it: play
to a moment and say "here". Two moments — the part's first note and its last —
fix both where the part starts and how fast the recording runs against it. One
mark alone is a constant shift, which is all one point can honestly claim.

**A nudge, once it is placed.** Sliding something that is not there yet means
nothing, so the nudge appears only after the part is on the recording. It moves
every anchor together, so a measured drift survives rather than being flattened
by it — and the result is marked as hand-placed, because it is now somebody's
decision.

**No made-up confidence.** A hand placement has no share of the part confirmed
by anything, and the type says so: `placedBy: 'measured'` carries a
`matchedFraction`, `placedBy: 'hand'` has no such field. The copy cannot
quietly print 0% for a part the reader placed themselves.

**Two ways in.** The offer stands next to an attached tab whenever a recording
is staged, which is the case the room's own copy admitted was broken. It also
appears as a fallback the moment the matcher refuses a score, naming the score
already chosen rather than making the reader choose again.

**Coming back means going back to what you had.** A part hung over a stem
measurement returns to the line the transcriber heard; one hung by hand on an
attached tab returns to that tab, on its own clock.

**What landed where**

| Piece                                         | File                                             |
| --------------------------------------------- | ------------------------------------------------ |
| The span of a part, and marks into anchors    | `score-on-recording.ts`                          |
| Claim a part, mark, clear, nudge              | `useGuitarNightReferenceController.ts`           |
| The controls, in the room that owns the clock | `GuitarNightHandSync.tsx`, `GuitarNightRoom.tsx` |
| The offer, and the fallback after a refusal   | `GuitarNightOnRecording.tsx`                     |

**Still to come:** per-measure anchors rather than two ends. The data shape does
not change — a dragged anchor is an anchor — so it stays a surface question,
and two ends is enough to fix both the offset and the rate.

## 5. Testing

`score-alignment.test.ts` covers the alignment module at 100% of statements,
branches, functions and lines, including round-tripping an instant through both
clocks, the backwards-anchor drop, and that a nudge preserves measured drift.
The Lab rewiring is covered by the existing bench tests, which pass unchanged.

`score-on-recording.test.ts` covers measuring and placing at 100%, including a
round trip: measure a written line against a recording of itself that runs 2%
fast and starts 1.5s late, place it, and assert every placed note lands within
tolerance of the note actually heard at that moment.

`GuitarNightHandSync.test.tsx` and `GuitarNightOnRecording.test.tsx` cover both
surfaces at 100%, and `guitar-night-hand-sync.spec.ts` walks the whole thing in
a browser: attach a tab, stage a recording, claim the part, mark it, nudge it,
clear it.
