# Zen Exercise Playback — EARS Requirements

Requirements for the Zen stage's transport state machine and its guide-note
playback: the three session states and every transition between them, take
selection, the mute gate, and the note scheduler that sounds the targets.

Written after a multi-bug report from owner testing on dev (v0.8.0): guide
notes sounded only on the first lap, truncated mid-phrase, the mute control
did not read as changed, play/pause and restart disagreed, and switching take
mid-run left the stage inconsistent.

**Source:** `src/features/zen/useZenPitchSession.ts` — the state machine
(`status`, `start` / `pause` / `resume` / `restart` / `finish`, take
selection); `src/features/zen/note-playback.ts` — the guide-note scheduler;
`src/features/zen/ZenPitchStage.tsx` — transport, take strip and mute control;
`src/features/zen/zen-model.ts` — `exerciseLoopDuration`, `resolveZenTargets`
**Tests:** `src/tests/zen-note-playback.test.ts`,
`src/tests/zen-pitch-session.test.tsx`,
`src/tests/zen-pitch-stage-transport.test.tsx` (`REQ-ZENP-001..034`)

EARS keywords: **WHEN** (event), **WHILE** (state), **IF/THEN** (unwanted
behaviour), **WHERE** (optional feature), otherwise ubiquitous ("shall").

## Vocabulary

| Term | Meaning |
|---|---|
| **stopped** | `status() === 'idle'` — nothing is being captured. |
| **playing** | `status() === 'running'` — frames are captured, the lap clock runs. |
| **paused** | `status() === 'paused'` — the lap clock is held, position preserved. |
| **lap** | One pass of `loopDurationSec`. A completed lap becomes a take. |
| **take** | A finalized `ZenPitchRun`. `loopsCompleted()` counts laps since the last start. |
| **live** | No take selected — the canvas shows what is being sung now. |

## Session states — `REQ-ZENP-001..004`

### REQ-ZENP-001 — Three states
The session **shall** expose exactly one of `idle`, `running` or `paused`, and
the stage's transport, take strip and guide controls **shall** derive their
enabled state from it rather than from a second copy of it.

### REQ-ZENP-002 — Stopped is the resting state
**WHILE** stopped, the session **shall** capture no frames, hold `elapsedSec`
at 0, and sound no guide notes.

### REQ-ZENP-003 — Paused preserves position
**WHEN** the session is paused, it **shall** stop advancing the lap clock while
preserving elapsed position, and **WHEN** resumed **shall** continue from that
point rather than from the start of the lap.

### REQ-ZENP-004 — One transport truth
**WHILE** the session is in any state, the footer transport control and the
guide's start control **shall not** offer two different meanings for the same
state. Exactly one control **shall** be able to begin a pass at a time.

## Starting — `REQ-ZENP-005..008`

### REQ-ZENP-005 — Start requires the mic
**WHEN** the user starts a pass and the microphone cannot be acquired, the
session **shall** remain stopped and the stage **shall** show a recoverable
error.

### REQ-ZENP-006 — Start is a clean slate
**WHEN** a pass starts, the session **shall** reset elapsed time, live points,
lap count and take selection, so the pass begins live at the left seam.

### REQ-ZENP-007 — Concurrent starts collapse
**IF** a start is requested while one is already in flight, **THEN** the
session **shall** return the in-flight start rather than opening a second
capture.

### REQ-ZENP-008 — A start that outlives the stage releases the mic
**IF** a microphone permission prompt resolves after the stage has closed,
**THEN** the session **shall** release any microphone it acquired.

## Restarting — `REQ-ZENP-009..012`

### REQ-ZENP-009 — Restart is available while playing or paused
**WHERE** the session is playing or paused, the stage **shall** offer an
explicit restart control; **WHILE** stopped, restart **shall** be unavailable
and the start control **shall** take its place.

### REQ-ZENP-010 — Restart never discards silently
**WHEN** the user restarts, the session **shall** finalize the pass in progress
before beginning the new one, so that a take with enough voiced material is
kept rather than dropped.

### REQ-ZENP-011 — Restart resets the lap counter
**WHEN** a restart completes, `loopsCompleted()` **shall** be 0 and the canvas
**shall** be live.

### REQ-ZENP-012 — Restart from stopped is a start
**WHEN** restart is invoked while stopped, it **shall** behave exactly as a
start and **shall not** finalize an empty take.

## Guide-note playback — `REQ-ZENP-013..020`

### REQ-ZENP-013 — Notes sound on every lap
**WHILE** playing with guide notes enabled, every target **shall** sound once
per lap, on every lap, for as long as the session runs. Lap identity **shall**
come from the session's lap counter, never from elapsed time — elapsed time is
reset at each seam and cannot distinguish one lap from the next.

