// ============================================================
// The Sing room's state, held where the room is not
// ============================================================
//
// AT MODULE SCOPE, and that is the whole point. The Sing tab's content is
// inside a `<Show>`: leaving the tab unmounts the room and coming back
// mounts a new one. State kept in the component would lose the permission,
// the take count and the parked run on every tab hop — which is exactly the
// failure the shell's own `parkedLatch` exists to prevent one level up.
//
// The machine and its mic policy are in `room-machine.ts`; this is the
// living copy of one context plus the two counters a session keeps.

import { createSignal, untrack } from 'solid-js'
import type { SingRoomContext, SingRoomEvent } from './room-machine'
import { initialSingRoomContext, singRoomReducer } from './room-machine'
import { singMicGranted, singMicOnArrival } from './sing-room-settings'

function fresh(): SingRoomContext {
  return initialSingRoomContext({
    permission: singMicGranted() ? 'granted' : 'unknown',
    micOnArrival: singMicOnArrival(),
  })
}

const [context, setContext] = createSignal<SingRoomContext>(fresh())

/** The room's whole state, as one reactive value. */
export const singRoomContext = context

/**
 * Apply an event and return what the context became.
 *
 * UNTRACKED. Reading the context here is how the reducer works, not a
 * subscription — and an effect that dispatches would otherwise depend on the
 * very signal its dispatch writes. Measured: the sheet's "microphone on
 * arrival" effect dispatched, the dispatch read the context, the write woke
 * the effect, and the app crashed on its own stack.
 */
export function dispatchSingRoom(event: SingRoomEvent): SingRoomContext {
  const next = singRoomReducer(untrack(context), event)
  setContext(next)
  return next
}

/**
 * How many takes have been STARTED since the app launched.
 *
 * "Takes this session" on the end card, and it counts starts rather than
 * keeps: it is how many times you sang, not how many you decided to store.
 */
const [takesThisSession, setTakesThisSession] = createSignal(0)
export { takesThisSession }

export function beginTake(): number {
  const next = takesThisSession() + 1
  setTakesThisSession(next)
  return next
}

/** Tests, and nothing else — the room has no "start over" control. */
export function resetSingRoom(): void {
  setContext(fresh())
  setTakesThisSession(0)
}
