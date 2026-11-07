// ============================================================
// A press of play on AirPlay from a cold start: nothing plays beside it
// ============================================================
//
// The owner's cold start (TestFlight mp-v0.8.57, an iPhone 13 Pro and an LG
// C2 over AirPlay chosen before the app opened): the shared clock, made at
// launch on the speaker, ran at 48 kHz for good, so nothing said AirPlay,
// and the press of play had the unlock clip, or the lock screen's carrier,
// play beside the song, which then reached neither the TV nor the phone.
// Here the clock is that stale one, and the press's own check makes a fresh
// context at AirPlay's 44.1 kHz. The real unlock (audio-unlock.ts), guess
// (airplay-suspicion.ts), check (output-check.ts) and wiring
// (standAsideOnAirPlay); the plugin, whose carrier lives in WebKit, is the
// edge, and records what was asked of it, in order.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const edge = vi.hoisted(() => {
  const events: string[] = []
  /** Whoever hears whether the carrier holds the session. */
  const carrier = { holds: null as ((holds: boolean) => void) | null }
  return {
    events,
    carrier,
    platform: {
      keepAwake: async (_on: boolean) => Promise.resolve(),
      setNowPlaying: async (_song: unknown) => Promise.resolve(),
      onMediaAction: (_handler: unknown) => () => undefined,
      setPictureInPictureAutoEnter: async (_on: boolean) => Promise.resolve(),
      onPictureInPicture: (_handler: unknown) => () => undefined,
      pictureInPictureNeedsLyrics: () => false,
      setPictureInPictureLyrics: async (_script: unknown) => Promise.resolve(),
      // The carrier: whether it holds the session is told to whoever asks.
      onNowPlayingHoldsAudio: (listener: (holds: boolean) => void) => {
        carrier.holds = listener
        return () => undefined
      },
      claimNowPlaying: () => {
        events.push('the carrier plays')
      },
      standNowPlayingAside: (aside: boolean) => {
        events.push(aside ? 'the carrier stands aside' : 'the carrier is back')
      },
      micStopsOtherApps: () => true,
      readAudioOutput: async () => Promise.resolve(null),
      onAudioOutput: (_handler: unknown) => () => undefined,
      onAudioRoute: (_handler: unknown) => () => undefined,
      readTvLyrics: async () => Promise.resolve(null),
      onTvLyrics: (_handler: unknown) => () => undefined,
      readTvStage: async () => Promise.resolve(null),
      onTvStage: (_handler: unknown) => () => undefined,
      sendTvStage: async (_message: unknown) => Promise.resolve(),
      tellTheWindowTheClock: (_clock: unknown) => undefined,
    },
  }
})

vi.mock('@irchiinnuss/mobile-runtime/platform', () => edge.platform)

/** The shared clock as the app made it at launch, on the speaker. */
function staleClock() {
  return {
    sampleRate: 48000,
    state: 'suspended',
    currentTime: 0,
    resume: vi.fn(async () => {
      edge.events.push('the clock resumes')
      return Promise.resolve()
    }),
    suspend: vi.fn(async () => Promise.resolve()),
    close: vi.fn(async () => Promise.resolve()),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }
}

/** The press's fresh contexts: each at `rate`, or refused. */
function probes(rate: number | Error) {
  return {
    makeProbe: () => {
      if (rate instanceof Error) throw rate
      edge.events.push(`a fresh context at ${String(rate)} Hz`)
      return { sampleRate: rate, close: async () => Promise.resolve() }
    },
    inGesture: () => true,
    now: () => 1_000_000,
    say: () => undefined,
  }
}

