// ============================================================
// A room's stop in the Warm-up, as its screen hands it over
// ============================================================
//
// Each room's screen (LipRollScreen.tsx and the three beside it) asks the
// Warm-up whether it is a stop as it mounts, once: the store answers only
// while that stop is the open one, and stops answering the moment the stop
// is finished, before the room has gone (warm-up-store.ts). Read once, the
// answer holds for the room's life.
//
// The stop it hands the room ends the visit too: finished or skipped, the
// room pops back to the path. A room that goes any other way (Back, the
// app's own way out) leaves its stop unfinished, and the store lets go of
// it: an open stop left behind would put the next visit to that room from
// the picker into warm-up mode.

import { onCleanup } from 'solid-js'
import type { RoutineStop } from '@/components/room-kit/routine-stop'
import type { WarmUpRoomId } from '@/features/warm-up/warm-up-plan'
import { leaveStop, routineStopFor } from '@/features/warm-up/warm-up-store'

/**
 * The room's stop, or undefined when it is not one; call as the room's
 * screen is made. `back` takes the room off the stack.
 */
export function warmUpStop(
  id: WarmUpRoomId,
  back: () => void,
): RoutineStop | undefined {
  const stop = routineStopFor(id)
  if (stop === undefined) return undefined
  let ended = false
  const end = (): void => {
    ended = true
    back()
  }
  onCleanup(() => {
    if (!ended) leaveStop()
  })
  return {
    index: stop.index,
    count: stop.count,
    settledNote: stop.settledNote,
    finish: (result) => {
      stop.finish(result)
      end()
    },
    skip: () => {
      stop.skip()
      end()
    },
  }
}
