// ============================================================
// A room that owns its transport (S8 decision D2 A)
// ============================================================
//
// The Karaoke room plays inside zen's own bar: the scrubber, both times, the
// mic, the music level, back to start, play and next. The shell's Transport
// has none of the scrubber, the level or next, so during a song it must not
// replace that bar (D2 B was that, and was not chosen). What the shell still
// does is step the rail aside, as it does for a Sing take — so a song is a
// run with the rail hidden and nothing of the shell's drawn in its place.
//
// Before the first play and after a song ends, the rail is back, exactly as
// in Sing.

import { createSignal } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TAB_KARAOKE, TAB_PROGRESS, TAB_SINGING, } from '@/features/tabs/constants'
import type { NativeRunControls } from '@/stores/native-shell-store'
import { consumeRunParked, registerRunControls, resetRoomArrivalHolds, } from '@/stores/native-shell-store'
import { setPlaybackState } from '@/stores/playback-state-store'
import { setActiveTab } from '@/stores/ui-store'
import { chipVisible, parkRun, railVisible, resetRunShell, runState, transportVisible, } from './run-shell-store'

function room(extra: Partial<NativeRunControls> = {}) {
  const [playing, setPlaying] = createSignal(false)
  const [paused, setPaused] = createSignal(false)
  const controls: NativeRunControls = {
    tab: TAB_KARAOKE,
    roomLabel: 'Broadway Theater',
    ownsTransport: true,
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
    ...extra,
  }
  return {
    controls,
    play: () => {
      setPlaying(true)
      setPaused(false)
    },
    end: () => {
      setPlaying(false)
      setPaused(false)
    },
  }
}

const settled = (): Promise<void> =>
  new Promise((resolve) => {
    queueMicrotask(resolve)
  })

let unregister: (() => void) | null = null

beforeEach(() => {
  setActiveTab(TAB_KARAOKE)
  setPlaybackState('stopped')
  resetRunShell()
  resetRoomArrivalHolds()
})

afterEach(() => {
  unregister?.()
  unregister = null
  resetRunShell()
  consumeRunParked(TAB_KARAOKE)
  consumeRunParked(TAB_SINGING)
})

describe('a room that owns its transport', () => {
  it('shows the rail before the first play', () => {
    const karaoke = room()
    unregister = registerRunControls(karaoke.controls)

    expect(runState()).toBe('browsing')
    expect(railVisible()).toBe(true)
    expect(transportVisible()).toBe(false)
  })

  it('steps the rail aside during a song, and draws no Transport of its own', () => {
    const karaoke = room()
    unregister = registerRunControls(karaoke.controls)

    karaoke.play()

    expect(runState()).toBe('active')
    expect(railVisible()).toBe(false)
    expect(transportVisible()).toBe(false)
    // The corner chip belongs to the shell's band, which is not drawn.
    expect(chipVisible()).toBe(false)
  })

  it('keeps the rail aside while the song is paused mid-way', () => {
    const karaoke = room()
    unregister = registerRunControls(karaoke.controls)
    karaoke.play()

    karaoke.controls.pause()

    expect(runState()).toBe('paused')
    expect(railVisible()).toBe(false)
    expect(transportVisible()).toBe(false)
  })

  it('brings the rail back when the song ends', async () => {
    const karaoke = room()
    unregister = registerRunControls(karaoke.controls)
    karaoke.play()

    karaoke.end()
    await settled()

    expect(railVisible()).toBe(true)
    expect(transportVisible()).toBe(false)
  })

  it('gives the rail back on the other tabs while the song is parked', () => {
    const karaoke = room()
    unregister = registerRunControls(karaoke.controls)
    karaoke.play()

    parkRun()
    unregister()
    unregister = null
    setActiveTab(TAB_PROGRESS)

    expect(runState()).toBe('paused')
    expect(railVisible()).toBe(true)
    expect(transportVisible()).toBe(false)
  })
})

describe('a room that does not', () => {
  it('still gets the shell Transport and the chip, as Sing does', () => {
    setActiveTab(TAB_SINGING)
    const sing = room({ tab: TAB_SINGING, ownsTransport: undefined })
    unregister = registerRunControls(sing.controls)

    sing.play()

    expect(railVisible()).toBe(false)
    expect(transportVisible()).toBe(true)
    expect(chipVisible()).toBe(true)
  })
})
