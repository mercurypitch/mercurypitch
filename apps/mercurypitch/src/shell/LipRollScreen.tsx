// ============================================================
// LipRollScreen: the Lip roll exercise, on the shell's stack
// ============================================================
//
// The Sing room's exercise row, its picker and its options push it, by id
// (premium-exercise-wiring.ts), and that tap has already started the
// bay's and the waves' loads. NativeShell imports this file only on a
// build with the premium exercises (`PREMIUM_EXERCISES`), lazily, so the
// room, its art and Merc's renderer load when it is first opened. Back
// pops it, and so does Done.
//
// Opening is the choice: the screen records Lip roll as the last exercise
// the moment it mounts, as EchoScreen does for Echo, and the Sing screen's
// row offers it again from then on.

import type { JSX } from 'solid-js'
import { onMount } from 'solid-js'
import { LipRollRoom } from '@/features/lip-roll/LipRollRoom'
import { rememberLastExercise } from '@/features/premium-exercises/last-exercise'
import { EXERCISE_LIP_ROLL_BAY } from '@/lib/domain/exercise-contracts'
import { popScreen } from './run-shell-store'

export function LipRollScreen(): JSX.Element {
  onMount(() => {
    rememberLastExercise(EXERCISE_LIP_ROLL_BAY)
  })
  return <LipRollRoom onDone={popScreen} />
}
