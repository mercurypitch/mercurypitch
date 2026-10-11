// ============================================================
// The premium exercises' half of the shell: opening one by id
// ============================================================
//
// The Sing room opens an exercise from its row, its picker and its options
// (premium exercises, the exercise entry), always by id. This turns the id
// into the screen the shell pushes, so the room never names a screen and the
// shell needs no method per exercise.
//
// A build without the premium exercises (the store build, until the V1
// flip) gets nothing. PREMIUM_EXERCISES is a compile-time constant there, so
// the conditional below folds to `{}` and `install`, with the id map inside
// it, is dead code in that bundle: the room then finds no `openExercise` and
// draws no way in (assert-bundle.mjs STAGE 2 holds the output to it).

import type { PremiumExerciseId } from '@/lib/domain/exercise-contracts'
import { EXERCISE_LONG_NOTE_LANTERN } from '@/lib/domain/exercise-contracts'
import { PREMIUM_EXERCISES } from '@/lib/native-build'
import type { NativeShellApi } from '@/stores/native-shell-store'
import type { PushedScreen } from './run-shell-store'
import { pushScreen } from './run-shell-store'

/** What the shell adds to the API it registers for the rooms. */
export type PremiumExerciseApi = Pick<NativeShellApi, 'openExercise'>

function install(): PremiumExerciseApi {
  const screens: Record<PremiumExerciseId, PushedScreen> = {
    [EXERCISE_LONG_NOTE_LANTERN]: 'long-note',
  }
  return {
    openExercise: (id) => {
      pushScreen(screens[id])
    },
  }
}

export function installPremiumExercises(): PremiumExerciseApi {
  return PREMIUM_EXERCISES ? install() : {}
}
