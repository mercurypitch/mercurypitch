// The guide vocal plays through Web Audio so a TV's single media
// pipeline can never pause the backing track when it starts. These
// cover the player's clock math, the decode cache, and the races a
// slow TV decode makes likely: mute-before-decode-finishes and
// song-change-mid-decode.

import { describe, expect, it, vi } from 'vitest'
import { createJamGuidePlayer } from '@/lib/jam/jam-guide-player'

interface FakeSource {
  buffer: AudioBuffer | null
  onended: (() => void) | null
  started: { when: number; offset: number } | null
  stopped: boolean
  connectedTo: unknown
}

function makeFakeContext(opts: { decodedDuration?: number } = {}) {
  const duration = opts.decodedDuration ?? 180
  const sources: FakeSource[] = []
  const gains: { value: number; connected: boolean }[] = []
  const ctx = {
    currentTime: 0,
    destination: { kind: 'destination' },
    decodeAudioData: vi.fn(
      async (_bytes: ArrayBuffer) => ({ duration }) as AudioBuffer,
    ),
    createGain() {
      const state = { value: 1, connected: false }
      gains.push(state)
      return {
        gain: {
          get value() {
            return state.value
          },
          set value(v: number) {
            state.value = v
          },
        },
        connect: () => {
          state.connected = true
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
        stop: () => {
          src.stopped = true
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
    expect(fake.gains).toHaveLength(1)
    expect(fake.gains[0]!.value).toBe(0.7)
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
