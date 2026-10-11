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

/** A singer's run is kept: history, best and the note. True on a best. */
export function keepRun(target: number, result: HoldResult): boolean {
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
  rememberLongNote(target)
  return improved
}

/**
 * What Merc says over the result: the brim first (steady singing filled
 * the top), then a new best, then the goal (half full).
 */
export function resultMoment(
  improved: boolean,
  full: boolean,
  brim: boolean,
  locked: boolean,
): LongNoteMoment {
  if (brim) return 'resultBrim'
  if (improved) return 'newBest'
  if (full) return 'resultFull'
  // The mic is closed by now: never a line that asks for more singing.
  return locked ? 'result' : 'missed'
}
