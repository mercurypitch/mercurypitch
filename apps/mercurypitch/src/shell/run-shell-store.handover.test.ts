// ============================================================
// Two rooms with a run each: a parked run never blocks another room's own
// ============================================================
//
// The shell holds one run, and the session pill is the way back to it while
// the singer is somewhere else. Sing and Karaoke both have runs of their own,
// and TestFlight 0.7.0 walked into the gap between them:
//
//   Karaoke played, then Sing. The Karaoke pill sat over the Sing room, and
//   the Sing run that started under it was taken for the parked Karaoke
//   song: still "parked", so no transport, the rail kept, the pill kept.
//
//   Sing sang, then Karaoke. The Sing pill sat on Karaoke's own bar.
//
// The rule: a room with a run of its own that comes on screen lets go of a
// run the shell holds for another room. The pill goes, and the transport is
// the room's on screen. Nothing is ended: the parked room was parked once,
// never stopped, and keeps its own place, so going back to it brings the run
// back paused, and the shell takes it up again from there.
//
// The Ear Lab, Piano and Guitar are rooms with runs of their own too, which
// the shell does not drive: they register no controls. TestFlight 0.7.1 (28
// Sep): a Sing run parked, then the Ear Lab, and the pill sat on its Today,
// Calibrate, Instruments and Ear Report and took their taps. They let go of
// the parked run the same way, and nothing of theirs is ever taken for it.

import { createSignal } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ActiveTab } from '@/features/tabs/constants'
import { TAB_EAR_LAB, TAB_GUITAR, TAB_HOME, TAB_KARAOKE, TAB_PIANO, TAB_PROGRESS, TAB_SINGING, } from '@/features/tabs/constants'
import type { NativeRunControls } from '@/stores/native-shell-store'
import { consumeRunParked, registerRunControls, resetRoomArrivalHolds, } from '@/stores/native-shell-store'
import { setPlaybackState } from '@/stores/playback-state-store'
import { setActiveTab } from '@/stores/ui-store'
import { elapsedMs, locked, parked, parkRun, railVisible, resetRunShell, runLabel, runOwner, runState, toggleLock, transportVisible, } from './run-shell-store'

/**
 * A room with a run, holding its state at module scope as both real rooms
 * do: a room that comes back mounts onto the state it left.
 */
function room(tab: ActiveTab, roomLabel: string, ownsTransport?: boolean) {
  const [playing, setPlaying] = createSignal(false)
  const [paused, setPaused] = createSignal(false)
  const controls: NativeRunControls = {
    tab,
    roomLabel,
    ownsTransport,
    isPlaying: playing,
    isPaused: paused,
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
  }
  let unregister: (() => void) | null = null
  return {
    controls,
    /** The room is on screen: the tab moved to it and it registered. */
    enter: () => {
      setActiveTab(tab)
      unregister = registerRunControls(controls)
    },
    /** Its own play control. */
    play: () => {
      setPlaying(true)
      setPaused(false)
    },
    /**
     * Left for the alley the way the shell leaves a room: parked on the way
     * out, then unmounted.
     */
    leave: () => {
      parkRun()
      unregister?.()
      unregister = null
      setActiveTab(TAB_HOME)
    },
    unmount: () => {
      unregister?.()
      unregister = null
    },
  }
}

const settled = (): Promise<void> =>
  new Promise((resolve) => {
    queueMicrotask(resolve)
  })

const karaoke = room(TAB_KARAOKE, 'Broadway Theater', true)
const sing = room(TAB_SINGING, 'Retro Analog Studio')

beforeEach(() => {
  vi.useFakeTimers()
  setActiveTab(TAB_HOME)
  setPlaybackState('stopped')
  resetRunShell()
  resetRoomArrivalHolds()
})

afterEach(() => {
  karaoke.unmount()
  sing.unmount()
  for (const controls of [karaoke.controls, sing.controls]) {
    controls.stop()
    vi.mocked(controls.park).mockClear()
    vi.mocked(controls.stop).mockClear()
  }
  resetRunShell()
  consumeRunParked(TAB_KARAOKE)
  consumeRunParked(TAB_SINGING)
  vi.useRealTimers()
})

