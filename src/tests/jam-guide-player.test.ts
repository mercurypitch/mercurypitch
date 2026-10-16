// The guide vocal plays through Web Audio so a TV's single media
// pipeline can never pause the backing track when it starts. These
// cover the player's clock math, the decode cache, the races a slow TV
// decode makes likely (mute-before-decode-finishes, song-change-mid-
// decode), and the cross-fade: a buffer source cannot be seeked, so
// following the transport means replacing the source, and splicing two
// waveforms together at full scale is a click every 120ms of drift.

import { describe, expect, it, vi } from 'vitest'
import { createJamGuidePlayer } from '@/lib/jam/jam-guide-player'

interface FakeGain {
  value: number
  connected: boolean
  ramps: { to: number; at: number }[]
  connectedTo: unknown[]
}

interface FakeSource {
  buffer: AudioBuffer | null
  onended: (() => void) | null
  started: { when: number; offset: number } | null
  stopped: boolean
  /** Context time the stop was scheduled for; null means "right now". */
  stoppedAt: number | null
  connectedTo: unknown
}

function makeFakeContext(opts: { decodedDuration?: number } = {}) {
  const duration = opts.decodedDuration ?? 180
  const sources: FakeSource[] = []
  const gains: FakeGain[] = []
  const ctx = {
    currentTime: 0,
    destination: { kind: 'destination' },
    decodeAudioData: vi.fn(
      async (_bytes: ArrayBuffer) => ({ duration }) as AudioBuffer,
    ),
    createGain() {
      const state: FakeGain = {
        value: 1,
        connected: false,
        ramps: [],
        connectedTo: [],
      }
      gains.push(state)
      // A ramp leaves `value` at its destination: enough for these tests,
      // which care that the fade was SCHEDULED and where it was headed.
      const ramp = (to: number, at: number) => {
        state.ramps.push({ to, at })
        state.value = to
      }
      return {
        gain: {
          get value() {
            return state.value
          },
          set value(v: number) {
            state.value = v
          },
          cancelScheduledValues: () => undefined,
          setValueAtTime: (v: number) => {
            state.value = v
          },
          linearRampToValueAtTime: ramp,
          exponentialRampToValueAtTime: ramp,
          setTargetAtTime: (v: number) => {
            state.value = v
          },
        },
        connect: (target: unknown) => {
          state.connected = true
          state.connectedTo.push(target)
        },
        disconnect: () => {
          state.connected = false
        },
      }
    },
    createBufferSource() {
      const src: FakeSource = {
        buffer: null,
        onended: null,
        started: null,
        stopped: false,
        stoppedAt: null,
        connectedTo: null,
      }
      sources.push(src)
      return {
        set buffer(b: AudioBuffer | null) {
          src.buffer = b
        },
        get buffer() {
          return src.buffer
        },
        set onended(fn: (() => void) | null) {
          src.onended = fn
        },
        get onended() {
          return src.onended
        },
        connect: (node: unknown) => {
          src.connectedTo = node
        },
        disconnect: () => {
          src.connectedTo = null
        },
        start: (when: number, offset: number) => {
          src.started = { when, offset }
        },
        stop: (when?: number) => {
          src.stopped = true
          src.stoppedAt = when ?? null
        },
      }
    },
  }
  return {
    ctx: ctx as unknown as AudioContext,
    raw: ctx,
    sources,
    gains,
  }
}

const bytes = () => new ArrayBuffer(16)

function makePlayer(fake: ReturnType<typeof makeFakeContext>) {
  const fetches: string[] = []
  const player = createJamGuidePlayer({
    context: () => fake.ctx,
    fetchArrayBuffer: async (url) => {
      fetches.push(url)
      return bytes()
    },
  })
  return { player, fetches }
}

