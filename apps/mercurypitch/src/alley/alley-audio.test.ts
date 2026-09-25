import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { activateAudioPlayback } from '@/lib/audio-unlock'
import type { AmbientActivation } from './alley-audio'
import { AMBIENT_LEVEL, createAlleyAmbient, GAIN_FLOOR, RELEASE_SLACK_MS, } from './alley-audio'
import { AMBIENT_URL } from './alley-plate'

type Call = [string, ...unknown[]]

/** What the app's `fetchAssetRead` hands back: the bytes and their status. */
const read = (status = 200) => ({
  bytes: new ArrayBuffer(8),
  status,
  ok: status === 200,
})

/** A context that records what is scheduled on it, and nothing else. */
function fakeContext(log: Call[]) {
  let sources = 0
  const ctx = {
    currentTime: 1,
    state: 'suspended' as AudioContextState,
    destination: { id: 'destination' },
    resume: vi.fn(async () => {
      ctx.state = 'running'
      log.push(['resume'])
    }),
    suspend: vi.fn(async () => {
      ctx.state = 'suspended'
      log.push(['suspend'])
    }),
    close: vi.fn(async () => {
      ctx.state = 'closed'
      log.push(['close'])
    }),
    listeners: [] as Array<() => void>,
    addEventListener: (type: string, listener: () => void) => {
      if (type === 'statechange') ctx.listeners.push(listener)
    },
    /** What WebKit does to a context a phone call takes over. */
    interrupt: () => {
      ctx.state = 'interrupted' as AudioContextState
      for (const listener of ctx.listeners) listener()
    },
    decodeAudioData: vi.fn(async (bytes: ArrayBuffer) => ({ bytes })),
    createGain: () => {
      const param = {
        value: 1,
        cancelScheduledValues: (t: number) => log.push(['gain.cancel', t]),
        setValueAtTime: (v: number, t: number) => log.push(['gain.set', v, t]),
        exponentialRampToValueAtTime: (v: number, t: number) =>
          log.push(['gain.exp', v, t]),
        setTargetAtTime: (v: number, t: number, tau: number) =>
          log.push(['gain.target', v, t, tau]),
      }
      return {
        gain: param,
        connect: (to: unknown) => log.push(['gain.connect', to]),
        disconnect: () => log.push(['gain.disconnect']),
      }
    },
    createBufferSource: () => {
      const id = ++sources
      const source = {
        buffer: null as unknown,
        loop: false,
        connect: () => log.push([`source${id}.connect`]),
        disconnect: () => log.push([`source${id}.disconnect`]),
        start: (t: number) => log.push([`source${id}.start`, t, source.loop]),
        stop: () => log.push([`source${id}.stop`]),
      }
      return source
    },
  }
  return ctx
}

async function settle(): Promise<void> {
  for (let i = 0; i < 6; i++) await Promise.resolve()
}

