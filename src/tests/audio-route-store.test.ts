// ============================================================
// Audio Route Store Tests — following where the sound goes
// ============================================================
//
// The phone's output is a fake that answers reads when told and keeps the
// route listener it was handed, so each case says exactly what the phone
// reported, and in which order.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { audioRoute, followAudioRoute, setAudioRouteForTests, } from '@/stores/audio-route-store'
import type { NativeAudioOutput, NativeAudioOutputReading, NativeAudioRoute, } from '@/stores/native-shell-store'

function reading(route: NativeAudioRoute): NativeAudioOutputReading {
  return {
    volume: 0.5,
    volumeKnown: 'live',
    step: null,
    steps: null,
    route,
    outputs: [],
    detail: {},
    reason: null,
  }
}

/** A phone whose reads wait to be answered, and whose route can change. */
function fakeOutput(options: { watchRoute?: boolean } = {}) {
  const answers: ((value: NativeAudioOutputReading | null) => void)[] = []
  let heard: ((route: NativeAudioRoute) => void) | null = null
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
          watchRoute: (handler: (route: NativeAudioRoute) => void) => {
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
    change: (route: NativeAudioRoute) => {
      heard?.(route)
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
