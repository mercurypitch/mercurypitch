// ============================================================
// WarmUpScreen: the Warm-up's path, on the shell's stack
// ============================================================
//
// The Sing room's exercise row, its picker and its options push it, by id
// (premium-exercise-wiring.ts), and that tap has already started the
// night's and the orbs' loads, and the first stop's room. NativeShell
// imports this file only on a build with the premium exercises
// (`PREMIUM_EXERCISES`), lazily. Back pops it, and so does Done.
//
// The path opens each stop's room by id, as the picker does: the room is
// pushed over the path and pops back to it once its stop is finished or
// skipped (warm-up-stop.ts). "Sing a song" goes back to the Sing room and
// asks it for its song list (DESIGN-warm-up.md N15).
//
// Opening is the choice: the screen records the Warm-up as the last
// exercise the moment it mounts, as every room's screen does, and the Sing
// screen's row offers it again from then on. Its stops do not: in the
// Warm-up a room is a stop, not the singer's choice.
//
// The path's haptics are the device's own (§10: a tick as a stop lights, a
// success as Merc lands on the song), as every room's are: main.tsx installs
// them behind `@/lib/haptics` (infrastructure/native-haptics.ts).

import type { JSX } from 'solid-js'
import { onMount } from 'solid-js'
import { rememberLastExercise } from '@/features/premium-exercises/last-exercise'
import { WarmUpPath } from '@/features/warm-up/WarmUpPath'
import { EXERCISE_WARM_UP_PATH } from '@/lib/domain/exercise-contracts'
import { requestSongList } from '@/stores/native-shell-store'
import { openPremiumExercise, preloadExercise } from './premium-exercise-wiring'
import { popScreen } from './run-shell-store'

export function WarmUpScreen(): JSX.Element {
  onMount(() => {
    rememberLastExercise(EXERCISE_WARM_UP_PATH)
  })
  return (
    <WarmUpPath
      onPreload={preloadExercise}
      onOpenRoom={openPremiumExercise}
      onDone={popScreen}
      onSong={() => {
        popScreen()
        requestSongList()
      }}
    />
  )
}
