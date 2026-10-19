// ============================================================
// NgSlidesScreen: the Ng slides exercise, on the shell's stack
// ============================================================
//
// The Sing room's exercise row, its picker and its options push it, by id
// (premium-exercise-wiring.ts), and that tap has already started the
// river's and the glass's loads. NativeShell imports this file only on a
// build with the premium exercises (`PREMIUM_EXERCISES`), lazily, so the
// room, its art and Merc's renderer load when it is first opened. Back
// pops it, and so does Done.
//
// Opening is the choice: the screen records Ng slides as the last exercise
// the moment it mounts, as EchoScreen does for Echo, and the Sing screen's
// row offers it again from then on.
//
// Opened by the Warm-up's path, the room is a stop (warm-up-stop.ts): it
// runs in warm-up mode, leaves the last exercise as the Warm-up, and goes
// back to the path once the stop is finished or skipped.

import type { JSX } from 'solid-js'
import { onMount } from 'solid-js'
import { NgSlidesRoom } from '@/features/ng-slides/NgSlidesRoom'
import { rememberLastExercise } from '@/features/premium-exercises/last-exercise'
import { EXERCISE_NG_SLIDES_BRIDGE } from '@/lib/domain/exercise-contracts'
import { popScreen } from './run-shell-store'
import { warmUpStop } from './warm-up-stop'

export function NgSlidesScreen(): JSX.Element {
  // A stop of the Warm-up, or the room on its own (warm-up-stop.ts).
  const stop = warmUpStop(EXERCISE_NG_SLIDES_BRIDGE, popScreen)
  onMount(() => {
    if (stop === undefined) rememberLastExercise(EXERCISE_NG_SLIDES_BRIDGE)
  })
  return <NgSlidesRoom onDone={popScreen} routine={stop} />
}
