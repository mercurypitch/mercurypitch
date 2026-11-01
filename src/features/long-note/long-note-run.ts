// ============================================================
// A finished Long note run — what it says and what it keeps
// ============================================================
//
// The live run's end, out of useLongNoteController: whether a take was a
// run at all, what Merc says over its result, and what a run leaves behind
// (the exercise history, the best on its note and the note itself). The
// demo's takes never come here: nothing of a demo is kept.

import { EXERCISE_LONG_NOTE_LANTERN } from '@/lib/domain/exercise-contracts'
import type { HoldState } from '@/lib/hold/hold-engine'
import type { HoldResult } from '@/lib/hold/hold-metrics'
import { recordExerciseResult } from '@/stores/exercise-history-store'
import { recordLongNoteBest } from './long-note-best'
import type { LongNoteMoment } from './merc-lines'
import { rememberLongNote } from './remembered-note'

/** A take that never found the note and lasted less is not a run. */
const FALSE_START_SECONDS = 1.5

/** No lock, and too short to be a run: a cough or a stray frame. */
export function isFalseStart(engine: HoldState, result: HoldResult): boolean {
  if (result.locked) return false
  const { firstVoicedAt, lastVoicedAt } = engine
  const voicedSeconds =
    firstVoicedAt === null || lastVoicedAt === null
      ? 0
      : lastVoicedAt - firstVoicedAt
  return voicedSeconds < FALSE_START_SECONDS
}

/**
 * A singer's run is kept: history, best and the note, with whether the
 * singer chose it (remembered-note.ts). True on a best.
 */
export function keepRun(
  target: number,
  result: HoldResult,
  chosen: boolean,
): boolean {
  if (!result.locked) return false
  recordExerciseResult({
    type: EXERCISE_LONG_NOTE_LANTERN,
    score: result.score,
    metrics: result.metrics,
    completedAt: Date.now(),
  })
  const { improved } = recordLongNoteBest(target, {
    inBandSeconds: result.metrics.inBandSeconds,
    steadiness: result.score,
    at: Date.now(),
  })
  rememberLongNote(target, chosen)
  return improved
}

/** A reach this close to 1 lets the top fill to the brim. */
const FULL_REACH = 1 - 1e-6

/**
 * What Merc says over the result, from the take's engine at its end: a take
 * that never locked is missed, whatever else it reached, since keepRun
 * keeps nothing of it. Then the brim first, a new best, and past the goal
 * why the brim did not come: the voice was steady enough for it at this
 * level and the note ended first (longer), or it was not, which no length
 * would have mended (steadier).
 */
export function resultMoment(
  improved: boolean,
  engine: HoldState,
  locked: boolean,
): LongNoteMoment {
  // The mic is closed by now: never a line that asks for more singing.
  if (!locked) return 'missed'
  if (engine.brimReached) return 'resultBrim'
  if (improved) return 'newBest'
  if (!engine.goalReached) return 'result'
  return engine.reach < FULL_REACH ? 'resultSteadier' : 'resultLonger'
}
