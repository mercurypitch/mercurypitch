// ============================================================
// The output check: a fresh context's rate, read when it matters
// ============================================================
//
// The owner's cold start (TestFlight mp-v0.8.57, an iPhone 13 Pro and an LG
// C2 over AirPlay): the shared clock, made at launch on the speaker, ran at
// 48 kHz for good, so nothing ever said AirPlay, and the song reached
// neither the TV nor the phone. A fresh context runs at the rate the output
// has now. Each case hands the check a context WebKit could have made: at
// AirPlay's 44.1 kHz, at the speaker's 48, or none at all.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { airPlaySuspected, followExternalScreen, notePageAudioContext, resetAirPlaySuspicionForTests, } from '@/stores/airplay-suspicion'
import { setAudioRouteForTests } from '@/stores/audio-route-store'
import type { NativeAudioOutput, NativeAudioRoute, } from '@/stores/native-shell-store'
import type { OutputCheckHost } from './output-check'
import { CHECK_SETTLE_MS, checkForStart, checkOutput, checkOutputSoon, followOutputChecks, lastOutputCheck, resetOutputCheckForTests, START_REUSE_MS, webAudioAlone, } from './output-check'

/** The phone's clock, moved by hand. */
let clock = 1_000_000
let said: string[] = []
let stops: (() => void)[] = []

/** Fresh contexts as WebKit makes them: each at the output's rate now. */
function fakeOutput(rate = 48000) {
  let now = rate
  let refusal: Error | null = null
  /** Closes that have not settled yet, when they are held. */
  const pending: (() => void)[] = []
  let hold = false
  const made: { sampleRate: number; close: () => Promise<void> }[] = []
  const closed: number[] = []
  const host: Partial<OutputCheckHost> = {
    makeProbe: () => {
      if (refusal !== null) throw refusal
      const n = made.length
      const probe = {
        sampleRate: now,
        close: async () => {
          if (hold) {
            await new Promise<void>((resolve) => {
              pending.push(resolve)
            })
          }
          closed.push(n)
        },
      }
      made.push(probe)
      return probe
    },
    inGesture: () => null,
    now: () => clock,
    say: (line) => {
      said.push(line)
    },
  }
  return {
    host,
    made,
    closed,
    goTo: (next: number) => {
      now = next
    },
    refuse: (error: Error | null) => {
      refusal = error
    },
    holdCloses: () => {
      hold = true
    },
    letCloses: async () => {
      hold = false
      for (const settle of pending.splice(0)) settle()
      await flush()
    },
  }
}

/** Let every close in flight settle. */
async function flush(): Promise<void> {
  for (let i = 0; i < 10; i += 1) await Promise.resolve()
}

/** The phone's route changes, heard as the route store hears them. */
function fakeRoutes() {
  let heard: (route: NativeAudioRoute) => void = () => undefined
  const output: NativeAudioOutput = {
    read: async () => null,
    watch: () => () => undefined,
    watchRoute: (handler) => {
      heard = handler
      return () => {
        heard = () => undefined
      }
    },
  }
  return { output, change: (route: NativeAudioRoute) => heard(route) }
}

beforeEach(() => {
  clock = 1_000_000
  said = []
  resetOutputCheckForTests()
  resetAirPlaySuspicionForTests()
  // The app's session on its speaker at 48 kHz, and the shared clock made
  // at launch there: 48 kHz too, for good.
  setAudioRouteForTests('speaker', 'Speaker', 48000)
  notePageAudioContext({ sampleRate: 48000 })
})

afterEach(() => {
  for (const stop of stops) stop()
  stops = []
  vi.useRealTimers()
  resetOutputCheckForTests()
  resetAirPlaySuspicionForTests()
  setAudioRouteForTests(null)
})

