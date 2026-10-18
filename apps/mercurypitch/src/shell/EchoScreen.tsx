// ============================================================
// EchoScreen: the Echo exercise, on the shell's stack
// ============================================================
//
// The Sing room's exercise row, its picker and its options push it, by id
// (premium-exercise-wiring.ts), and that tap has already started the sky
// plate's decode. NativeShell imports this file only on a build with the
// premium exercises (`PREMIUM_EXERCISES`), lazily, so the room, its art and
// Merc's renderer load when it is first opened. Back pops it, and so does
// Done.
//
// Opening is the choice: the screen records Echo as the last exercise the
// moment it mounts, as LongNoteScreen does for Long note, and the Sing
// screen's row offers it again from then on.
//
// Opened by the Warm-up's path, the room is a stop (warm-up-stop.ts): it
// runs in warm-up mode, leaves the last exercise as the Warm-up, and goes
// back to the path once the stop is finished or skipped.

import type { JSX } from 'solid-js'
import { onMount } from 'solid-js'
import { EchoRoom } from '@/features/echo/EchoRoom'
import { rememberLastExercise } from '@/features/premium-exercises/last-exercise'
import { EXERCISE_ECHO_STARS } from '@/lib/domain/exercise-contracts'
import { popScreen } from './run-shell-store'
import { warmUpStop } from './warm-up-stop'

export function EchoScreen(): JSX.Element {
  // A stop of the Warm-up, or the room on its own (warm-up-stop.ts).
  const stop = warmUpStop(EXERCISE_ECHO_STARS, popScreen)
  onMount(() => {
    if (stop === undefined) rememberLastExercise(EXERCISE_ECHO_STARS)
  })
  return <EchoRoom onDone={popScreen} routine={stop} />
}
