// ============================================================
// "The melody reached its own end" — the decision, without a DOM
// ============================================================
//
// Device round 2, R1: a melody that plays to its end stops the app's
// transport and tells the room nothing, so the room sat in `live` over a
// dead transport and the take simply vanished — no Keep/Discard card.
//
// `melodyRanOut` in `room-machine` answers the pure half of that question and
// is tested there. The half that is NOT pure is the one this owns, and it is
// the half that was wrong twice:
//
//   1. THE LATCH. `melody-play` puts the room in `live` before the app's
//      transport reports anything, so for the first frames of a run the pair
//      (`live`, stopped) reads exactly like a run that has just finished.
//      Only a transport that has been SEEN running can run out.
//
//   2. THE SETTLE. A pause writes `isPlaying(false)` before it writes
//      `isPaused(true)`, so between the two writes the pair reads "stopped"
//      again. The decision waits for the current task to finish writing both
//      and asks a second time — the same shape the shell's run store uses for
//      the same two signals.
//
// Both were invisible to the suite that shipped them: the reviewer deleted
// the latch and deleted the settle and every test stayed green (review F8),
// because both live in a component that nothing renders in a test. They live
// here now, where a sequence of transport frames is an array.

import type { SingRoomContext, TransportPhase } from './room-machine'
import { melodyRanOut, transportPhase } from './room-machine'

/** The app's transport, as the room receives it: two independent signals. */
export interface TransportReading {
  isPlaying: boolean
  isPaused: boolean
}

export interface RunOutWatchDeps {
  /** The room, read at the moment the question is asked. */
  ctx: () => SingRoomContext
  /** The transport, read at the moment the question is asked. */
  transport: () => TransportReading
  /**
   * Run `decide` once the task that moved the transport has finished moving
   * it. A microtask in the room; a function the test calls by hand here.
   */
  settle: (decide: () => void) => void
  /** The melody ran out. End the take and open the card. */
  onRanOut: () => void
}

export interface RunOutWatch {
  /** One frame of the transport, as the room's effect sees it. */
  observe: () => void
  /**
   * Forget everything: no pending settle may still fire, and the next run
   * has to be seen running again before it can run out.
   *
   * Called when the room ends a run itself, and on the way out — a settle
   * queued by the last frame before an unmount would otherwise land on a
   * room that is gone.
   */
  cancel: () => void
  /** Has a transport been seen running since the last `cancel`? */
  readonly sawRunning: boolean
}

export function createRunOutWatch(deps: RunOutWatchDeps): RunOutWatch {
  let sawRunning = false
  // Every settle carries the number it was queued under. Anything that
  // happens in between — a second frame, a Stop, an unmount — moves the
  // number on, and the settle it was queued by finds itself stale.
  let token = 0

  const phaseNow = (): TransportPhase => {
    const reading = deps.transport()
    return transportPhase(reading.isPlaying, reading.isPaused)
  }

  const cancel = (): void => {
    sawRunning = false
    token += 1
  }

  const observe = (): void => {
    const phase = phaseNow()
    const ctx = deps.ctx()
    if (phase === 'running') {
      sawRunning = true
      return
    }
    // `held` is a pause that has finished writing both signals, and a run
    // that has never been seen running is a run that has not started yet.
    if (phase === 'held' || !sawRunning) return
    if (!melodyRanOut(ctx, phase)) return

    const mine = ++token
    deps.settle(() => {
      if (mine !== token) return
      if (!melodyRanOut(deps.ctx(), phaseNow())) return
      cancel()
      deps.onRanOut()
    })
  }

  return {
    observe,
    cancel,
    get sawRunning() {
      return sawRunning
    },
  }
}