describe('Karaoke played, then Sing', () => {
  async function karaokeParked(): Promise<void> {
    karaoke.enter()
    karaoke.play()
    await settled()
    karaoke.leave()
    await settled()
  }

  it('keeps the pill on the way, where no room has a run', async () => {
    await karaokeParked()

    expect(parked()).toBe(true)
    expect(runLabel()).toBe('Broadway Theater')
  })

  it('draws no Karaoke pill over the Sing room', async () => {
    await karaokeParked()

    sing.enter()
    await settled()

    expect(parked()).toBe(false)
    expect(runOwner()).toBeNull()
    expect(runState()).toBe('browsing')
    expect(railVisible()).toBe(true)
  })

  it('lets the Sing run start as its own, with the shell transport', async () => {
    await karaokeParked()
    sing.enter()
    await settled()

    sing.play()
    await settled()

    expect(runState()).toBe('active')
    expect(runOwner()).toBe(TAB_SINGING)
    expect(runLabel()).toBe('Retro Analog Studio')
    expect(parked()).toBe(false)
    expect(transportVisible()).toBe(true)
    expect(railVisible()).toBe(false)
  })

  it('ends nothing in Karaoke: the song was parked once and never stopped', async () => {
    await karaokeParked()
    sing.enter()
    sing.play()
    await settled()

    expect(karaoke.controls.park).toHaveBeenCalledTimes(1)
    expect(karaoke.controls.stop).not.toHaveBeenCalled()
  })

  it('starts the Sing run on its own clock', async () => {
    await karaokeParked()
    vi.advanceTimersByTime(30_000)
    sing.enter()
    await settled()

    sing.play()
    await settled()

    expect(elapsedMs()).toBeLessThan(1000)
  })
})

describe('Sing sang, then Karaoke', () => {
  async function singParked(): Promise<void> {
    sing.enter()
    sing.play()
    await settled()
    vi.advanceTimersByTime(20_000)
    sing.leave()
    await settled()
  }

  it('draws no Sing pill over Karaoke’s bar', async () => {
    await singParked()

    karaoke.enter()
    await settled()

    expect(parked()).toBe(false)
    expect(runOwner()).toBeNull()
    expect(runState()).toBe('browsing')
    // The rail is up, and the room's bar rests on it with nothing over it.
    expect(railVisible()).toBe(true)
  })

  it('lets the song play as Karaoke’s own run, with the rail stepped aside', async () => {
    await singParked()
    karaoke.enter()
    await settled()

    karaoke.play()
    await settled()

    expect(runState()).toBe('active')
    expect(runOwner()).toBe(TAB_KARAOKE)
    expect(parked()).toBe(false)
    expect(railVisible()).toBe(false)
    expect(transportVisible()).toBe(false)
  })

  it('loses no take: the Sing run was parked once and never stopped', async () => {
    await singParked()
    karaoke.enter()
    karaoke.play()
    await settled()

    expect(sing.controls.park).toHaveBeenCalledTimes(1)
    expect(sing.controls.stop).not.toHaveBeenCalled()
  })

  it('takes the Sing run back, paused, when Sing comes back on screen', async () => {
    await singParked()
    karaoke.enter()
    karaoke.play()
    await settled()
    karaoke.leave()
    await settled()

    // The Sing room mounts onto the run it left: still paused.
    sing.enter()
    await settled()

    expect(runState()).toBe('paused')
    expect(runOwner()).toBe(TAB_SINGING)
    expect(runLabel()).toBe('Retro Analog Studio')
    expect(parked()).toBe(false)
    expect(transportVisible()).toBe(true)
    expect(railVisible()).toBe(false)
  })

  it('keeps the Sing run’s time across the hand-over', async () => {
    await singParked()
    karaoke.enter()
    karaoke.play()
    await settled()
    vi.advanceTimersByTime(45_000)
    karaoke.leave()
    await settled()

    sing.enter()
    await settled()

    // Twenty seconds sung before the park; none of Karaoke's forty-five.
    expect(elapsedMs()).toBeGreaterThanOrEqual(20_000)
    expect(elapsedMs()).toBeLessThan(21_000)
  })

  it('parks the Sing run again on the next leave, with its pill', async () => {
    await singParked()
    karaoke.enter()
    await settled()
    karaoke.unmount()
    sing.enter()
    await settled()

    sing.leave()
    await settled()
    setActiveTab(TAB_PROGRESS)

    expect(sing.controls.park).toHaveBeenCalledTimes(2)
    expect(parked()).toBe(true)
    expect(runLabel()).toBe('Retro Analog Studio')
  })
})