describe('a check', () => {
  it('reads a fresh context’s rate, closes the context and hands the rate to the guess', async () => {
    const tv = fakeOutput(44100)
    stops.push(followOutputChecks({ host: tv.host }))
    expect(airPlaySuspected()).toBe(false)

    const check = checkOutput('room')
    await flush()

    expect(check?.rate).toBe(44100)
    expect(check?.verdict).toBe('airplay')
    expect(airPlaySuspected()).toBe(true)
    expect(tv.made).toHaveLength(1)
    expect(tv.closed).toEqual([0])
    expect(lastOutputCheck()).toBe(check)
  })

  it('writes one line, with the moment, the gesture, both rates and the route’s kind, never the port', () => {
    const tv = fakeOutput(44100)
    setAudioRouteForTests('speaker', 'Viki’s iPhone', 48000)
    stops.push(followOutputChecks({ host: tv.host }))

    checkOutput('room')

    expect(said).toEqual([
      "[audio route] check (a room shown, outside a gesture): a fresh context at 44100 Hz, the phone's session at 48000 Hz on speaker: AirPlay alone",
    ])
  })

  it('counts a start as inside its gesture, and any other moment as outside, where the page cannot say', async () => {
    const phone = fakeOutput(48000)
    stops.push(followOutputChecks({ host: phone.host }))

    checkOutput('play')
    await flush()
    checkOutput('route')

    expect(said).toEqual([
      "[audio route] check (play, in a gesture): a fresh context at 48000 Hz, the phone's session at 48000 Hz on speaker: local",
      "[audio route] check (a route change, outside a gesture): a fresh context at 48000 Hz, the phone's session at 48000 Hz on speaker: local",
    ])
  })

  it('takes the page’s own word on the gesture where it gives one', () => {
    const phone = fakeOutput(48000)
    stops.push(
      followOutputChecks({ host: { ...phone.host, inGesture: () => true } }),
    )

    checkOutput('room')

    expect(lastOutputCheck()?.gesture).toBe(true)
    expect(said[0]).toContain('check (a room shown, in a gesture)')
  })

  it('makes no second context while the last one is closing, and the next once it has', async () => {
    const phone = fakeOutput(48000)
    phone.holdCloses()
    stops.push(followOutputChecks({ host: phone.host }))

    checkOutput('room')
    const busy = checkOutput('room')
    await phone.letCloses()
    const next = checkOutput('room')

    expect(busy?.rate).toBeNull()
    expect(busy?.failure).toBe("the last check's context is still closing")
    expect(next?.rate).toBe(48000)
    expect(phone.made).toHaveLength(2)
  })

  it('says what WebKit refused, and that it cannot tell', () => {
    const phone = fakeOutput(48000)
    phone.refuse(
      Object.assign(new Error('too many'), { name: 'NotSupportedError' }),
    )
    stops.push(followOutputChecks({ host: phone.host }))

    const check = checkOutput('room')

    expect(check?.verdict).toBe('unknown')
    expect(said).toEqual([
      "[audio route] check (a room shown, outside a gesture): no fresh context (NotSupportedError), the phone's session at 48000 Hz on speaker: unknown",
    ])
  })

  it('makes nothing where the app does not follow the moments, as on the web', () => {
    expect(checkOutput('room')).toBeNull()
    expect(checkForStart('play')).toBe(true)
    expect(said).toEqual([])
  })
})

describe('a start', () => {
  it('keeps the clip and the carrier from playing where a fresh context runs at AirPlay’s 44.1 kHz beside a 48 kHz clock', () => {
    const tv = fakeOutput(44100)
    stops.push(followOutputChecks({ host: tv.host }))

    const mayPlay = checkForStart('play')

    expect(mayPlay).toBe(false)
    expect(webAudioAlone()).toBe(true)
    expect(said.at(-1)).toBe(
      "[audio route] check (play, in a gesture): a fresh context at 44100 Hz, the phone's session at 48000 Hz on speaker: AirPlay alone",
    )
  })

  it('lets them play where the fresh context runs at the speaker’s rate', () => {
    const phone = fakeOutput(48000)
    stops.push(followOutputChecks({ host: phone.host }))

    expect(checkForStart('play')).toBe(true)
    expect(webAudioAlone()).toBe(false)
  })

  it('stands them aside when its check cannot run, until a check says the sound stays here', async () => {
    const phone = fakeOutput(48000)
    phone.refuse(new Error('no'))
    stops.push(followOutputChecks({ host: phone.host }))

    expect(checkForStart('play')).toBe(false)
    expect(webAudioAlone()).toBe(true)
    expect(said.at(-1)).toContain(
      "unknown, so nothing plays beside the room's sound",
    )
    phone.refuse(null)
    clock += START_REUSE_MS
    await flush()
    checkOutput('route')

    expect(webAudioAlone()).toBe(false)
  })

  it('lets them play while a screen is connected, whatever the check, as Screen Mirroring always did', () => {
    const phone = fakeOutput(48000)
    phone.refuse(new Error('no'))
    let connect: (connected: boolean) => void = () => undefined
    stops.push(
      followExternalScreen((handler) => {
        connect = handler
        return () => undefined
      }),
    )
    connect(true)
    stops.push(followOutputChecks({ host: phone.host }))

    expect(checkForStart('play')).toBe(true)
    expect(webAudioAlone()).toBe(false)
  })

  it('takes the check its own tap made a moment before, and makes no second context', async () => {
    const tv = fakeOutput(44100)
    stops.push(followOutputChecks({ host: tv.host }))

    checkForStart('tap')
    clock += 120
    await flush()
    const mayPlay = checkForStart('play')

    expect(mayPlay).toBe(false)
    expect(tv.made).toHaveLength(1)
  })

  it('makes its own check rather than take one a room made a moment before', async () => {
    const tv = fakeOutput(44100)
    stops.push(followOutputChecks({ host: tv.host }))
    checkOutput('room')
    clock += 200
    await flush()

    checkForStart('play')

    expect(tv.made).toHaveLength(2)
  })

  it('makes its own check once its tap’s is older than a moment', async () => {
    const phone = fakeOutput(48000)
    stops.push(followOutputChecks({ host: phone.host }))
    checkForStart('tap')
    clock += START_REUSE_MS
    await flush()

    checkForStart('play')

    expect(phone.made).toHaveLength(2)
  })

  it('takes the check whose context is still closing, rather than wait in the gesture', () => {
    const tv = fakeOutput(44100)
    tv.holdCloses()
    stops.push(followOutputChecks({ host: tv.host }))
    checkOutput('route')
    clock += 50

    const mayPlay = checkForStart('play')

    expect(mayPlay).toBe(false)
    expect(tv.made).toHaveLength(1)
    expect(said).toHaveLength(1)
  })
})

