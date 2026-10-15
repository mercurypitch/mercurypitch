// ============================================================
// The premium exercises' half of the shell: opening one by id
// ============================================================
//
// The Sing room opens an exercise from its row, its picker and its options
// (premium exercises, the exercise entry), always by id. This turns the id
// into the screen the shell pushes, so the room never names a screen and the
// shell needs no method per exercise.
//
// The tap that opens a room is also where its heaviest art starts loading:
// Echo's sky plate is decoded while the screen pushes in (plate-loader.ts),
// so the room shows it at once instead of a frame later; Long note's
// lantern plates the same way; Ng slides' river and its glass start
// loading on the same tap.
//
// A build without the premium exercises (the store build, until the V1
// flip) gets nothing. PREMIUM_EXERCISES is a compile-time constant there, so
// the conditional below folds to `{}` and `install`, with the id map inside
// it, is dead code in that bundle: the room then finds no `openExercise` and
// draws no way in (assert-bundle.mjs STAGE 2 holds the output to it).

import type { PremiumExerciseId } from '@/lib/domain/exercise-contracts'
import { EXERCISE_ECHO_STARS, EXERCISE_LIP_ROLL_BAY, EXERCISE_LONG_NOTE_LANTERN, EXERCISE_NG_SLIDES_BRIDGE, } from '@/lib/domain/exercise-contracts'
import { PREMIUM_EXERCISES } from '@/lib/native-build'
import type { NativeShellApi } from '@/stores/native-shell-store'
import type { PushedScreen } from './run-shell-store'
import { pushScreen } from './run-shell-store'

/** What the shell adds to the API it registers for the rooms. */
export type PremiumExerciseApi = Pick<NativeShellApi, 'openExercise'>

function install(): PremiumExerciseApi {
  const screens: Record<PremiumExerciseId, PushedScreen> = {
    [EXERCISE_LONG_NOTE_LANTERN]: 'long-note',
    [EXERCISE_ECHO_STARS]: 'echo',
    [EXERCISE_LIP_ROLL_BAY]: 'lip-roll',
    [EXERCISE_NG_SLIDES_BRIDGE]: 'ng-slides',
  }
  /** What a room starts loading on the tap that opens it. */
  const preloads: Partial<Record<PremiumExerciseId, () => void>> = {
    [EXERCISE_LONG_NOTE_LANTERN]: () => {
      void import('@/features/long-note/long-note-art').then((art) => {
        art.preloadLongNoteArt()
      })
    },
    [EXERCISE_ECHO_STARS]: () => {
      void import('@/features/echo/echo-art').then((art) => {
        art.preloadEchoArt()
      })
    },
    [EXERCISE_LIP_ROLL_BAY]: () => {
      void import('@/features/lip-roll/bay-art').then((art) => {
        art.preloadLipArt()
      })
    },
    [EXERCISE_NG_SLIDES_BRIDGE]: () => {
      void import('@/features/ng-slides/bridge-art').then((art) => {
        art.preloadNgArt()
      })
    },
  }
  return {
    openExercise: (id) => {
      preloads[id]?.()
      pushScreen(screens[id])
    },
  }
}

export function installPremiumExercises(): PremiumExerciseApi {
  return PREMIUM_EXERCISES ? install() : {}
}
