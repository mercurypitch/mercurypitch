// ============================================================
// Sing It in Time: a run's score, its tally and its metrics
// ============================================================
//
// Pitch is scored, note by note; timing is shown and never scored (SEASON-2
// § 5.2 item 11, as Lesson 18's checkpoint keeps it). A note in tune or off
// scores by how far it sat from its own note on the Voice Mirror's per-note
// ruler (`matchScore`: 100 within 12 cents, 70 at 35, 40 at 60, nothing
// past 120), so the run's grade and the band words the lessons use agree;
// a note not heard scores 0, as does a note the run never reached. The
// run's score is the mean over every note of every tune planned, so a
// stopped run cannot score a whole run's mark on the notes it reached, and
// it is marked stopped besides (`stoppedEarlyMark`).
//
// The note tally (exercise-note-tally.ts) counts each note presented, with
// its distance from its own note, or none where it was not heard.

import { matchScore } from '@/lib/mirror/metrics'
import { tallyFromDeviations } from '../exercise-note-tally'
import type { ExerciseResult } from '../types'
import { EXERCISE_SING_IN_TIME, stoppedEarlyMark } from '../types'
import type { NoteVerdict } from './take-judge'
import type { Tune } from './tune-plan'

/** A note's score, 0 to 100: a verdict's distance on the Mirror's ruler, 0 for one not heard or not reached. */
export function noteScore(v: NoteVerdict | null): number {
  if (v === null || v.cents === null) return 0
  return matchScore(Math.abs(v.cents))
}

/** What a run's notes came to. */
export interface RunTally {
  /** Notes planned, in every tune. */
  readonly notes: number
  /** Notes judged: the run reached them. */
  readonly judged: number
  readonly inTune: number
  readonly off: number
  readonly notHeard: number
  /** Of the notes in tune that were timed: */
  readonly onTime: number
  readonly early: number
  readonly late: number
}

export function tallyOf(
  marks: readonly (readonly (NoteVerdict | null)[])[],
): RunTally {
  const all = marks.flat()
  const judged = all.filter((v): v is NoteVerdict => v !== null)
  const count = (keep: (v: NoteVerdict) => boolean): number =>
    judged.filter(keep).length
  return {
    notes: all.length,
    judged: judged.length,
    inTune: count((v) => v.pitch === 'in-tune'),
    off: count((v) => v.pitch === 'off'),
    notHeard: count((v) => v.pitch === 'not-heard'),
    onTime: count((v) => v.timing === 'on-time'),
    early: count((v) => v.timing === 'early'),
    late: count((v) => v.timing === 'late'),
  }
}

/** The mean of the notes' scores, over `notes` of them: every note planned, or those judged so far. */
export function meanScore(
  marks: readonly (readonly (NoteVerdict | null)[])[],
  over: 'planned' | 'judged',
): number {
  const all = marks.flat()
  const counted = over === 'planned' ? all : all.filter((v) => v !== null)
  if (counted.length === 0) return 0
  return Math.round(
    counted.reduce((sum, v) => sum + noteScore(v), 0) / counted.length,
  )
}

export interface RunSummary {
  readonly tunes: readonly Tune[]
  readonly marks: readonly (readonly (NoteVerdict | null)[])[]
  /** Tunes whose take closed: every note judged. */
  readonly tunesDone: number
  /** Tunes the run reached: those done, and one it was stopped in. */
  readonly tunesStarted: number
  readonly level: number
}

/** The run's result, as the history records it. */
export function runResult(s: RunSummary, completedAt: number): ExerciseResult {
  const tally = tallyOf(s.marks)
  const stopped = s.tunesDone < s.tunes.length
  return {
    type: EXERCISE_SING_IN_TIME,
    score: meanScore(s.marks, 'planned'),
    metrics: {
      tunes: s.tunes.length,
      tunesDone: s.tunesDone,
      notesPlanned: tally.notes,
      inTune: tally.inTune,
      off: tally.off,
      notHeard: tally.notHeard,
      onTime: tally.onTime,
      early: tally.early,
      late: tally.late,
      bpm: s.tunes[0]?.bpm ?? 0,
      level: s.level,
      ...stoppedEarlyMark(stopped),
      // Every note of every tune put up, the unreached and the unheard as
      // misses; a tune the run never reached presented nothing.
      ...tallyFromDeviations(
        s.marks
          .slice(0, s.tunesStarted)
          .flat()
          .map((v) =>
            v === null || v.cents === null ? null : Math.abs(v.cents),
          ),
      ),
    },
    completedAt,
  }
}
