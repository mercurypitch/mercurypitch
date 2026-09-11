// ============================================================
// The shell's state machine, driven the way a room drives it
// ============================================================
//
// Every case here moves the ROOM's own play signals, because that is what a
// run actually is: `usePlaybackController` keeps them and hands them to the
// stage as props, and the stage hands them to the shell through the bridge.
//
// The suite this replaced moved `playbackState` instead, which reads like the
// app's transport and is not one — its only production writer sets 'stopped'.
// It passed against a shell that never left `browsing` for a whole run. The
// fallback path is still covered, in its own case, because a surface that
// registers nothing is still a surface.

import { createSignal } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TAB_EAR_LAB, TAB_PROGRESS, TAB_SINGING, } from '@/features/tabs/constants'
import type { NativeRunControls } from '@/stores/native-shell-store'
import { consumeRunParked, registerRunControls, } from '@/stores/native-shell-store'
import { setPlaybackState } from '@/stores/playback-state-store'
import { setActiveTab } from '@/stores/ui-store'
import { chipVisible, closeColumn, COLUMN_IDLE_MS, columnOpen, countInBeat, countingIn, elapsedMs, finishRun, formatElapsed, keepAlertOpen, locked, openColumn, parked, parkRun, railVisible, requestEnd, resetRunShell, runLabel, runOwner, runState, toggleLock, touchColumn, transportVisible, } from './run-shell-store'

/** A room exactly as `SingingMobileStage` registers one, with its own state. */
function fakeRoom(extra: Partial<NativeRunControls> = {}) {
  const [playing, setPlaying] = createSignal(false)
  const [paused, setPaused] = createSignal(false)
  const [counting, setCounting] = createSignal(false)
  const [beat, setBeat] = createSignal(0)

  const controls: NativeRunControls = {
    tab: TAB_SINGING,
    roomLabel: 'Sing',
    isPlaying: playing,
    isPaused: paused,
    isCountingIn: counting,
    countInBeat: beat,
    pause: vi.fn(() => {
      setPlaying(false)
      setPaused(true)
    }),
    resume: vi.fn(() => {
      setPlaying(true)
      setPaused(false)
    }),
    stop: vi.fn(() => {
      setPlaying(false)
      setPaused(false)
    }),
    park: vi.fn(() => {
      setPlaying(false)
      setPaused(true)
    }),
    ...extra,
  }

  return {
    controls,
    play: () => {
      setPlaying(true)
      setPaused(false)
    },
    countIn: (on: boolean, at = 0) => {
      setCounting(on)
      setBeat(at)
    },
  }
}

/**
 * A pause and a resume each write two of the room's signals, so an idle
 * report is only believed after the turn it arrived in. Everything that ends
 * a run waits for that.
 */
const settled = (): Promise<void> =>
  new Promise((resolve) => {
    queueMicrotask(resolve)
  })

let unregister: (() => void) | null = null

function mount(extra: Partial<NativeRunControls> = {}) {
  const room = fakeRoom(extra)
  unregister = registerRunControls(room.controls)
  return room
}

beforeEach(() => {
  vi.useFakeTimers()
  setActiveTab(TAB_SINGING)
  setPlaybackState('stopped')
  resetRunShell()
  consumeRunParked(TAB_SINGING)
})

afterEach(() => {
  unregister?.()
  unregister = null
  setPlaybackState('stopped')
  resetRunShell()
  consumeRunParked(TAB_SINGING)
  vi.useRealTimers()
})