describe('jam guide player', () => {
  it('plays through the room’s key graph when it has one', async () => {
    const fake = makeFakeContext()
    const keyGraphInput = { kind: 'key graph' }
    const player = createJamGuidePlayer({
      context: () => fake.ctx,
      fetchArrayBuffer: async () => bytes(),
      output: () => keyGraphInput as unknown as AudioNode,
    })
    await player.load('blob:song-a')

    player.start(0, 0.5)

    expect(fake.gains[0]!.connectedTo).toEqual([keyGraphInput])
  })

  it('plays straight to the speakers without one', async () => {
    const fake = makeFakeContext()
    const { player } = makePlayer(fake)
    await player.load('blob:song-a')

    player.start(0, 0.5)

    expect(fake.gains[0]!.connectedTo).toEqual([fake.raw.destination])
  })

  it('plays straight to the speakers when the key graph cannot be had', async () => {
    const fake = makeFakeContext()
    const player = createJamGuidePlayer({
      context: () => fake.ctx,
      fetchArrayBuffer: async () => bytes(),
      output: () => {
        throw new Error('worklet node refused')
      },
    })
    await player.load('blob:song-a')

    expect(player.start(0, 0.5)).toBe(true)

    expect(fake.gains[0]!.connectedTo).toEqual([fake.raw.destination])
  })

  it('decodes once per url and reuses the cache', async () => {
    const fake = makeFakeContext()
    const { player, fetches } = makePlayer(fake)

    expect(await player.load('blob:song-a')).toBe(true)
    expect(await player.load('blob:song-a')).toBe(true)
    expect(fetches).toEqual(['blob:song-a'])
    expect(player.loadedUrl()).toBe('blob:song-a')
  })

  it('shares one in-flight decode between overlapping loads', async () => {
    const fake = makeFakeContext()
    let resolveFetch: ((b: ArrayBuffer) => void) | null = null
    const player = createJamGuidePlayer({
      context: () => fake.ctx,
      fetchArrayBuffer: () =>
        new Promise<ArrayBuffer>((resolve) => {
          resolveFetch = resolve
        }),
    })

    const first = player.load('blob:song-a')
    const second = player.load('blob:song-a')
    resolveFetch!(bytes())
    expect(await Promise.all([first, second])).toEqual([true, true])
    expect(fake.raw.decodeAudioData).toHaveBeenCalledTimes(1)
  })

  it('starts at the offset and tracks position on the context clock', async () => {
    const fake = makeFakeContext()
    const { player } = makePlayer(fake)
    await player.load('blob:song-a')

    fake.raw.currentTime = 10
    expect(player.start(42.5, 0.5)).toBe(true)
    expect(player.playing()).toBe(true)
    expect(fake.sources[0]!.started).toEqual({ when: 0, offset: 42.5 })
    expect(fake.gains[0]!.value).toBe(0.5)

    fake.raw.currentTime = 13
    expect(player.positionSec()).toBeCloseTo(45.5)
  })

  it('restart replaces the source and an omitted volume keeps the last one', async () => {
    const fake = makeFakeContext()
    const { player } = makePlayer(fake)
    await player.load('blob:song-a')

    player.start(10, 0.7)
    player.start(20)
    expect(fake.sources[0]!.stopped).toBe(true)
    expect(fake.sources[1]!.started?.offset).toBe(20)
    // One master that carries the level, plus a gain per source to fade
    // on. The level itself never moves across a restart.
    expect(fake.gains[0]!.value).toBe(0.7)
    expect(fake.gains).toHaveLength(3)
  })

  it('cross-fades a restart instead of splicing waveforms', async () => {
    const fake = makeFakeContext()
    const { player } = makePlayer(fake)
    await player.load('blob:song-a')

    fake.raw.currentTime = 4
    player.start(10, 0.7)
    const first = fake.gains[1]!
    expect(first.ramps).toEqual([{ to: 1, at: 4.015 }])

    fake.raw.currentTime = 9
    player.start(20)
    // The outgoing source fades to silence and is stopped only once it
    // is there -- a stop at `currentTime` would be the click itself.
    expect(first.ramps.at(-1)).toEqual({ to: 0, at: 9.015 })
    expect(fake.sources[0]!.stoppedAt).toBeCloseTo(9.015)
    expect(fake.gains[2]!.ramps).toEqual([{ to: 1, at: 9.015 }])
  })

  it('fades out on stop rather than cutting', async () => {
    const fake = makeFakeContext()
    const { player } = makePlayer(fake)
    await player.load('blob:song-a')

    fake.raw.currentTime = 2
    player.start(10, 0.7)
    player.stop()
    expect(fake.gains[1]!.ramps.at(-1)).toEqual({ to: 0, at: 2.04 })
    expect(fake.sources[0]!.stoppedAt).toBeCloseTo(2.04)
  })

  it('ramps the level instead of stepping it', async () => {
    const fake = makeFakeContext()
    const { player } = makePlayer(fake)
    await player.load('blob:song-a')

    fake.raw.currentTime = 1
    player.start(0, 0.2)
    player.setVolume(0.9)
    expect(fake.gains[0]!.ramps.at(-1)).toEqual({ to: 0.9, at: 1.02 })
  })

  it('a start past the end leaves what is playing alone', async () => {
    const fake = makeFakeContext({ decodedDuration: 60 })
    const { player } = makePlayer(fake)
    await player.load('blob:song-a')

    player.start(10, 0.5)
    // The song outlasts the vocal stem. Killing the guide because the
    // follow effect asked for a point past its end would cut it short
    // of its own last note.
    expect(player.start(75)).toBe(false)
    expect(player.playing()).toBe(true)
    expect(fake.sources[0]!.stopped).toBe(false)
  })

  it('refuses to start past the end of the stem', async () => {
    const fake = makeFakeContext({ decodedDuration: 60 })
    const { player } = makePlayer(fake)
    await player.load('blob:song-a')

    expect(player.start(75, 0.5)).toBe(false)
    expect(player.playing()).toBe(false)
  })

  it('stop() silences and clears the position', async () => {
    const fake = makeFakeContext()
    const { player } = makePlayer(fake)
    await player.load('blob:song-a')
    player.start(5, 0.5)

    player.stop()
    expect(player.playing()).toBe(false)
    expect(player.positionSec()).toBeNull()
    expect(fake.sources[0]!.stopped).toBe(true)
  })

  it('a natural end reports as stopped', async () => {
    const fake = makeFakeContext()
    const { player } = makePlayer(fake)
    await player.load('blob:song-a')
    player.start(5, 0.5)

    fake.sources[0]!.onended?.()
    expect(player.playing()).toBe(false)
  })

  it('loading a different song stops playback and refetches', async () => {
    const fake = makeFakeContext()
    const { player, fetches } = makePlayer(fake)
    await player.load('blob:song-a')
    player.start(5, 0.5)

    expect(await player.load('blob:song-b')).toBe(true)
    expect(player.playing()).toBe(false)
    expect(fetches).toEqual(['blob:song-a', 'blob:song-b'])
    expect(player.loadedUrl()).toBe('blob:song-b')
  })

  it('a decode that loses the race to a newer song is discarded', async () => {
    const fake = makeFakeContext()
    const pending = new Map<string, (b: ArrayBuffer) => void>()
    const player = createJamGuidePlayer({
      context: () => fake.ctx,
      fetchArrayBuffer: (url) =>
        new Promise<ArrayBuffer>((resolve) => {
          pending.set(url, resolve)
        }),
    })

    const slow = player.load('blob:song-a')
    const fast = player.load('blob:song-b')
    pending.get('blob:song-b')!(bytes())
    expect(await fast).toBe(true)
    // Song A's bytes arrive after B replaced it: the stale decode loses.
    pending.get('blob:song-a')!(bytes())
    expect(await slow).toBe(false)
    expect(player.loadedUrl()).toBe('blob:song-b')
  })

  it('a failed fetch reports false and a retry can succeed', async () => {
    const fake = makeFakeContext()
    let failNext = true
    const player = createJamGuidePlayer({
      context: () => fake.ctx,
      fetchArrayBuffer: async () => {
        if (failNext) {
          failNext = false
          throw new Error('offline')
        }
        return bytes()
      },
    })

    expect(await player.load('blob:song-a')).toBe(false)
    expect(await player.load('blob:song-a')).toBe(true)
  })

  it('does nothing without a context yet', async () => {
    const player = createJamGuidePlayer({
      context: () => null,
      fetchArrayBuffer: async () => bytes(),
    })
    expect(await player.load('blob:song-a')).toBe(false)
    expect(player.start(0, 0.5)).toBe(false)
    expect(player.positionSec()).toBeNull()
  })

  it('dispose stops playback and refuses further work', async () => {
    const fake = makeFakeContext()
    const { player } = makePlayer(fake)
    await player.load('blob:song-a')
    player.start(5, 0.5)

    player.dispose()
    expect(player.playing()).toBe(false)
    expect(fake.gains[0]!.connected).toBe(false)
    expect(await player.load('blob:song-a')).toBe(false)
    expect(player.start(0, 0.5)).toBe(false)
  })
})
