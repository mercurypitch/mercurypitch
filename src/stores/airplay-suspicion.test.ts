// ============================================================
// AirPlay suspected from the page's rate, which the app's session cannot see
// ============================================================
//
// The owner's iPhone on an LG C2 over AirPlay (3 Nov 2026): the app's
// session said the speaker at 48 kHz throughout, and the page's contexts
// made after the TV took the sound ran at 44.1 kHz. Each case is a reading
// the phone could give; the route and the session's rate come in as the
// route store has them, the page's rate as its contexts are made.

import type { MockInstance } from 'vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setAudioRouteForTests } from '@/stores/audio-route-store'
import type { AirPlayFacts } from './airplay-suspicion'
import { airPlayAlone, airPlayLine, airPlaySuspected, followAirPlaySuspicion, followExternalScreen, notePageAudioContext, resetAirPlaySuspicionForTests, suspectsAirPlay, } from './airplay-suspicion'

/** The phone's speaker at 48 kHz, the page's contexts made on AirPlay. */
const ON_AIRPLAY: AirPlayFacts = {
  route: 'speaker',
  sessionRate: 48000,
  pageRate: 44100,
  screen: false,
}

/** A screen the device says comes and goes. */
function fakeScreen() {
  let heard: ((connected: boolean) => void) | null = null
  const stopWatching = vi.fn()
  return {
    watch: (handler: (connected: boolean) => void) => {
      heard = handler
      return stopWatching
    },
    stopWatching,
    connect: (connected: boolean) => heard?.(connected),
  }
}

let info: MockInstance<(...data: unknown[]) => void>
let stops: (() => void)[] = []

beforeEach(() => {
  info = vi.spyOn(console, 'info').mockImplementation(() => undefined)
  resetAirPlaySuspicionForTests()
  setAudioRouteForTests('speaker', 'Speaker', 48000)
})

afterEach(() => {
  for (const stop of stops) stop()
  stops = []
  info.mockRestore()
  resetAirPlaySuspicionForTests()
  setAudioRouteForTests(null)
})

const lines = (): unknown[] => info.mock.calls.map((call) => call[0])

describe('suspectsAirPlay', () => {
  it('suspects AirPlay when the page runs at 44.1 kHz and the phone’s speaker at 48', () => {
    expect(suspectsAirPlay(ON_AIRPLAY)).toBe(true)
  })

  it('suspects it on the receiver at the ear as well', () => {
    expect(suspectsAirPlay({ ...ON_AIRPLAY, route: 'receiver' })).toBe(true)
  })

  it('suspects nothing on the speaker when the page runs at its 48 kHz', () => {
    expect(suspectsAirPlay({ ...ON_AIRPLAY, pageRate: 48000 })).toBe(false)
  })

  it.each(['bluetooth', 'headphones', 'hdmi', 'airplay', 'other'] as const)(
    'suspects nothing on %s, which the app’s session sees for itself',
    (route) => {
      expect(suspectsAirPlay({ ...ON_AIRPLAY, route })).toBe(false)
    },
  )

  it('suspects nothing while a screen is connected: Screen Mirroring takes the sound properly', () => {
    expect(suspectsAirPlay({ ...ON_AIRPLAY, screen: true })).toBe(false)
  })

  it('suspects nothing before both rates and the route are known', () => {
    expect(suspectsAirPlay({ ...ON_AIRPLAY, pageRate: null })).toBe(false)
    expect(suspectsAirPlay({ ...ON_AIRPLAY, sessionRate: null })).toBe(false)
    expect(suspectsAirPlay({ ...ON_AIRPLAY, route: null })).toBe(false)
  })
})

describe('the page’s rate, as its contexts are made', () => {
  it('suspects AirPlay once a context runs at 44.1 kHz with the session at 48', () => {
    notePageAudioContext({ sampleRate: 48000 })
    expect(airPlaySuspected()).toBe(false)

    notePageAudioContext({ sampleRate: 44100 })

    expect(airPlaySuspected()).toBe(true)
  })

  it('reads a context once, as it is first seen: the newest one tells', () => {
    const madeOnAirPlay = { sampleRate: 44100 }
    notePageAudioContext(madeOnAirPlay)
    notePageAudioContext({ sampleRate: 48000 })

    // The clock made on AirPlay, handed out again by a later lease.
    notePageAudioContext(madeOnAirPlay)

    expect(airPlaySuspected()).toBe(false)
  })

  it('takes no rate from a context that says none', () => {
    notePageAudioContext({ sampleRate: 44100 })

    notePageAudioContext({ sampleRate: Number.NaN })
    notePageAudioContext({ sampleRate: 0 })

    expect(airPlaySuspected()).toBe(true)
  })

  it('suspects nothing on Bluetooth, whatever the page’s rate', () => {
    setAudioRouteForTests('bluetooth', 'AirPods', 48000)

    notePageAudioContext({ sampleRate: 44100 })

    expect(airPlaySuspected()).toBe(false)
  })
})

