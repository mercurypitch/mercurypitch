// ============================================================
// Segment reps — how many runs a routine segment actually asks for
// ============================================================
//
// The routine has always planned in minutes: the generated daily session
// budgets 60 seconds of warm-up and then 150 + 150 + 120 seconds of drilling,
// and the length picker sells those as "~5 min", "~8 min", "~12 min".
// Nothing made the singer spend them. A segment ticked off after ONE result
// of the right type, and most drills answer in seconds — a Long Note held for
// five closed a segment budgeted at a hundred and fifty. So the app's own
// prescribed session finished in about two and a half minutes of practice,
// the day never reached the five scored minutes the streak asks for, and the
// beginner loop could not be won by doing exactly what the app said.
//
// Reps make the plan binding: a segment asks for as many runs as its budget
// holds, worked out from what one run of that drill actually takes. Five
// five-second long notes is what practising long notes looks like; one is a
// demonstration.

import type { ExerciseType } from '@/features/exercises/types'
import { EXERCISE_ARPEGGIO_JUMPER, EXERCISE_CALL_RESPONSE, EXERCISE_CHORD_STACKER, EXERCISE_DRONE_INTONATION, EXERCISE_DYNAMIC_SWELL, EXERCISE_INTERVAL_TRAINER, EXERCISE_LONG_NOTE, EXERCISE_MIRROR_MELODY, EXERCISE_PITCH_HOLD, EXERCISE_PITCH_PURSUIT, EXERCISE_ROUTINE_RUNNER, EXERCISE_SCALE_RUNNER, EXERCISE_SIGHT_SINGING, EXERCISE_SIREN, EXERCISE_SLIDE, EXERCISE_STACCATO, EXERCISE_VIBRATO, } from '@/features/exercises/types'
import type { RoutineSegment } from './types'

/**
 * What one honest run of a drill costs the singer, in seconds — the sung part
 * plus the breath and the reset before it, which is time spent practising
 * whether or not the meter is running.
 *
 * These are deliberately conservative. Over-estimating gives fewer reps and a
 * shorter session than planned, which is the direction that annoys nobody;
 * under-estimating turns a five-minute routine into a chore. Measured against
 * the seven-day audit's own numbers, where a Long Note run took five seconds
 * of held note and a Sight Singing run forty-two.
 */
const TYPICAL_RUN_SEC: Partial<Record<ExerciseType, number>> = {
  [EXERCISE_LONG_NOTE]: 30,
  [EXERCISE_PITCH_HOLD]: 30,
  [EXERCISE_DYNAMIC_SWELL]: 30,
  [EXERCISE_SIREN]: 30,
  [EXERCISE_SLIDE]: 30,
  [EXERCISE_VIBRATO]: 30,
  [EXERCISE_STACCATO]: 30,
  [EXERCISE_INTERVAL_TRAINER]: 45,
  [EXERCISE_ARPEGGIO_JUMPER]: 45,
  [EXERCISE_SCALE_RUNNER]: 45,
  [EXERCISE_CHORD_STACKER]: 45,
  [EXERCISE_DRONE_INTONATION]: 45,
  [EXERCISE_MIRROR_MELODY]: 45,
  [EXERCISE_PITCH_PURSUIT]: 60,
  [EXERCISE_CALL_RESPONSE]: 60,
  [EXERCISE_SIGHT_SINGING]: 60,
  [EXERCISE_ROUTINE_RUNNER]: 60,
}

/** For a drill with no measured shape yet. Long enough to ask for few reps. */
export const DEFAULT_TYPICAL_RUN_SEC = 60

/**
 * Nobody wants to be told to sing the same drill eight times. Six is already
 * more than any current budget asks for; the cap is here so a future template
 * with a ten-minute segment cannot produce a wall of reps.
 */
export const MAX_REPS = 6

/**
 * The ceiling the five-minute floor is allowed to push a single drill to.
 *
 * A focus template is a warm-up, one drill and a cool-down, so there is no
 * second exercise to spread reps across: held to six, "Vibrato focus, short"
 * came out at four and a half minutes and quietly failed the promise. Eight
 * runs of a thirty-second drill is four minutes on one exercise — which is
 * what choosing a focus asks for, and still short of a wall.
 */
export const MAX_REPS_FLOOR = 8

