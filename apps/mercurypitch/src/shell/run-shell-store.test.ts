// ============================================================
// The shell's state machine, driven the way a room drives it
// ============================================================
//
// Every case here moves `playbackState` — the app's own signal — rather than
// calling a setter the shell owns, because that is the only way a run ever
// starts in production. A test that set the shell's state directly would
// pass against a shell that had stopped listening.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TAB_EAR_LAB, TAB_PROGRESS, TAB_SINGING, } from '@/features/tabs/constants'
import { registerRunControls } from '@/stores/native-shell-store'
import { setPlaybackState } from '@/stores/playback-state-store'
import { setActiveTab } from '@/stores/ui-store'
import { chipVisible, closeColumn, COLUMN_IDLE_MS, columnOpen, elapsedMs, finishRun, formatElapsed, keepAlertOpen, locked, openColumn, parked, parkRun, railVisible, requestEnd, resetRunShell, runLabel, runOwner, runState, toggleLock, transportVisible, } from './run-shell-store'

function room(overrides: Record<string, unknown> = {}) {
  return {
    tab: TAB_SINGING,
    roomLabel: 'Sing',
    isPlaying: () => false,
    isPaused: () => false,
    pause: vi.fn(),
    resume: vi.fn(),
    stop: vi.fn(),
    park: vi.fn(),
    ...overrides,
  }
}

let unregister: (() => void) | null = null

beforeEach(() => {
  vi.useFakeTimers()
  setActiveTab(TAB_SINGING)
  setPlaybackState('stopped')
  resetRunShell()
})

afterEach(() => {
  unregister?.()
  unregister = null
  setPlaybackState('stopped')
  resetRunShell()
  vi.useRealTimers()
})

describe('what the bottom edge is showing', () => {
  it('browses until something plays', () => {
    expect(runState()).toBe('browsing')
    expect(railVisible()).toBe(true)
    expect(transportVisible()).toBe(false)
  })

  it('hands the band to the transport while a run is active', () => {
    setPlaybackState('playing')

    expect(runState()).toBe('active')
    expect(transportVisible()).toBe(true)
    expect(railVisible()).toBe(false)
    // R2: the chip is the only way back to the tabs during a run.
    expect(chipVisible()).toBe(true)
  })

  it('keeps the transport on pause — the rail does not come back', () => {
    setPlaybackState('playing')
    setPlaybackState('paused')

    expect(runState()).toBe('paused')
    expect(transportVisible()).toBe(true)
    expect(railVisible()).toBe(false)
  })

  it('leaves the take on screen when a run stops, and returns the rail', () => {
    setPlaybackState('playing')
    setPlaybackState('stopped')

    expect(runState()).toBe('ended')
    expect(railVisible()).toBe(true)
    expect(transportVisible()).toBe(false)
  })

  it('does not call resting at stopped an ended run', () => {
    setPlaybackState('stopped')

    expect(runState()).toBe('browsing')
  })
})

describe('who the run belongs to', () => {
  it('takes the owner and the name from the room that registered', () => {
    unregister = registerRunControls(room())

    setPlaybackState('playing')

    expect(runOwner()).toBe(TAB_SINGING)
    expect(runLabel()).toBe('Sing')
  })

  it('falls back to the tab on screen when no room registered', () => {
    setActiveTab(TAB_EAR_LAB)

    setPlaybackState('playing')

    expect(runOwner()).toBe(TAB_EAR_LAB)
  })

  it('is not parked in the room the run is in', () => {
    setPlaybackState('playing')

    expect(parked()).toBe(false)
  })

  it('is parked the moment the singer is somewhere else', () => {
    setPlaybackState('playing')
    setPlaybackState('paused')

    setActiveTab(TAB_PROGRESS)

    expect(parked()).toBe(true)
    // The pill takes the rail's accessory slot; the transport is not here.
    expect(transportVisible()).toBe(false)
    expect(railVisible()).toBe(true)
  })

  it('does not follow an ENDED run into another tab', () => {
    setPlaybackState('playing')
    setPlaybackState('stopped')

    setActiveTab(TAB_PROGRESS)

    expect(parked()).toBe(false)
    expect(runOwner()).toBeNull()
    expect(runState()).toBe('browsing')
  })
})

