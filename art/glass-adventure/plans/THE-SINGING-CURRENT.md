# The Singing Current

The next mini-game is a finite moving course through the floating museum. Merc
travels forward automatically. The player chooses among three lanes, jumps over
clearly visible gaps and sings to approaching glass. One Start gesture opens the
microphone for the run; there is no separate button at each target.

This is the approved implementation plan. Implementation and device acceptance
are tracked separately from this document.

## First course

The course has 160 beats and lasts approximately 90.88 seconds, excluding loading,
count-in and recovery. Tempo changes are authored at beats 64 and 96.

| Beats   | Tempo | Lesson and movement                                             |
| ------- | ----- | --------------------------------------------------------------- |
| 0–15    | 96    | Hold a comfortable note; wide, safe runway.                     |
| 16–31   | 96    | Practise changing lanes and one jump, without assessed singing. |
| 32–47   | 96    | One higher note, then one lower note.                           |
| 48–63   | 96    | Join two notes; optional discoveries afterward.                 |
| 64–79   | 108   | Join three notes; a safe lane change afterward.                 |
| 80–95   | 108   | Movement and breathing space, including a telegraphed jump.     |
| 96–111  | 116   | Follow the five-note Sunlit Steps phrase.                       |
| 112–127 | 116   | Optional discoveries and a short two-note rehearsal.            |
| 128–143 | 116   | A broad pearl runway, breathing space and a finale example.     |
| 144–159 | 116   | Repeat the learned melody. Finish at beat 160.                  |

The first course separates precision movement from assessed singing. A missed
phrase clears the combo and the glass yields before Merc reaches it. A missed
jump offers checkpoint recovery. Completion, singing quality and collected
discoveries remain distinct; none silently becomes a new spending currency.

## Decisions

- Three lanes give readable vocal targets and predictable touch input. Free
  steering would add camera and gesture ambiguity while singing.
- An authored ending makes timing and recovery testable. Endless generation can
  later reuse certified sections after this course works well on devices.
- Music ducks before each known vocal window. Reacting only after hearing a
  voice would let the speaker feed the pitch detector during the onset.
- A fixed trailing camera keeps the next obstacle and staff in view. Orbiting
  remains appropriate for galleries, but would compete with runner controls.
- The course has its own compiler and simulation. Gallery challenges intentionally
  stop movement, so reusing their game state would mix incompatible rules.

## Technical contract

The shared AudioContext is the timing authority. Simulation and pitch evidence
map through the same attempt epoch. Readiness and count-in happen before that
epoch starts. Pause, recovery and retry clear stale input/evidence and establish
a fresh epoch before the course resumes.

The compiler validates tempo, target windows, range, protected singing sections,
jump reachability, safe lanes, checkpoints and bounded resident chunks. The core
is deterministic and accepts timestamped input and capture evidence. It alone
emits target outcomes and reward events. Presentation cannot award a hit.

Pitch frames are judged by capture time, with a bounded detector-delivery grace.
Silence, stale frames, duplicated sequences and observations from retired epochs
cannot fill notes. A long frame gap pauses instead of skipping unjudged obstacles.

Only nearby course chunks, approaching glass and a bounded release effect remain
resident. Existing Merc, marble, glass, sky and Living Glass assets are reused.
Runtime staff notation has five lines and comes from the compiled note data;
decorative reference artwork is not a source of musical truth.

## Acceptance

Tests must cover compiler rejection, safe paths, fixed-step movement, capture
timing, late delivery, interruption, checkpoint recovery, exactly-once outcomes,
monotonic saves and resource disposal. Real pointer and PCM browser tests cover
the shared UI in both hosts. Actual-render checks cover phone, tablet and desktop
composition separately from input tests.

Physical-device checks must establish frame pacing, microphone routing and that
speaker playback alone cannot earn a hit. Automated synthetic-audio tests do not
establish those acoustic or hardware properties. Three WebGL remains the game
renderer; the future TypeGPU migration is outside this work.
