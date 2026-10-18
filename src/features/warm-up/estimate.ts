// ============================================================
// How long a warm-up takes: the minutes on the path's chip
// ============================================================
//
// Each room stop's sung time at the singer's level, plus about 12 s a
// stop for the room opening, the cue, the result held and the card
// (DESIGN-warm-up.md §5.9), rounded up to whole minutes: "3 min".
//
// Lip roll and Ng slides are timed by their own planners at the level's
// preset (lip-run.ts, ng-run.ts): the count-in and every arch, pause and
// breath, so the estimate moves when the presets do. The design's table
// was written before the 1 s pause after each landing (owner, 15 Oct
// 2026); these are the runs as the rooms now play them. A run's length
// does not depend on its notes, only on how many arches it has, so the
// fit here is the one a singer with no voiceprint gets.
//
// Long note and Echo have no fixed length: a hold lasts as long as the
// singer holds, and Echo's phrases are planned afresh each run. Their
// numbers are the plan's: a hold of 15 to 25 s (PLAN-NEXT §3), taken at
// its longest, and about 7.4 s a phrase, call and answer (DESIGN-warm-up.md
// §5.9 and N8: about 22 s for three phrases, 37 s for five).

import { WARM_UP_PHRASES } from '@/features/echo/echo-controller-contract'
import { planLipRun } from '@/features/lip-roll/lip-run'
import { planNgRun } from '@/features/ng-slides/ng-run'
import { EXERCISE_ECHO_STARS, EXERCISE_LIP_ROLL_BAY, EXERCISE_LONG_NOTE_LANTERN, EXERCISE_NG_SLIDES_BRIDGE, } from '@/lib/domain/exercise-contracts'
import { LIP_ROLL_LEVELS, NG_SLIDES_LEVELS } from '@/lib/glide/glide-presets'
import { fitLipRoll, fitNgSlides } from '@/lib/glide/glide-targets'
import type { ExerciseLevel } from '@/stores/exercise-level'
import type { WarmUpPlan, WarmUpRoomId } from './warm-up-plan'
import { isRoomStop } from './warm-up-plan'

/** Beyond the singing, each stop: the room opening, the cue, the result held, the card. */
export const STOP_OVERHEAD_SEC = 12

/** A Long note hold at its longest, s (PLAN-NEXT §3: 15 to 25 s). */
export const LONG_NOTE_HOLD_SEC = 25

/** One Echo phrase, Merc's call and the singer's answer, s. */
export const ECHO_PHRASE_SEC = 7.4

const NO_VOICEPRINT = { voiceprints: [] } as const

/** A room stop's sung time at `level`, s. */
export function stopSeconds(id: WarmUpRoomId, level: ExerciseLevel): number {
  switch (id) {
    case EXERCISE_LIP_ROLL_BAY: {
      const plan = planLipRun(fitLipRoll(NO_VOICEPRINT), LIP_ROLL_LEVELS[level])
      return plan.countIn + plan.path.duration
    }
    case EXERCISE_NG_SLIDES_BRIDGE: {
      const plan = planNgRun(
        fitNgSlides(NO_VOICEPRINT),
        NG_SLIDES_LEVELS[level],
      )
      return plan.countIn + plan.path.duration
    }
    case EXERCISE_LONG_NOTE_LANTERN:
      return LONG_NOTE_HOLD_SEC
    case EXERCISE_ECHO_STARS:
      return WARM_UP_PHRASES * ECHO_PHRASE_SEC
  }
}

/** The whole warm-up at `level`, s: every room stop and its overhead. */
export function warmUpSeconds(plan: WarmUpPlan, level: ExerciseLevel): number {
  return plan.stops
    .filter(isRoomStop)
    .reduce(
      (sum, stop) => sum + stopSeconds(stop.id, level) + STOP_OVERHEAD_SEC,
      0,
    )
}

/** The chip's minutes: the whole warm-up, rounded up. */
export function warmUpMinutes(plan: WarmUpPlan, level: ExerciseLevel): number {
  return Math.ceil(warmUpSeconds(plan, level) / 60)
}
