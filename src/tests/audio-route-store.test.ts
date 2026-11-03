// ============================================================
// Audio Route Store Tests — following where the sound goes
// ============================================================
//
// The phone's output is a fake that answers reads when told and keeps the
// route listener it was handed, so each case says exactly what the phone
// reported, and in which order.

import type { MockInstance } from 'vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { audioRoute, audioRoutePort, audioSessionRate, followAudioRoute, setAudioRouteForTests, } from '@/stores/audio-route-store'
import type { NativeAudioOutput, NativeAudioOutputReading, NativeAudioRoute, NativeAudioRouteChange, } from '@/stores/native-shell-store'

type Ports = NativeAudioOutputReading['outputs']

function reading(
  route: NativeAudioRoute,
  outputs: Ports = [],
  detail: Record<string, unknown> = {},
): NativeAudioOutputReading {
  return {
    volume: 0.5,
    volumeKnown: 'live',
    step: null,
    steps: null,
    route,
    outputs,
    detail,
    reason: null,
  }
}

/** A change of route as AudioOutputPlugin.swift words one. */
function iosChange(
  over: Partial<NativeAudioRouteChange> = {},
): NativeAudioRouteChange {
  return {
    outputs: [],
    reason: 'route',
    routeReason: null,
    previousOutputs: [],
    ...over,
  }
}

const TV: Ports = [{ type: 'AirPlay', name: 'LG C2' }]
const PHONE: Ports = [{ type: 'Speaker', name: 'Speaker' }]

/** A phone whose reads wait to be answered, and whose route can change. */
function fakeOutput(options: { watchRoute?: boolean } = {}) {
  const answers: ((value: NativeAudioOutputReading | null) => void)[] = []
  let heard:
    | ((route: NativeAudioRoute, change?: NativeAudioRouteChange) => void)
    | null = null
  const stopWatching = vi.fn()
  const output: NativeAudioOutput = {
    read: vi.fn(
      async () =>
        new Promise<NativeAudioOutputReading | null>((resolve) => {
          answers.push(resolve)
        }),
    ),
    watch: vi.fn(() => () => undefined),
    ...(options.watchRoute === false
      ? {}
      : {
          watchRoute: (
            handler: (
              route: NativeAudioRoute,
              change?: NativeAudioRouteChange,
            ) => void,
          ) => {
            heard = handler
            return stopWatching
          },
        }),
  }
  return {
    output,
    stopWatching,
    /** Answer the oldest read still waiting. */
    answer: async (value: NativeAudioOutputReading | null) => {
      answers.shift()?.(value)
      await Promise.resolve()
      await Promise.resolve()
    },
    change: (route: NativeAudioRoute, change?: NativeAudioRouteChange) => {
      heard?.(route, change)
    },
  }
}

function setVisibility(state: DocumentVisibilityState): void {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => state,
  })
  document.dispatchEvent(new Event('visibilitychange'))
}

let stop: (() => void) | null = null

beforeEach(() => {
  setAudioRouteForTests(null)
})

afterEach(() => {
  stop?.()
  stop = null
  setVisibility('visible')
})

describe('audio route store', () => {
  it('knows no route on the web, where there is no output to follow', () => {
    stop = followAudioRoute(undefined)
    expect(audioRoute()).toBeNull()
  })

  it('reads the route at once, then hears every change', async () => {
    const fake = fakeOutput()
    stop = followAudioRoute(fake.output)

    await fake.answer(reading('speaker'))
    expect(audioRoute()).toBe('speaker')

    fake.change('airplay')
    expect(audioRoute()).toBe('airplay')
    fake.change('speaker')
    expect(audioRoute()).toBe('speaker')
  })

  it('drops a reading that comes back after a newer change', async () => {
    const fake = fakeOutput()
    stop = followAudioRoute(fake.output)

    fake.change('airplay')
    await fake.answer(reading('speaker'))

    expect(audioRoute()).toBe('airplay')
  })

  it('reads again as the page comes back into view', async () => {
    const fake = fakeOutput()
    stop = followAudioRoute(fake.output)
    await fake.answer(reading('speaker'))

    setVisibility('hidden')
    expect(fake.output.read).toHaveBeenCalledTimes(1)
    setVisibility('visible')
    await fake.answer(reading('hdmi'))

    expect(fake.output.read).toHaveBeenCalledTimes(2)
    expect(audioRoute()).toBe('hdmi')
  })

  it('keeps the last route when a reading says nothing', async () => {
    const fake = fakeOutput()
    stop = followAudioRoute(fake.output)
    fake.change('bluetooth')

    setVisibility('visible')
    await fake.answer(null)
    await fake.answer(null)

    expect(audioRoute()).toBe('bluetooth')
  })

  it('still reads where the app cannot hear the route change', async () => {
    const fake = fakeOutput({ watchRoute: false })
    stop = followAudioRoute(fake.output)

    await fake.answer(reading('airplay'))

    expect(audioRoute()).toBe('airplay')
  })

  it('keeps the app session’s sample rate from each reading and change of route', async () => {
    const fake = fakeOutput()
    stop = followAudioRoute(fake.output)

    await fake.answer(reading('speaker', PHONE, { sampleRate: 48000 }))
    expect(audioSessionRate()).toBe(48000)
    fake.change('speaker', iosChange({ outputs: PHONE, sampleRate: 44100 }))
    expect(audioSessionRate()).toBe(44100)
    // Android says no rate, and a reading that says none is not a rate.
    fake.change('bluetooth', iosChange({ reason: null, sampleRate: null }))
    expect(audioSessionRate()).toBeNull()
    setVisibility('visible')
    await fake.answer(reading('speaker', PHONE, { sampleRate: 'fast' }))
    expect(audioSessionRate()).toBeNull()
  })

  it('stops hearing, and drops what was still on its way, once stopped', async () => {
    const fake = fakeOutput()
    stop = followAudioRoute(fake.output)
    stop()
    stop = null

    await fake.answer(reading('airplay'))
    fake.change('hdmi')
    setVisibility('visible')

    expect(fake.stopWatching).toHaveBeenCalledTimes(1)
    expect(fake.output.read).toHaveBeenCalledTimes(1)
    expect(audioRoute()).toBeNull()
  })
})