describe('parking', () => {
  it('asks the room, and the room pauses rather than stops', () => {
    const controls = room()
    unregister = registerRunControls(controls)
    setPlaybackState('playing')

    parkRun()

    expect(controls.park).toHaveBeenCalledTimes(1)
    expect(controls.stop).not.toHaveBeenCalled()
  })

  it('has nothing to park when no run is going', () => {
    const controls = room()
    unregister = registerRunControls(controls)

    parkRun()

    expect(controls.park).not.toHaveBeenCalled()
  })
})

describe('ending a run', () => {
  it('asks before ending, because no room can say the take was kept', () => {
    const controls = room()
    unregister = registerRunControls(controls)
    setPlaybackState('playing')

    requestEnd()

    expect(keepAlertOpen()).toBe(true)
    expect(controls.stop).not.toHaveBeenCalled()
  })

  it('ends without asking when the room says nothing is unsaved', () => {
    const controls = room({ hasUnsavedTake: () => false })
    unregister = registerRunControls(controls)
    setPlaybackState('playing')

    requestEnd()

    expect(keepAlertOpen()).toBe(false)
    expect(controls.stop).toHaveBeenCalledTimes(1)
  })

  it('stops on either answer to the alert', () => {
    const controls = room()
    unregister = registerRunControls(controls)
    setPlaybackState('playing')
    requestEnd()

    finishRun()

    expect(keepAlertOpen()).toBe(false)
    expect(controls.stop).toHaveBeenCalledTimes(1)
  })
})

describe('the lock', () => {
  it('refuses Stop while it is on, and lets go again', () => {
    const controls = room()
    unregister = registerRunControls(controls)
    setPlaybackState('playing')

    toggleLock()
    expect(locked()).toBe(true)
    requestEnd()
    expect(keepAlertOpen()).toBe(false)

    toggleLock()
    requestEnd()
    expect(keepAlertOpen()).toBe(true)
  })

  it('is released by the end of the run, never left on for the next one', () => {
    setPlaybackState('playing')
    toggleLock()

    setPlaybackState('stopped')

    expect(locked()).toBe(false)
  })
})

describe('the tab column', () => {
  it('opens only while the chip is on screen', () => {
    openColumn()
    expect(columnOpen()).toBe(false)

    setPlaybackState('playing')
    openColumn()
    expect(columnOpen()).toBe(true)
  })

  it('closes itself after four seconds untouched', () => {
    setPlaybackState('playing')
    openColumn()

    vi.advanceTimersByTime(COLUMN_IDLE_MS - 1)
    expect(columnOpen()).toBe(true)

    vi.advanceTimersByTime(1)
    expect(columnOpen()).toBe(false)
  })

  it('does not reopen after being closed by hand', () => {
    setPlaybackState('playing')
    openColumn()
    closeColumn()

    vi.advanceTimersByTime(COLUMN_IDLE_MS)

    expect(columnOpen()).toBe(false)
  })
})

describe('the clock', () => {
  it('counts from the start and holds while paused', () => {
    setPlaybackState('playing')

    vi.advanceTimersByTime(3000)
    expect(formatElapsed(elapsedMs())).toBe('0:03')

    setPlaybackState('paused')
    vi.advanceTimersByTime(5000)
    expect(formatElapsed(elapsedMs())).toBe('0:03')

    setPlaybackState('playing')
    vi.advanceTimersByTime(2000)
    expect(formatElapsed(elapsedMs())).toBe('0:05')
  })

  it('reads as elapsed minutes and seconds, never a total', () => {
    expect(formatElapsed(0)).toBe('0:00')
    expect(formatElapsed(61_000)).toBe('1:01')
    expect(formatElapsed(600_000)).toBe('10:00')
  })
})