describe('a screen connected', () => {
  it('stops suspecting while a screen is connected, and starts again as it goes', () => {
    const screen = fakeScreen()
    stops.push(followExternalScreen(screen.watch))
    notePageAudioContext({ sampleRate: 44100 })

    screen.connect(true)
    expect(airPlaySuspected()).toBe(false)
    screen.connect(false)
    expect(airPlaySuspected()).toBe(true)
  })

  it('stops hearing the screen once stopped, and follows nothing on the web', () => {
    const screen = fakeScreen()
    const stop = followExternalScreen(screen.watch)
    notePageAudioContext({ sampleRate: 44100 })

    stop()
    screen.connect(true)

    expect(screen.stopWatching).toHaveBeenCalledTimes(1)
    expect(airPlaySuspected()).toBe(true)
    expect(() => followExternalScreen(undefined)()).not.toThrow()
  })
})

describe('AirPlay alone, which the room’s words turn on', () => {
  it('is the route saying airplay, or AirPlay suspected', () => {
    expect(airPlayAlone()).toBe(false)
    notePageAudioContext({ sampleRate: 44100 })
    expect(airPlayAlone()).toBe(true)

    resetAirPlaySuspicionForTests()
    setAudioRouteForTests('airplay', 'LG C2', 44100)
    expect(airPlayAlone()).toBe(true)
  })

  it('is never so while a screen is connected, the route’s word included', () => {
    const screen = fakeScreen()
    stops.push(followExternalScreen(screen.watch))
    setAudioRouteForTests('airplay', 'LG C2', 44100)

    screen.connect(true)

    expect(airPlayAlone()).toBe(false)
  })
})

describe('what the console is told', () => {
  it('says AirPlay is likely, once, in a line shown by default', () => {
    stops.push(followAirPlaySuspicion())

    notePageAudioContext({ sampleRate: 44100 })
    notePageAudioContext({ sampleRate: 44100 })

    expect(lines()).toEqual([
      "[audio route] the page plays at 44100 Hz, the phone's session at 48000 Hz on Speaker: the sound is likely on AirPlay",
    ])
  })

  it('says nothing at the start, when nothing is suspected', () => {
    stops.push(followAirPlaySuspicion())

    notePageAudioContext({ sampleRate: 48000 })

    expect(lines()).toEqual([])
  })

  it('says why it is no longer suspected as the rate comes back', () => {
    stops.push(followAirPlaySuspicion())
    notePageAudioContext({ sampleRate: 44100 })

    notePageAudioContext({ sampleRate: 48000 })

    expect(lines().at(-1)).toBe(
      "[audio route] the page plays at 48000 Hz, as the phone's session does: AirPlay no longer suspected",
    )
    expect(lines()).toHaveLength(2)
  })

  it('says a screen took it, and a route the session sees', () => {
    const screen = fakeScreen()
    stops.push(followExternalScreen(screen.watch))
    stops.push(followAirPlaySuspicion())
    notePageAudioContext({ sampleRate: 44100 })

    screen.connect(true)
    screen.connect(false)
    setAudioRouteForTests('bluetooth', 'AirPods', 48000)

    expect(lines()).toEqual([
      "[audio route] the page plays at 44100 Hz, the phone's session at 48000 Hz on Speaker: the sound is likely on AirPlay",
      '[audio route] a screen is connected (Screen Mirroring or a cable): AirPlay no longer suspected',
      "[audio route] the page plays at 44100 Hz, the phone's session at 48000 Hz on Speaker: the sound is likely on AirPlay",
      "[audio route] the phone's session plays on bluetooth: AirPlay no longer suspected",
    ])
  })

  it('names no port, only the kind of output', () => {
    setAudioRouteForTests('receiver', 'Viki’s iPhone', 48000)

    const line = airPlayLine({ ...ON_AIRPLAY, route: 'receiver' }, true)

    expect(line).toContain('on Receiver')
    expect(line).not.toMatch(/Viki/)
  })
})