/** The app as main.tsx wires it, with the clock made at launch. */
async function launch(rate: number | Error) {
  vi.resetModules()
  const audioIo = await import('@irchiinnuss/audio-io')
  const routes = await import('@/stores/audio-route-store')
  const check = await import('@/stores/output-check')
  const unlock = await import('@/lib/audio-unlock')
  const device = await import('./native-device')
  // The app's own session on the speaker, as the iPhone 13 Pro reported it.
  routes.setAudioRouteForTests('speaker', 'Speaker', 48000)
  const clock = staleClock()
  audioIo.resetSharedAudioContext({
    createContext: () => clock as unknown as AudioContext,
  })
  const stops = [
    check.followOutputChecks({ host: probes(rate) }),
    device.standUnlockClipAsideForNowPlaying(),
    device.standAsideOnAirPlay(),
  ]
  const lease = device.createNativeDevice().acquireAudio('karaoke-room')
  lease.ensure()
  edge.events.length = 0
  return {
    // The press, as the stem mixer makes it: the session, then the clock.
    pressPlay: () => unlock.unlockForPlayback(() => lease.ensure()),
    stop: () => {
      lease.release()
      for (const stop of stops) stop()
      unlock.standUnlockClipAside(false)
      routes.setAudioRouteForTests(null)
    },
  }
}

let app: Awaited<ReturnType<typeof launch>> | null = null

beforeEach(() => {
  edge.events.length = 0
  edge.carrier.holds = null
  vi.spyOn(console, 'log').mockImplementation(() => undefined)
  vi.spyOn(console, 'info').mockImplementation((line: unknown) => {
    // The unlock clip's own word on where it stands.
    if (String(line).startsWith('[audio unlock]')) {
      edge.events.push(String(line))
    }
  })
  vi.stubGlobal(
    'Audio',
    vi.fn().mockImplementation(function MockAudio() {
      return {
        play: vi.fn(async () => {
          edge.events.push('the unlock clip plays')
          return Promise.resolve()
        }),
        preload: '',
        muted: false,
        setAttribute: vi.fn(),
      }
    }),
  )
})

afterEach(() => {
  app?.stop()
  app = null
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('a press of play with a clock made at launch on the speaker', () => {
  it('stands the carrier and the unlock clip aside before anything plays when the press finds AirPlay', async () => {
    app = await launch(44100)

    app.pressPlay()

    expect(edge.events).toEqual([
      'a fresh context at 44100 Hz',
      "[audio unlock] the sound is on AirPlay: the unlock clip stays quiet, so the room's sound plays alone",
      'the carrier stands aside',
      'the clock resumes',
    ])
  })

  it.each([
    ['finds AirPlay', 44100],
    ['cannot check', new Error('limit')],
  ] as const)(
    'never has a carrier that held the last song take the sound first when the press %s',
    async (_case, rate) => {
      app = await launch(rate)
      // The last song, played on the speaker, left the carrier holding.
      edge.carrier.holds?.(true)
      edge.events.length = 0

      app.pressPlay()

      expect(edge.events).not.toContain('the carrier plays')
      expect(edge.events.at(-1)).toBe('the clock resumes')
      expect(edge.events.indexOf('the carrier stands aside')).toBeLessThan(
        edge.events.indexOf('the clock resumes'),
      )
    },
  )

  it('has a carrier that held the last song take the sound first, as it always has, when the press finds the speaker', async () => {
    app = await launch(48000)
    edge.carrier.holds?.(true)
    edge.events.length = 0

    app.pressPlay()

    expect(edge.events).toEqual([
      'a fresh context at 48000 Hz',
      'the carrier plays',
      'the clock resumes',
    ])
  })

  it('stands both aside when the press cannot check, so the song is heard wherever it goes', async () => {
    app = await launch(
      Object.assign(new Error('limit'), { name: 'NotSupportedError' }),
    )

    app.pressPlay()

    expect(edge.events).toEqual([
      "[audio unlock] the sound is on AirPlay: the unlock clip stays quiet, so the room's sound plays alone",
      'the carrier stands aside',
      'the clock resumes',
    ])
  })

  it('plays the unlock clip before the clock, as it always has, when the press finds the speaker', async () => {
    app = await launch(48000)

    app.pressPlay()

    expect(edge.events).toEqual([
      'a fresh context at 48000 Hz',
      'the unlock clip plays',
      'the clock resumes',
    ])
  })
})
