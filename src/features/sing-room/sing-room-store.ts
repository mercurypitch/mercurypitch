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
// living copy of one context, the session's take counter, and THE TAKE
// RESULT — the three values the end card is drawn from.
//
// THE RESULT LIVES HERE FOR THE SAME REASON THE CONTEXT DOES. It used to be
// three component signals while `state` was module-scoped, and the two halves
// came apart the moment anything unmounted the room with the card open: the
// state said `ended` forever, the summary came back null, so the card did not
// draw, the capsule does not draw in `ended` either, and the room was a
// frozen canvas with no control on it and no way out. Either both survive a
// remount or neither may.

import { createSignal, untrack } from 'solid-js'
import type { SingTake } from '@/stores/sing-takes-store'
import type { SingRoomContext, SingRoomEvent } from './room-machine'
import { initialSingRoomContext, singRoomReducer } from './room-machine'
import { singMicGranted, singMicOnArrival } from './sing-room-settings'
import type { TakeSummary } from './take-summary'

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
 * How many takes have been STARTED in this visit to the room.
 *
 * "Takes this session" on the end card, and it counts starts rather than
 * keeps: it is how many times you sang, not how many you decided to store.
 * A visit, not the app's whole launch — "2 takes" for a take sung this
 * minute and one sung before lunch is a sentence nobody can use.
 */
const [takesThisSession, setTakesThisSession] = createSignal(0)
export { takesThisSession }

export function beginTake(): number {
  const next = takesThisSession() + 1
  setTakesThisSession(next)
  return next
}

// ── The take on the end card ─────────────────────────────────

export interface TakeClock {
  /** Epoch ms. The card says a date and the history line compares them. */
  startedAt: number
  endedAt: number
}

const [takeSummary, setTakeSummary] = createSignal<TakeSummary | null>(null)
const [takePrevious, setTakePrevious] = createSignal<SingTake | null>(null)
const [takeClock, setTakeClock] = createSignal<TakeClock>({
  startedAt: 0,
  endedAt: 0,
})

/** The take the end card is showing, or null when there is no card. */
export const singTakeSummary = takeSummary
/** The kept take it compares itself against — captured BEFORE Keep writes. */
export const singTakePrevious = takePrevious
export const singTakeClock = takeClock

export function setSingTakeResult(
  summary: TakeSummary,
  previous: SingTake | null,
  clock: TakeClock,
): void {
  setTakeSummary(summary)
  setTakePrevious(previous)
  setTakeClock(clock)
}

/** Keep or Discard, Back, a backdrop tap — every way the card closes. */
export function clearSingTakeResult(): void {
  setTakeSummary(null)
  setTakePrevious(null)
}

/**
 * The tab became the one on screen.
 *
 * Wrapped rather than dispatched raw so the safety net cannot be forgotten:
 * whether there is a summary to draw is this module's answer, and an `ended`
 * without one has to rest.
 */
export function enterSingRoom(): SingRoomContext {
  const before = untrack(context)
  // A fresh visit starts its own count. A return to a run that is still in
  // flight — parked, or an undecided card — is the same visit, and a counter
  // that reset under it would renumber the take the singer is looking at.
  if (before.state === 'resting' && untrack(takeSummary) === null) {
    setTakesThisSession(0)
  }
  return dispatchSingRoom({
    type: 'enter',
    hasSummary: untrack(takeSummary) !== null,
  })
}

/** Tests, and nothing else — the room has no "start over" control. */
export function resetSingRoom(): void {
  setContext(fresh())
  setTakesThisSession(0)
  setTakeSummary(null)
  setTakePrevious(null)
  setTakeClock({ startedAt: 0, endedAt: 0 })
}