/**
 * The floor every prescribed session has to clear, in seconds.
 *
 * Not an arbitrary round number: it is DAILY_GOAL_MS from practice-minutes.ts,
 * the five scored minutes that earn the day's streak. The shortest routine on
 * offer calls itself "~5 min", so a singer who does exactly what the app
 * prescribes has to end the session having practised enough for the streak
 * the same app is asking them to keep. Before this, short materialized to
 * about four and three-quarter minutes of plan — and, one run per segment, to
 * two and a half minutes of singing.
 */
export const MIN_SESSION_SEC = 300

/** Seconds one run of this drill is expected to take. */
export function typicalRunSec(exercise: ExerciseType | undefined): number {
  if (exercise === undefined) return DEFAULT_TYPICAL_RUN_SEC
  return TYPICAL_RUN_SEC[exercise] ?? DEFAULT_TYPICAL_RUN_SEC
}

/**
 * How many runs this segment's budget holds.
 *
 * Warm-ups and cool-downs are always one: they run their own internal steps
 * to a script, take their planned minute or two, and `autoAdvanceRoutineSegment`
 * already refuses to tick a warm-up off unless every step ran. Repeating one
 * would be asking the singer to warm up twice.
 */
export function repsForSegment(seg: RoutineSegment): number {
  if (seg.type !== 'exercise') return 1
  const perRun = typicalRunSec(seg.config.exercise)
  const fits = Math.round(seg.durationSec / perRun)
  return Math.min(MAX_REPS, Math.max(1, fits))
}

/**
 * How many runs a segment asks for, as stored.
 *
 * Absent means one, NOT "work it out" — a routine persisted before reps
 * existed is half-run on somebody's device, and recomputing would move the
 * finish line under them mid-session. New routines carry the number.
 */
export function segmentReps(seg: RoutineSegment): number {
  const reps = seg.reps
  return typeof reps === 'number' && Number.isFinite(reps) && reps >= 1
    ? Math.floor(reps)
    : 1
}

/**
 * The same segment, carrying the rep count its budget holds — and, for a
 * drill, a duration that is the reps rather than the budget.
 *
 * The budget was always a guess at what the singer would spend; the reps are
 * what the app now asks for. Letting the two disagree would put "3m" on a row
 * that asks for two forty-five-second runs, and the panel's minutes are the
 * only place the promise in the length picker can be checked.
 */
export function withReps(seg: RoutineSegment): RoutineSegment {
  if (seg.type !== 'exercise') return { ...seg, reps: 1 }
  const reps = repsForSegment(seg)
  return {
    ...seg,
    reps,
    durationSec: reps * typicalRunSec(seg.config.exercise),
  }
}

/** What this run of the routine actually asks the singer to sing, in seconds. */
export function totalRepDurationSec(
  segments: readonly RoutineSegment[],
): number {
  return segments.reduce((sum, seg) => sum + seg.durationSec, 0)
}

/**
 * Give every segment its reps, then top the session up until it clears the
 * five-minute floor.
 *
 * Two passes, and the order is the point: spread the top-up across every drill
 * first, and only once they are all at the comfortable cap ask any one of them
 * for more. A session with three drills never reaches the second pass; a
 * single-drill focus template only gets there because it has nowhere else to
 * put the minutes.
 *
 * A routine of nothing but warm-ups cannot be padded at all. It is returned
 * short rather than looped over forever.
 */
export function applyReps(
  segments: readonly RoutineSegment[],
): RoutineSegment[] {
  const out = segments.map(withReps)
  padUpTo(out, MAX_REPS)
  padUpTo(out, MAX_REPS_FLOOR)
  return out
}

/** Add reps, always to the shortest drill, until the floor is met or nothing
 *  under `cap` is left to add to. */
function padUpTo(out: RoutineSegment[], cap: number): void {
  while (totalRepDurationSec(out) < MIN_SESSION_SEC) {
    const idx = shortestPaddableIndex(out, cap)
    if (idx === -1) return
    const seg = out[idx]!
    const reps = segmentReps(seg) + 1
    out[idx] = {
      ...seg,
      reps,
      durationSec: reps * typicalRunSec(seg.config.exercise),
    }
  }
}

/**
 * The drill with the least asked of it that can still take another rep, or -1.
 * First one wins a tie, so the same routine always pads the same way.
 */
function shortestPaddableIndex(
  segments: readonly RoutineSegment[],
  cap: number,
): number {
  let best = -1
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]!
    if (seg.type !== 'exercise' || segmentReps(seg) >= cap) continue
    if (best === -1 || seg.durationSec < segments[best]!.durationSec) best = i
  }
  return best
}