describe('what the bottom edge is showing', () => {
  it('browses until the room says it is playing', () => {
    mount()

    expect(runState()).toBe('browsing')
    expect(railVisible()).toBe(true)
    expect(transportVisible()).toBe(false)
  })

  it('follows the ROOM, not the global playback store', () => {
    // The regression this suite exists for: the store stays 'stopped' for the
    // whole of a practice run, because nothing in production ever sets it to
    // 'playing'. A shell that watched it never showed a transport at all.
    const room = mount()
    setPlaybackState('stopped')

    room.play()

    expect(runState()).toBe('active')
    expect(transportVisible()).toBe(true)
    expect(railVisible()).toBe(false)
    // R2: the chip is the only way back to the tabs during a run.
    expect(chipVisible()).toBe(true)
  })

  it('falls back to the playback store where no room registered', () => {
    setPlaybackState('playing')

    expect(runState()).toBe('active')
  })

  it('keeps the transport on pause — the rail does not come back', () => {
    const room = mount()
    room.play()

    room.controls.pause()

    expect(runState()).toBe('paused')
    expect(transportVisible()).toBe(true)
    expect(railVisible()).toBe(false)
  })

  it('leaves the take on screen when a run stops, and returns the rail', async () => {
    const room = mount()
    room.play()

    room.controls.stop()
    await settled()

    expect(runState()).toBe('ended')
    expect(railVisible()).toBe(true)
    expect(transportVisible()).toBe(false)
  })

  it('does not call a room that never played an ended run', () => {
    mount()

    expect(runState()).toBe('browsing')
  })

  it('reads the count-in off the room', () => {
    const room = mount()
    room.countIn(true, 3)

    expect(countingIn()).toBe(true)
    expect(countInBeat()).toBe(3)

    room.countIn(false)
    expect(countingIn()).toBe(false)
  })
})

describe('who the run belongs to', () => {
  it('takes the owner and the name from the room that registered', () => {
    const room = mount()

    room.play()

    expect(runOwner()).toBe(TAB_SINGING)
    expect(runLabel()).toBe('Sing')
  })

  it('falls back to the tab on screen when no room registered', () => {
    setActiveTab(TAB_EAR_LAB)

    setPlaybackState('playing')

    expect(runOwner()).toBe(TAB_EAR_LAB)
  })

  it('is not parked in the room the run is in', () => {
    const room = mount()
    room.play()

    expect(parked()).toBe(false)
  })

  it('is parked the moment the singer is somewhere else', () => {
    const room = mount()
    room.play()
    room.controls.pause()

    setActiveTab(TAB_PROGRESS)

    expect(parked()).toBe(true)
    // The pill takes the rail's accessory slot; the transport is not here.
    expect(transportVisible()).toBe(false)
    expect(railVisible()).toBe(true)
  })

  it('does not follow an ENDED run into another tab', async () => {
    const room = mount()
    room.play()
    room.controls.stop()
    await settled()

    setActiveTab(TAB_PROGRESS)

    expect(parked()).toBe(false)
    expect(runOwner()).toBeNull()
    expect(runState()).toBe('browsing')
  })
})

describe('parking', () => {
  it('asks the room, and the room pauses rather than stops', () => {
    const room = mount()
    room.play()

    parkRun()

    expect(room.controls.park).toHaveBeenCalledTimes(1)
    expect(room.controls.stop).not.toHaveBeenCalled()
    expect(runState()).toBe('paused')
  })

  it('tells the room’s tab cleanup to leave the run alone, once', () => {
    // Without this the tab transition resets playback on the way out and the
    // parked run the pill points at is already over.
    const room = mount()
    room.play()

    parkRun()

    expect(consumeRunParked(TAB_SINGING)).toBe(true)
    expect(consumeRunParked(TAB_SINGING)).toBe(false)
  })

  it('does not silence the cleanup for a tab it did not park', () => {
    const room = mount()
    room.play()

    parkRun()

    expect(consumeRunParked(TAB_PROGRESS)).toBe(false)
  })

  it('has nothing to park when no run is going', () => {
    const room = mount()

    parkRun()

    expect(room.controls.park).not.toHaveBeenCalled()
  })
})

