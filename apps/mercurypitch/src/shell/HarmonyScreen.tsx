// ============================================================
// HarmonyScreen: the Harmony exercise, on the shell's stack
// ============================================================
//
// The fourth Ear room (docs/plans/ear-rooms.md). The Sing room's picker and
// the Ear Lab's Ear rooms row push it, by id (premium-exercise-wiring.ts),
// and that tap has already started loading Merc's voice. NativeShell
// imports this file only on a build with the premium exercises
// (`PREMIUM_EXERCISES`), lazily, so the room and Merc's renderer load when
// it is first opened. Back pops it, and so does Done.
//
// The room sings Merc with his sampled voice, Echo's (merc-sampler.ts): the
// screen hands it in, so the room's feature reaches into no other feature.
// Until his set has loaded his line goes to the synth "ooh", as Echo's
// call does.
//
// Opening is the choice: the screen records Harmony as the last exercise
// the moment it mounts, as LeapScreen does for Leap.

import type { JSX } from 'solid-js'
import { onMount } from 'solid-js'
import { MERC_CALL } from '@/features/echo/merc-sampler'
import { HarmonyRoom } from '@/features/harmony/HarmonyRoom'
import { rememberLastExercise } from '@/features/premium-exercises/last-exercise'
import { EXERCISE_HARMONY_LAKE } from '@/lib/domain/exercise-contracts'
import { popScreen } from './run-shell-store'

export function HarmonyScreen(): JSX.Element {
  onMount(() => rememberLastExercise(EXERCISE_HARMONY_LAKE))
  return <HarmonyRoom onDone={popScreen} voice={MERC_CALL} />
}
