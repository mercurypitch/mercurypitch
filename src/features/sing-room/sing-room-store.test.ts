import { createEffect, createRoot, createSignal } from 'solid-js'
import { beforeEach, describe, expect, it } from 'vitest'
import { micIntent } from './room-machine'
import { beginTake, dispatchSingRoom, resetSingRoom, singRoomContext, takesThisSession, } from './sing-room-store'

beforeEach(() => {
  resetSingRoom()
})

describe('the room’s state outlives the room', () => {
  it('keeps the permission across a leave and a return', () => {
    dispatchSingRoom({ type: 'enter' })
    dispatchSingRoom({ type: 'sing-a-note' })
    dispatchSingRoom({ type: 'mic-granted' })
    // Leaving the tab unmounts the component; the store is what survives.
    dispatchSingRoom({ type: 'leave' })
    expect(singRoomContext().permission).toBe('granted')
    dispatchSingRoom({ type: 'enter' })
    expect(singRoomContext().state).toBe('paused')
  })

  it('counts takes across the whole session, not per mount', () => {
    expect(beginTake()).toBe(1)
    dispatchSingRoom({ type: 'leave' })
    dispatchSingRoom({ type: 'enter' })
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
    dispatchSingRoom({ type: 'enter' })
    dispatchSingRoom({ type: 'sing-a-note' })
    dispatchSingRoom({ type: 'mic-granted' })
    expect(micIntent(singRoomContext())).toBe(true)
    dispatchSingRoom({ type: 'leave' })
    expect(micIntent(singRoomContext())).toBe(false)
  })
})