describe('the room the run belongs to', () => {
  it('lets go of nothing when it comes back', async () => {
    sing.enter()
    sing.play()
    await settled()
    toggleLock()
    sing.leave()
    await settled()

    sing.enter()
    await settled()

    expect(runOwner()).toBe(TAB_SINGING)
    expect(runState()).toBe('paused')
    // The run's own lock came back with it: it was never let go of.
    expect(locked()).toBe(true)
  })
})

describe.each([
  ['the Ear Lab', TAB_EAR_LAB],
  ['Piano', TAB_PIANO],
  ['Guitar', TAB_GUITAR],
])('Sing sang, then %s: a room the shell does not drive', (_name, tab) => {
  /**
   * Sung for twenty seconds, then left for `tab` the way the rail leaves:
   * parked on the way out, the tab moves, and then the room unmounts.
   */
  async function singLeftFor(): Promise<void> {
    sing.enter()
    sing.play()
    await settled()
    vi.advanceTimersByTime(20_000)
    parkRun()
    setActiveTab(tab)
    await settled()
    sing.unmount()
    await settled()
  }

  it('draws no Sing pill over it', async () => {
    await singLeftFor()

    expect(parked()).toBe(false)
    expect(runOwner()).toBeNull()
    expect(runState()).toBe('browsing')
    expect(railVisible()).toBe(true)
    expect(transportVisible()).toBe(false)
  })

  it('never takes the room for the parked run’s', async () => {
    await singLeftFor()
    vi.advanceTimersByTime(5_000)
    await settled()

    expect(runOwner()).not.toBe(tab)
    expect(runLabel()).toBe('')
  })

  it('lets go for good: no pill follows the singer on to Progress', async () => {
    await singLeftFor()

    setActiveTab(TAB_PROGRESS)
    await settled()

    expect(parked()).toBe(false)
    expect(runOwner()).toBeNull()
    expect(runState()).toBe('browsing')
  })

  it('ends nothing in Sing: the take was parked once and never stopped', async () => {
    await singLeftFor()

    expect(sing.controls.park).toHaveBeenCalledTimes(1)
    expect(sing.controls.stop).not.toHaveBeenCalled()
  })

  it('takes the Sing run back, paused, with its time, when Sing comes back', async () => {
    await singLeftFor()
    vi.advanceTimersByTime(45_000)
    setActiveTab(TAB_PROGRESS)
    await settled()

    sing.enter()
    await settled()

    expect(runState()).toBe('paused')
    expect(runOwner()).toBe(TAB_SINGING)
    expect(runLabel()).toBe('Retro Analog Studio')
    expect(transportVisible()).toBe(true)
    // Twenty seconds sung; none of the forty-five spent away.
    expect(elapsedMs()).toBeGreaterThanOrEqual(20_000)
    expect(elapsedMs()).toBeLessThan(21_000)
  })
})

describe('a tab with no run of its own', () => {
  it.each([
    ['Progress', TAB_PROGRESS],
    ['the alley', TAB_HOME],
  ])('keeps the pill on %s', async (_name, tab) => {
    sing.enter()
    sing.play()
    await settled()
    parkRun()
    setActiveTab(tab)
    await settled()
    sing.unmount()
    await settled()

    expect(parked()).toBe(true)
    expect(runOwner()).toBe(TAB_SINGING)
    expect(runLabel()).toBe('Retro Analog Studio')
  })
})
