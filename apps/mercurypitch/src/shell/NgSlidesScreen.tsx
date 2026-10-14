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

import type { JSX } from 'solid-js'
import { onMount } from 'solid-js'
import { NgSlidesRoom } from '@/features/ng-slides/NgSlidesRoom'
import { rememberLastExercise } from '@/features/premium-exercises/last-exercise'
import { EXERCISE_NG_SLIDES_BRIDGE } from '@/lib/domain/exercise-contracts'
import { popScreen } from './run-shell-store'

export function NgSlidesScreen(): JSX.Element {
  onMount(() => {
    rememberLastExercise(EXERCISE_NG_SLIDES_BRIDGE)
  })
  return <NgSlidesRoom onDone={popScreen} />
}
