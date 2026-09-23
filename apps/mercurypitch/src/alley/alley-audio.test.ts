import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AmbientActivation } from './alley-audio'
import { AMBIENT_LEVEL, createAlleyAmbient, GAIN_FLOOR, RELEASE_SLACK_MS, } from './alley-audio'
import { AMBIENT_URL } from './alley-plate'

type Call = [string, ...unknown[]]

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
        return new ArrayBuffer(8)
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