### REQ-ZENP-014 — Every note sounds, however short
**WHEN** two consecutive samples straddle a target's start, the scheduler
**shall** sound that target. A target **shall not** be skipped because no
sample landed inside its window; playback back-fills anything that started
inside the gap.

### REQ-ZENP-015 — Each target sounds once per lap
**WHILE** playing, a target **shall** sound at most once per lap regardless of
how many samples fall inside its window.

### REQ-ZENP-016 — No back-fill across a discontinuity
**WHEN** the lap wraps, or playback is paused, resumed, or re-armed, the
scheduler **shall not** replay targets whose start lies before the
discontinuity. A lap seam **shall not** fire the whole lap at once.

### REQ-ZENP-017 — Visibility gates sound
**WHILE** target visibility is `dim` or `off`, no guide note **shall** sound.
Hidden targets are a deliberate from-memory mode.

### REQ-ZENP-018 — Mute silences without stopping
**WHILE** guide notes are muted, no new note **shall** be scheduled; the
session **shall** continue playing and capturing unaffected.

### REQ-ZENP-019 — Unmuting is audible immediately
**WHEN** the user unmutes mid-lap, a target whose window contains the current
position **shall** sound at once, and targets whose windows have already passed
**shall not**.

### REQ-ZENP-020 — Notes never sound outside playing
**WHILE** stopped or paused, no guide note **shall** be scheduled.

## The mute control — `REQ-ZENP-021..023`

### REQ-ZENP-021 — The control reports the mute, not the sound
The mute control's `aria-pressed` **shall** be true when guide notes are muted
and false when they are audible.

### REQ-ZENP-022 — Muted state is visible
**WHILE** guide notes are muted, the control **shall** carry a distinct visual
state, not only a swapped icon, so the mute reads as engaged at a glance.

### REQ-ZENP-023 — Unavailable when it cannot apply
**WHILE** target visibility is not `on`, the mute control **shall** be disabled
and **shall** explain why.

## Take selection — `REQ-ZENP-024..029`

### REQ-ZENP-024 — No take change while playing
**WHILE** playing, the session **shall** refuse to move the take selection, and
the stage **shall** disable the take strip's previous, next and delete
controls. Reviewing a take requires pausing or stopping first.

### REQ-ZENP-025 — Refusal is reported, not silent
**WHEN** a take change is refused, the operation **shall** return false so a
caller can tell it did not happen.

### REQ-ZENP-026 — Take change is allowed when paused or stopped
**WHILE** paused or stopped, the user **shall** be able to move through takes
and delete the selected one.

### REQ-ZENP-027 — Returning to live is always allowed
Returning to the live take **shall** be permitted in every state, including
while playing.

### REQ-ZENP-028 — Resuming returns to live
**WHEN** a paused session with a take selected is resumed, the selection
**shall** drop back to live so the playhead and the incoming trace are visible
again.

### REQ-ZENP-029 — A selected take freezes only the canvas
**WHILE** a take is selected, the canvas **shall** render that take's points,
viewport and duration, and the playhead **shall** be hidden — the playhead
belongs to the live pass only.

## Completion — `REQ-ZENP-030..032`

### REQ-ZENP-030 — A lap becomes a take
**WHEN** a lap completes with at least three voiced samples, the session
**shall** finalize a take, increment the take number and the lap counter, and
begin the next lap at the left seam.

### REQ-ZENP-031 — A bounded session stands down
**WHERE** a loop limit is set, the session **shall** stop itself when the limit
is reached, fire its completion handler exactly once, and **shall not** stop
the microphone — the caller sequencing the steps owns it.

### REQ-ZENP-032 — Finish finalizes
**WHEN** the user finishes, the session **shall** finalize the pass in progress
with the elapsed duration and return to stopped.

## Exercise change — `REQ-ZENP-033..034`

### REQ-ZENP-033 — Changing exercise stops first
**WHEN** the selected exercise changes, the session **shall** finalize any pass
in progress and return to stopped before adopting the new definition.

### REQ-ZENP-034 — Changing exercise resets derived state
**WHEN** the exercise changes, the session **shall** reset targets, root,
loop duration, take history, take number, lap counter and take selection to
the new exercise's defaults, leaving no counter reading from the old one.

## Tempo — `REQ-ZENP-035`

### REQ-ZENP-035 — Tempo is authored, not overridden
An exercise's tempo **shall** come from its authored `bpm` and `loopBeats`, and
the stage **shall not** offer a tempo or loop-length override while an exercise
is loaded. The loop-length control belongs to the open pitch monitor, which has
no authored tempo to fight.
