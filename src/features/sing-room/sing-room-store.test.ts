import { createEffect, createRoot, createSignal } from 'solid-js'
import { beforeEach, describe, expect, it } from 'vitest'
import { micIntent } from './room-machine'
import { beginTake, clearSingTakeResult, dispatchSingRoom, enterSingRoom, resetSingRoom, setSingTakeResult, singRoomContext, singTakeSummary, takesThisSession, } from './sing-room-store'

beforeEach(() => {
  resetSingRoom()
})

describe('the room’s state outlives the room', () => {
  it('keeps the permission across a leave and a return', () => {
    dispatchSingRoom({ type: 'enter', hasSummary: false })
    dispatchSingRoom({ type: 'sing-a-note' })
    dispatchSingRoom({ type: 'mic-granted' })
    // Leaving the tab unmounts the component; the store is what survives.
    dispatchSingRoom({ type: 'leave' })
    expect(singRoomContext().permission).toBe('granted')
    dispatchSingRoom({ type: 'enter', hasSummary: false })
    expect(singRoomContext().state).toBe('paused')
  })

  it('counts takes across the whole session, not per mount', () => {
    expect(beginTake()).toBe(1)
    dispatchSingRoom({ type: 'leave' })
    dispatchSingRoom({ type: 'enter', hasSummary: false })
    expect(beginTake()).toBe(2)
    expect(takesThisSession()).toBe(2)
  })
})

describe('dispatching from inside an effect', () => {
  it('does not subscribe the effect to what it writes', async () => {
    // The failure this exists for crashed the app on its own stack: the
    // sheet's "microphone on arrival" effect dispatched, the dispatch read
    // the context, the write woke the effect, and around it went. Without
    // the untrack, `runs` does not settle at all — it overflows.
    let runs = 0
    let setSetting: (value: boolean) => void = () => {}
    const dispose = createRoot((disposeRoot) => {
      const [setting, set] = createSignal(true)
      setSetting = set
      createEffect(() => {
        runs += 1
        dispatchSingRoom({ type: 'set-mic-on-arrival', value: setting() })
      })
      return disposeRoot
    })
    await Promise.resolve()
    expect(runs).toBe(1)

    setSetting(false)
    await Promise.resolve()
    expect(runs).toBe(2)
    expect(singRoomContext().micOnArrival).toBe(false)
    dispose()
  })

  it('hands back the same context when nothing changed', () => {
    const before = singRoomContext()
    dispatchSingRoom({
      type: 'set-mic-on-arrival',
      value: before.micOnArrival,
    })
    expect(singRoomContext()).toBe(before)
  })
})

describe('the mic policy, read through the store', () => {
  it('never holds the device while the tab is not the one on screen', () => {
    dispatchSingRoom({ type: 'enter', hasSummary: false })
    dispatchSingRoom({ type: 'sing-a-note' })
    dispatchSingRoom({ type: 'mic-granted' })
    expect(micIntent(singRoomContext())).toBe(true)
    dispatchSingRoom({ type: 'leave' })
    expect(micIntent(singRoomContext())).toBe(false)
  })
})

describe('the take on the end card', () => {
  const summary = {
    durationMs: 12_000,
    voicedMs: 9000,
    takeNumber: 1,
    range: null,
    heldWithinCents: 14,
  }

  it('outlives the room, exactly as the state that draws it does', () => {
    dispatchSingRoom({ type: 'enter', hasSummary: false })
    dispatchSingRoom({ type: 'sing-a-note' })
    dispatchSingRoom({ type: 'mic-granted' })
    setSingTakeResult(summary, null, { startedAt: 1, endedAt: 2 })
    dispatchSingRoom({ type: 'stop', hasTake: true })
    // Back, a tab hop, anything that unmounts the room.
    dispatchSingRoom({ type: 'leave' })
    expect(singTakeSummary()).toEqual(summary)
    expect(enterSingRoom().state).toBe('ended')
  })

  it('never leaves the room in a state with no way out of it', () => {
    dispatchSingRoom({ type: 'enter', hasSummary: false })
    dispatchSingRoom({ type: 'sing-a-note' })
    dispatchSingRoom({ type: 'mic-granted' })
    dispatchSingRoom({ type: 'stop', hasTake: true })
    // `ended` with nothing to draw: no card, no capsule, no control.
    clearSingTakeResult()
    dispatchSingRoom({ type: 'leave' })
    expect(enterSingRoom().state).toBe('resting')
  })
})

describe('takes this session', () => {
  it('starts over on a fresh visit to the room', () => {
    enterSingRoom()
    expect(beginTake()).toBe(1)
    expect(beginTake()).toBe(2)
    dispatchSingRoom({ type: 'stop', hasTake: false })
    dispatchSingRoom({ type: 'leave' })
    enterSingRoom()
    expect(beginTake()).toBe(1)
  })

  it('does NOT start over on a return to a run still in flight', () => {
    enterSingRoom()
    dispatchSingRoom({ type: 'sing-a-note' })
    dispatchSingRoom({ type: 'mic-granted' })
    expect(beginTake()).toBe(1)
    // Parked mid-run and returned from the session pill.
    dispatchSingRoom({ type: 'leave' })
    enterSingRoom()
    expect(takesThisSession()).toBe(1)
    expect(beginTake()).toBe(2)
  })

  it('does NOT start over while an undecided card is waiting', () => {
    enterSingRoom()
    expect(beginTake()).toBe(1)
    setSingTakeResult(summaryFixture, null, { startedAt: 1, endedAt: 2 })
    dispatchSingRoom({ type: 'stop', hasTake: true })
    dispatchSingRoom({ type: 'leave' })
    enterSingRoom()
    expect(takesThisSession()).toBe(1)
  })
})

const summaryFixture = {
  durationMs: 12_000,
  voicedMs: 9000,
  takeNumber: 1,
  range: null,
  heldWithinCents: 14,
}