describe('the moments a check is made at', () => {
  it('reads the output again a moment after the route changes, once for a burst of changes', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const phone = fakeOutput(44100)
    const routes = fakeRoutes()
    stops.push(followOutputChecks({ host: phone.host, output: routes.output }))

    routes.change('speaker')
    routes.change('speaker')
    vi.advanceTimersByTime(CHECK_SETTLE_MS - 1)
    expect(phone.made).toHaveLength(0)
    vi.advanceTimersByTime(1)

    expect(phone.made).toHaveLength(1)
    expect(lastOutputCheck()?.why).toBe('route')
  })

  it('follows AirPlay going away: the page’s rate comes back to the speaker’s with the route', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const tv = fakeOutput(44100)
    const routes = fakeRoutes()
    stops.push(followOutputChecks({ host: tv.host, output: routes.output }))
    checkOutput('room')
    await flush()
    expect(airPlaySuspected()).toBe(true)

    tv.goTo(48000)
    routes.change('speaker')
    vi.advanceTimersByTime(CHECK_SETTLE_MS)

    expect(airPlaySuspected()).toBe(false)
  })

  it('reads it as the app comes back in front, and not as it goes behind', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const phone = fakeOutput(48000)
    let state: (next: 'active' | 'background') => void = () => undefined
    stops.push(
      followOutputChecks({
        host: phone.host,
        appState: (handler) => {
          state = handler
          return () => undefined
        },
      }),
    )

    state('background')
    vi.advanceTimersByTime(CHECK_SETTLE_MS)
    expect(phone.made).toHaveLength(0)
    state('active')
    vi.advanceTimersByTime(CHECK_SETTLE_MS)

    expect(phone.made).toHaveLength(1)
    expect(lastOutputCheck()?.why).toBe('app')
  })

  it('reads it as the page is shown again', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const phone = fakeOutput(48000)
    stops.push(followOutputChecks({ host: phone.host }))

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    })
    document.dispatchEvent(new Event('visibilitychange'))
    vi.advanceTimersByTime(CHECK_SETTLE_MS)

    expect(phone.made).toHaveLength(1)
    expect(lastOutputCheck()?.why).toBe('page')
  })

  it('reads it at once as a room is shown, and waits for a context still closing', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const phone = fakeOutput(48000)
    phone.holdCloses()
    let shown: () => void = () => undefined
    stops.push(
      followOutputChecks({
        host: phone.host,
        roomShown: (handler) => {
          shown = handler
          return () => undefined
        },
      }),
    )

    shown()
    expect(phone.made).toHaveLength(1)
    shown()
    expect(phone.made).toHaveLength(1)
    await phone.letCloses()
    vi.advanceTimersByTime(CHECK_SETTLE_MS)

    expect(phone.made).toHaveLength(2)
  })

  it('reads it once more a moment after it was asked to, for a song that started', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const tv = fakeOutput(44100)
    stops.push(followOutputChecks({ host: tv.host }))

    checkOutputSoon('song', 1500)
    vi.advanceTimersByTime(1499)
    expect(tv.made).toHaveLength(0)
    vi.advanceTimersByTime(1)

    expect(lastOutputCheck()?.why).toBe('song')
    expect(airPlaySuspected()).toBe(true)
  })

  it('stops reading at every moment once the following stops', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const phone = fakeOutput(48000)
    const routes = fakeRoutes()
    const stop = followOutputChecks({ host: phone.host, output: routes.output })
    routes.change('speaker')

    stop()
    vi.advanceTimersByTime(CHECK_SETTLE_MS)

    expect(phone.made).toHaveLength(0)
    expect(checkOutput('room')).toBeNull()
  })
})
