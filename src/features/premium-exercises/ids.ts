// ============================================================
// The premium exercises' ids, and the check for one
// ============================================================
//
// The one list of exercises the Sing screen can open: Long note, Echo,
// Lip roll, Ng slides, the Warm-up, Home note and First note today. A new exercise adds its id here, to the type in
// exercise-contracts.ts, and an entry to the catalogue (catalogue.ts).

import type { PremiumExerciseId } from '@/lib/domain/exercise-contracts'
import { EXERCISE_ECHO_STARS, EXERCISE_FIRST_NOTE_STAGE, EXERCISE_HOME_NOTE_LIGHTHOUSE, EXERCISE_LIP_ROLL_BAY, EXERCISE_LONG_NOTE_LANTERN, EXERCISE_NG_SLIDES_BRIDGE, EXERCISE_WARM_UP_PATH, } from '@/lib/domain/exercise-contracts'

export const PREMIUM_EXERCISE_IDS: readonly PremiumExerciseId[] = [
  EXERCISE_LONG_NOTE_LANTERN,
  EXERCISE_ECHO_STARS,
  EXERCISE_LIP_ROLL_BAY,
  EXERCISE_NG_SLIDES_BRIDGE,
  EXERCISE_WARM_UP_PATH,
  EXERCISE_HOME_NOTE_LIGHTHOUSE,
  EXERCISE_FIRST_NOTE_STAGE,
]

const KNOWN: ReadonlySet<string> = new Set(PREMIUM_EXERCISE_IDS)

/** True for the id of an exercise this build can open, and nothing else. */
export function isPremiumExerciseId(
  value: unknown,
): value is PremiumExerciseId {
  return typeof value === 'string' && KNOWN.has(value)
}