describe('the alley ambient', () => {
  let log: Call[]
  let ctx: ReturnType<typeof fakeContext>
  let created: number
  let loads: string[]
  let activations: number

  const make = () =>
    createAlleyAmbient({
      createContext: () => {
        created += 1
        return ctx as unknown as AudioContext
      },
      load: async (url) => {
        loads.push(url)
        return read()
      },
      activate: async (target: AmbientActivation) => {
        activations += 1
        // The app's activateAudioPlayback: init, unlock, then resume.
        const init = target.init()
        log.push(['activate', target.getAudioContext() !== null])
        await init
        await target.resume()
      },
    })

  beforeEach(() => {
    vi.useFakeTimers()
    log = []
    ctx = fakeContext(log)
    created = 0
    loads = []
    activations = 0
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('makes its context inside the tap, through the activation path', () => {
    const ambient = make()
    expect(created).toBe(0)
    ambient.start('sing', 600)
    // Synchronous: the context exists and was handed to the unlock before
    // anything was awaited.
    expect(created).toBe(1)
    expect(activations).toBe(1)
    expect(log[0]).toEqual(['activate', true])
  })

  it('fades in exponentially from the floor over 600 ms, on a looping buffer', async () => {
    const ambient = make()
    ambient.start('sing', 600)
    await settle()
    expect(loads).toEqual([AMBIENT_URL.sing])
    const starts = log.filter((c) => c[0] === 'source1.start')
    expect(starts).toEqual([['source1.start', 1, true]])
    expect(log).toContainEqual(['gain.set', GAIN_FLOOR, 1])
    expect(log).toContainEqual(['gain.exp', AMBIENT_LEVEL, 1.6])
    expect(ambient.sounding()).toBe('sing')
  })

  it('builds one source per start, and none for a second tap on the same door', async () => {
    const ambient = make()
    ambient.start('sing', 600)
    ambient.start('sing', 600)
    await settle()
    expect(ambient.sourcesStarted()).toBe(1)
    // The decoded buffer is reused: one fetch for two starts of one room.
    const stopped = ambient.stop(120)
    vi.advanceTimersByTime(120 + RELEASE_SLACK_MS)
    await stopped
    ambient.start('sing', 600)
    await settle()
    expect(ambient.sourcesStarted()).toBe(2)
    expect(loads).toEqual([AMBIENT_URL.sing])
  })

  it('releases over 520 ms and only then stops the source and resolves', async () => {
    const ambient = make()
    ambient.start('ear', 600)
    await settle()
    ctx.currentTime = 2
    let silent = false
    const done = ambient.stop(520).then(() => {
      silent = true
    })
    const target = log.find((c) => c[0] === 'gain.target')
    expect(target?.slice(1, 3)).toEqual([0, 2])
    // A time constant of a fifth of the release: 99.3% of the way down by 520 ms.
    expect(target?.[3]).toBeCloseTo(0.104, 9)
    expect(log.some((c) => c[0] === 'source1.stop')).toBe(false)
    expect(ambient.stoppedAt()).toBeNull()

    vi.advanceTimersByTime(520 + RELEASE_SLACK_MS - 1)
    await settle()
    expect(silent).toBe(false)

    vi.advanceTimersByTime(1)
    await done
    expect(silent).toBe(true)
    // When, for the walk that orders the room's microphone after it.
    expect(ambient.stoppedAt()).toEqual(expect.any(Number))
    const order = log.map((c) => c[0])
    expect(order.indexOf('source1.stop')).toBeGreaterThan(
      order.indexOf('gain.target'),
    )
    expect(ambient.level()).toBe(0)
    expect(ambient.sounding()).toBeNull()
  })

  it("is silent before the room's primeAudio runs", async () => {
    const ambient = make()
    ambient.start('sing', 600)
    await settle()
    const events: string[] = []
    // The entry's order: the room's arrival waits on the stop.
    const primeAudio = () => events.push('primeAudio')
    void ambient.stop(520).then(() => {
      events.push('silent')
      primeAudio()
    })
    vi.advanceTimersByTime(520 + RELEASE_SLACK_MS)
    await settle()
    expect(events).toEqual(['silent', 'primeAudio'])
    expect(log.map((c) => c[0])).toContain('source1.stop')
  })

  it('cross-fades from one room to the other', async () => {
    const ambient = make()
    ambient.start('sing', 600)
    await settle()
    ambient.start('ear', 600)
    await settle()
    expect(ambient.sounding()).toBe('ear')
    expect(log.some((c) => c[0] === 'gain.target')).toBe(true)
    vi.advanceTimersByTime(200 + RELEASE_SLACK_MS)
    await settle()
    expect(log.map((c) => c[0])).toContain('source1.stop')
    expect(log.map((c) => c[0])).not.toContain('source2.stop')
  })

  it('never starts a source for a start that was stopped before its decode', async () => {
    const ambient = make()
    ambient.start('sing', 600)
    const stopped = ambient.stop(120)
    vi.advanceTimersByTime(120 + RELEASE_SLACK_MS)
    await stopped
    await settle()
    expect(ambient.sourcesStarted()).toBe(0)
  })

  it('lets the hardware sleep once nothing is playing', async () => {
    const ambient = make()
    ambient.start('sing', 600)
    await settle()
    const done = ambient.stop(120)
    vi.advanceTimersByTime(120 + RELEASE_SLACK_MS)
    await done
    await settle()
    expect(ctx.suspend).toHaveBeenCalledTimes(1)
  })
})

describe("the ambient's context over its life", () => {
  // Each createContext() is a new fake, as a real one would be.
  let contexts: Array<ReturnType<typeof fakeContext>>
  let loads: number
  let log: Call[]

  const make = (onResume?: (c: ReturnType<typeof fakeContext>) => void) =>
    createAlleyAmbient({
      createContext: () => {
        const made = fakeContext(log)
        if (onResume !== undefined) {
          made.resume = vi.fn(async () => onResume(made))
        }
        contexts.push(made)
        return made as unknown as AudioContext
      },
      load: async () => {
        loads += 1
        return read()
      },
      activate: async (target: AmbientActivation) => {
        const init = target.init()
        await init
        await target.resume()
      },
    })

  beforeEach(() => {
    vi.useFakeTimers()
    contexts = []
    loads = 0
    log = []
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('replaces a context iOS left interrupted, inside the next tap', async () => {
    const ambient = make()
    ambient.start('sing', 600)
    await settle()
    expect(contexts).toHaveLength(1)

    // A call comes in; the door is tapped again once it is over.
    contexts[0].interrupt()
    ambient.start('ear', 600)

    // Synchronously, inside the tap: the old one closed, a new one made.
    expect(contexts).toHaveLength(2)
    expect(contexts[0].close).toHaveBeenCalledTimes(1)
    await settle()
    expect(log).toContainEqual(['source1.start', 1, true])
    expect(ambient.sounding()).toBe('ear')
  })

  it('replaces one that an interruption left reporting running', async () => {
    const ambient = make()
    ambient.start('sing', 600)
    await settle()
    contexts[0].interrupt()
    // WebKit's quirk: back to 'running' after the interruption, output dead.
    contexts[0].state = 'running'

    ambient.start('ear', 600)
    expect(contexts).toHaveLength(2)
  })

  it('replaces one that a resume inside a tap left not running', async () => {
    const ambient = make(() => undefined)
    ambient.start('sing', 600)
    await settle()
    expect(contexts[0].state).toBe('suspended')

    ambient.start('ear', 600)
    expect(contexts).toHaveLength(2)
  })

  it('replaces one after the page came back from the background', async () => {
    const ambient = make()
    ambient.start('sing', 600)
    await settle()
    void ambient.stop(120)
    await vi.advanceTimersByTimeAsync(200)

    ambient.recover()
    ambient.start('sing', 600)
    expect(contexts).toHaveLength(2)
  })

  it('keeps a healthy one from tap to tap', async () => {
    const ambient = make()
    ambient.start('sing', 600)
    await settle()
    ambient.start('ear', 600)
    expect(contexts).toHaveLength(1)
  })

  it('lets go of its context and buffers once the alley has gone', async () => {
    const ambient = make()
    ambient.start('sing', 600)
    await settle()
    expect(loads).toBe(1)

    void ambient.stop(520)
    ambient.dispose()
    // The fade runs out first: nothing is closed under it.
    await settle()
    await vi.advanceTimersByTimeAsync(300)
    expect(contexts[0].close).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(520 + RELEASE_SLACK_MS - 300)
    await settle()
    expect(contexts[0].close).toHaveBeenCalledTimes(1)

    // The next tap rebuilds both.
    ambient.start('sing', 600)
    await settle()
    expect(contexts).toHaveLength(2)
    expect(loads).toBe(2)
  })

  it('keeps them when a tap came back before the fade ran out', async () => {
    const ambient = make()
    ambient.start('sing', 600)
    await settle()
    void ambient.stop(520)
    ambient.dispose()
    ambient.start('sing', 600)
    await vi.advanceTimersByTimeAsync(1000)
    await settle()
    expect(contexts[0].close).not.toHaveBeenCalled()
    expect(loads).toBe(1)
  })
})

describe('an ambient that does not start', () => {
  let log: Call[]

  beforeEach(() => {
    vi.useFakeTimers()
    log = []
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  // The catch that ends a failed start used to be empty. That is how the
  // iOS status-0 read stayed invisible through two device rounds: the door
  // was silent and nothing anywhere said why.
  it.each(['load', 'decode'] as const)(
    'says so when the %s fails, naming the room, the file and the error',
    async (stage) => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const failure = new Error(`${stage} failed`)
      const ctx = fakeContext(log)
      if (stage === 'decode') {
        ctx.decodeAudioData = vi.fn(async () => {
          throw failure
        })
      }
      const ambient = createAlleyAmbient({
        createContext: () => ctx as unknown as AudioContext,
        load: async () => {
          if (stage === 'load') throw failure
          return read()
        },
        activate: async (target: AmbientActivation) => {
          await target.init()
          await target.resume()
        },
      })
      ambient.start('sing', 600)
      await settle()
      expect(warn).toHaveBeenCalledWith(
        '[alley] ambient did not start',
        'sing',
        AMBIENT_URL.sing,
        failure,
      )
      expect(ambient.sounding()).toBeNull()
      expect(ambient.sourcesStarted()).toBe(0)
    },
  )

  // A context that cannot be made (too many open, a WebView that refuses)
  // throws inside `init`, which rejects the activation. start() used to
  // return early with that promise unhandled, and on the native build an
  // unhandled rejection is what index.html's watchdog paints as "Mercury
  // Pitch did not start" -- over an app that is running.
  it('handles a context that could not be made, and says so', async () => {
    vi.useRealTimers()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const unhandled: unknown[] = []
    const onUnhandled = (reason: unknown) => void unhandled.push(reason)
    process.on('unhandledRejection', onUnhandled)
    const refused = new Error('The AudioContext could not be created')
    try {
      const ambient = createAlleyAmbient({
        createContext: () => {
          throw refused
        },
        load: async () => read(),
        // The app's own activation, so the rejection has the app's shape.
        activate: (target) => activateAudioPlayback(target),
      })
      expect(() => ambient.start('sing', 600)).not.toThrow()
      await new Promise((resolve) => setTimeout(resolve, 20))
      expect(unhandled).toEqual([])
      expect(warn).toHaveBeenCalledWith(
        '[alley] ambient did not start',
        'sing',
        AMBIENT_URL.sing,
        refused,
      )
      expect(ambient.sounding()).toBeNull()
    } finally {
      process.off('unhandledRejection', onUnhandled)
    }
  })
})

describe("the ambient's report to the device's audio diagnostics", () => {
  type Reported = [string, Record<string, unknown>, boolean]
  let log: Call[]
  let events: Reported[]

  const make = (ctx: ReturnType<typeof fakeContext>, status = 0) =>
    createAlleyAmbient({
      createContext: () => ctx as unknown as AudioContext,
      load: async () => read(status),
      activate: async (target: AmbientActivation) => {
        await target.init()
        await target.resume()
      },
      report: (event, detail = {}, failed = false) =>
        void events.push([event, detail, failed]),
    })

  const named = (event: string) => events.filter(([e]) => e === event)

  beforeEach(() => {
    vi.useFakeTimers()
    log = []
    events = []
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('reports each step of a start, with the facts that tell them apart', async () => {
    const ctx = fakeContext(log)
    const ambient = make(ctx)
    expect(ambient.context()).toBeNull()
    ambient.start('sing', 600)
    await settle()

    expect(events[0]?.[0]).toBe('context')
    expect(events[0]?.[1]).toMatchObject({ state: 'suspended' })
    expect(named('activated')).toEqual([
      ['activated', { state: 'running', currentTime: 1 }, false],
    ])
    // The iOS shape, said out loud: status 0, not ok, and every byte.
    expect(named('fetched')).toEqual([
      [
        'fetched',
        {
          url: AMBIENT_URL.sing,
          status: 0,
          ok: false,
          bytes: 8,
          ms: expect.any(Number),
        },
        false,
      ],
    ])
    expect(named('decoded')).toHaveLength(1)
    expect(named('decoded')[0]?.[1]).toMatchObject({ url: AMBIENT_URL.sing })
    expect(events.at(-1)).toEqual([
      'started',
      { kind: 'sing', state: 'running', currentTime: 1 },
      false,
    ])
    expect(events.some(([, , failed]) => failed)).toBe(false)
    expect(ambient.context()).toEqual({
      state: 'running',
      sampleRate: undefined,
      currentTime: 1,
    })
  })

  it('reports the stop, an interruption, the stale context and its retirement', async () => {
    const contexts: Array<ReturnType<typeof fakeContext>> = []
    const ambient = createAlleyAmbient({
      createContext: () => {
        const made = fakeContext(log)
        contexts.push(made)
        return made as unknown as AudioContext
      },
      load: async () => read(),
      activate: async (target: AmbientActivation) => {
        await target.init()
        await target.resume()
      },
      report: (event, detail = {}, failed = false) =>
        void events.push([event, detail, failed]),
    })
    ambient.start('ear', 600)
    await settle()
    const stopped = ambient.stop(120)
    vi.advanceTimersByTime(120 + RELEASE_SLACK_MS)
    await stopped
    expect(named('stopped')).toEqual([['stopped', { kind: 'ear' }, false]])

    contexts[0]?.interrupt()
    expect(named('statechange').at(-1)?.[1]).toEqual({ state: 'interrupted' })
    expect(named('stale')).toEqual([
      ['stale', { reason: 'interrupted' }, false],
    ])
    ambient.start('sing', 600)
    expect(named('retired')).toEqual([
      ['retired', { state: 'interrupted' }, false],
    ])
    expect(named('context')).toHaveLength(2)
  })

  it('reports a context the tap could not start as a failure', async () => {
    const ctx = fakeContext(log)
    // A resume inside the tap that leaves it suspended: the source still
    // starts, on a clock that does not move, and nothing is heard.
    ctx.resume = vi.fn(async () => undefined)
    make(ctx).start('sing', 600)
    await settle()
    expect(named('stale')).toEqual([
      [
        'stale',
        { reason: 'not running after resume', state: 'suspended' },
        true,
      ],
    ])
  })

  it('reports a failed decode as a failure, with the error', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const ctx = fakeContext(log)
    const broken = new DOMException(
      'Unable to decode audio data',
      'EncodingError',
    )
    ctx.decodeAudioData = vi.fn(async () => {
      throw broken
    })
    make(ctx).start('sing', 600)
    await settle()
    expect(named('decode-failed')).toEqual([
      [
        'decode-failed',
        { url: AMBIENT_URL.sing, error: broken, ms: expect.any(Number) },
        true,
      ],
    ])
    expect(named('started')).toEqual([])
  })

  it('reports a context that could not be made', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const refused = new Error('too many contexts')
    const ambient = createAlleyAmbient({
      createContext: () => {
        throw refused
      },
      load: async () => read(),
      activate: async (target: AmbientActivation) => {
        await target.init()
      },
      report: (event, detail = {}, failed = false) =>
        void events.push([event, detail, failed]),
    })
    ambient.start('sing', 600)
    await settle()
    expect(events).toEqual([['context-failed', { error: refused }, true]])
  })
})
