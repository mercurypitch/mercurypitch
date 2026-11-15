// ============================================================
// Merc on the drill stage: the pose he takes for the run's state
// ============================================================
//
// Every drill runs in one shell, and Merc stands beside its sheet for all of
// it: the setup, the run and the result. He is one Merc for the whole visit,
// so the shell hands him a pose instead of mounting a new Merc for each
// state. This is the whole of that choice, kept apart from the shell so it
// can be read and tested without one.

import type { MercState } from '@/lib/merc/constants'
import { gradeForScore } from '../feedback'
import type { ExerciseStatus } from '../types'

export interface StageMoment {
  /** The run's status, as the shell reads it. */
  status: ExerciseStatus
  /**
   * The finished run's score, when the run was graded. Null for a run that
   * has no score to show: one in progress, one stopped early, an ungraded
   * drill, a guided dose.
   */
  score: number | null
}

/**
 * Merc's pose for a moment of a drill.
 *
 * He listens while the singer sings and cheers a run graded S or A, the two
 * grades the result card prints in its brightest inks. For everything else
 * he stands easy: a lower score is not a thing to cheer, and it is not a
 * thing to look glum about either.
 */
export function stagePose(moment: StageMoment): MercState {
  if (moment.status === 'active') return 'listen'
  if (moment.status === 'complete' && moment.score !== null) {
    const grade = gradeForScore(moment.score)
    if (grade === 'S' || grade === 'A') return 'celebrate'
  }
  return 'idle'
}