describe('ending a run', () => {
  it('just stops, because no room claims an unsaved take', () => {
    const room = mount()
    room.play()

    requestEnd()

    expect(keepAlertOpen()).toBe(false)
    expect(room.controls.stop).toHaveBeenCalledTimes(1)
  })

  it('asks first when the room says something is unsaved', () => {
    const room = mount({ hasUnsavedTake: () => true })
    room.play()

    requestEnd()

    expect(keepAlertOpen()).toBe(true)
    expect(room.controls.stop).not.toHaveBeenCalled()
  })

  it('stops on either answer to the alert', () => {
    const room = mount({ hasUnsavedTake: () => true })
    room.play()
    requestEnd()

    finishRun()

    expect(keepAlertOpen()).toBe(false)
    expect(room.controls.stop).toHaveBeenCalledTimes(1)
  })
})

describe('the lock', () => {
  it('refuses Stop while it is on, and lets go again', () => {
    const room = mount()
    room.play()

    toggleLock()
    expect(locked()).toBe(true)
    requestEnd()
    expect(room.controls.stop).not.toHaveBeenCalled()

    toggleLock()
    requestEnd()
    expect(room.controls.stop).toHaveBeenCalledTimes(1)
  })

  it('is released by the end of the run, never left on for the next one', async () => {
    const room = mount()
    room.play()
    toggleLock()

    room.controls.stop()
    await settled()

    expect(locked()).toBe(false)
  })

  it('survives a pause, which reports idle for one moment on its way', async () => {
    // The two-signal transition: `isPlaying(false)` then `isPaused(true)`.
    // Believing the gap unlocked the transport, cleared the run's owner and
    // restarted the clock from zero on the next resume.
    const room = mount()
    room.play()
    toggleLock()
    vi.advanceTimersByTime(4000)

    room.controls.pause()
    await settled()

    expect(runState()).toBe('paused')
    expect(locked()).toBe(true)
    expect(runOwner()).toBe(TAB_SINGING)
    expect(formatElapsed(elapsedMs())).toBe('0:04')

    room.controls.resume()
    await settled()
    vi.advanceTimersByTime(1000)
    expect(formatElapsed(elapsedMs())).toBe('0:05')
  })
})

describe('the tab column', () => {
  it('opens only while the chip is on screen', () => {
    const room = mount()

    openColumn()
    expect(columnOpen()).toBe(false)

    room.play()
    openColumn()
    expect(columnOpen()).toBe(true)
  })

  it('closes itself after four seconds untouched', () => {
    const room = mount()
    room.play()
    openColumn()

    vi.advanceTimersByTime(COLUMN_IDLE_MS - 1)
    expect(columnOpen()).toBe(true)

    vi.advanceTimersByTime(1)
    expect(columnOpen()).toBe(false)
  })

  it('starts the four seconds again when it is used', () => {
    const room = mount()
    room.play()
    openColumn()

    vi.advanceTimersByTime(COLUMN_IDLE_MS - 100)
    touchColumn()
    vi.advanceTimersByTime(COLUMN_IDLE_MS - 100)
    expect(columnOpen()).toBe(true)

    vi.advanceTimersByTime(100)
    expect(columnOpen()).toBe(false)
  })

  it('does not reopen after being closed by hand', () => {
    const room = mount()
    room.play()
    openColumn()
    closeColumn()

    vi.advanceTimersByTime(COLUMN_IDLE_MS)

    expect(columnOpen()).toBe(false)
  })
})

describe('the clock', () => {
  it('counts from the start and holds while paused', () => {
    const room = mount()
    room.play()

    vi.advanceTimersByTime(3000)
    expect(formatElapsed(elapsedMs())).toBe('0:03')

    room.controls.pause()
    vi.advanceTimersByTime(5000)
    expect(formatElapsed(elapsedMs())).toBe('0:03')

    room.controls.resume()
    vi.advanceTimersByTime(2000)
    expect(formatElapsed(elapsedMs())).toBe('0:05')
  })

  it('reads as elapsed minutes and seconds, never a total', () => {
    expect(formatElapsed(0)).toBe('0:00')
    expect(formatElapsed(61_000)).toBe('1:01')
    expect(formatElapsed(600_000)).toBe('10:00')
  })
})