describe('what the console is told of the route', () => {
  let log: MockInstance<(...data: unknown[]) => void>

  beforeEach(() => {
    log = vi.spyOn(console, 'log').mockImplementation(() => undefined)
  })

  afterEach(() => {
    log.mockRestore()
  })

  const lines = (): unknown[] => log.mock.calls.map((call) => call[0])

  it('says the route at launch as a routine line, keeping the port for the screen', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const fake = fakeOutput()
    stop = followAudioRoute(fake.output)

    await fake.answer(reading('airplay', TV))

    expect(lines()).toEqual(['[audio route] airplay, at launch'])
    expect(audioRoutePort()).toBe('LG C2')
    // Routine: out of a console that leaves routine logs out.
    expect(info).not.toHaveBeenCalled()
    expect(warn).not.toHaveBeenCalled()
    info.mockRestore()
    warn.mockRestore()
  })

  it('says each route iOS moves: its kind, iOS’s reason and what it was', async () => {
    const fake = fakeOutput()
    stop = followAudioRoute(fake.output)
    await fake.answer(reading('speaker', PHONE))

    fake.change(
      'airplay',
      iosChange({
        outputs: TV,
        routeReason: 'new device',
        previousOutputs: ['Speaker'],
      }),
    )

    expect(lines().at(-1)).toBe(
      '[audio route] airplay, iOS: new device, was Speaker',
    )
    expect(audioRoutePort()).toBe('LG C2')
  })

  it('never writes a port’s own name, which can name its owner', async () => {
    const fake = fakeOutput()
    stop = followAudioRoute(fake.output)
    const buds: Ports = [
      { type: 'BluetoothA2DPOutput', name: 'Viki’s AirPods' },
    ]
    await fake.answer(reading('bluetooth', buds))

    fake.change(
      'airplay',
      iosChange({
        outputs: TV,
        routeReason: 'new device',
        previousOutputs: ['BluetoothA2DPOutput'],
      }),
    )

    expect(lines()).toHaveLength(2)
    for (const line of lines()) {
      expect(line).not.toMatch(/AirPods|LG C2/)
    }
  })

  it('says a route iOS moved onto the same port, for its reason', async () => {
    const fake = fakeOutput()
    stop = followAudioRoute(fake.output)
    await fake.answer(reading('speaker', PHONE))

    fake.change(
      'speaker',
      iosChange({
        outputs: PHONE,
        routeReason: 'category change',
        previousOutputs: ['Speaker'],
      }),
    )

    expect(lines()).toEqual([
      '[audio route] speaker, at launch',
      '[audio route] speaker, iOS: category change, was Speaker',
    ])
  })

  it('says nothing as the app comes back to the route it had, and says a new one', async () => {
    const fake = fakeOutput()
    stop = followAudioRoute(fake.output)
    await fake.answer(reading('speaker', PHONE))

    fake.change(
      'speaker',
      iosChange({ outputs: PHONE, reason: 'app in front' }),
    )
    fake.change('airplay', iosChange({ outputs: TV, reason: 'app in front' }))

    expect(lines()).toEqual([
      '[audio route] speaker, at launch',
      '[audio route] airplay, app in front',
    ])
  })

  it('says a reading on the way back only where the route moved', async () => {
    const fake = fakeOutput()
    stop = followAudioRoute(fake.output)
    await fake.answer(reading('airplay', TV))

    setVisibility('visible')
    await fake.answer(reading('airplay', TV))
    setVisibility('visible')
    await fake.answer(reading('speaker', PHONE))

    expect(lines()).toEqual([
      '[audio route] airplay, at launch',
      '[audio route] speaker, read on the way back',
    ])
  })

  it('says an Android route once, however many devices it reports with no reason', () => {
    const fake = fakeOutput()
    stop = followAudioRoute(fake.output)
    const buds = iosChange({
      outputs: [{ type: 'bluetooth-a2dp', name: 'Pixel Buds' }],
    })

    // Earbuds coming on: A2DP, SCO, BLE and the headset's mic, one callback each.
    for (let callback = 0; callback < 4; callback += 1) {
      fake.change('bluetooth', buds)
    }

    expect(lines()).toEqual(['[audio route] bluetooth'])
  })
})
