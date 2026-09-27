// Songbook lifecycle regressions — keep asynchronous takes exclusive and native media readable.
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { MusicalMemoryPlayback } from '../core/musical-memory'
import type { SongbookPlaybackState } from './songbook-playback'
import { createSongbookPlayback } from './songbook-playback'

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

function harness(load?: (url: string, signal: AbortSignal) => Promise<Blob>) {
  const calls: {
    audio: Promise<Blob>
    ended: () => void
    result: ReturnType<typeof deferred<boolean>>
  }[] = []
  const player: MusicalMemoryPlayback = {
    play: vi.fn((audio, ended) => {
      const result = deferred<boolean>()
      const promise = Promise.resolve(audio)
      void promise.catch(() => undefined)
      calls.push({ audio: promise, ended: ended ?? (() => undefined), result })
      return result.promise
    }),
    stop: vi.fn(async () => undefined),
    dispose: vi.fn(),
  }
  const states: SongbookPlaybackState[] = []
  const controller = createSongbookPlayback({
    player,
    assetUrl: (id) => `/games/${id}.mp3`,
    onChange: (state) => states.push(state),
    load,
  })
  return { controller, states, calls, player }
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('songbook audition playback', () => {
  it('does not load until requested and unlocks playback synchronously with the gesture', async () => {
    const load = vi.fn(async () => new Blob(['audio']))
    const { controller, player, states, calls } = harness(load)
    expect(load).not.toHaveBeenCalled()
    expect(player.play).not.toHaveBeenCalled()
    controller.play('first')
    expect(player.play).toHaveBeenCalledOnce()
    expect(load).not.toHaveBeenCalled()
    await calls[0].audio
    calls[0].result.resolve(true)
    await Promise.resolve()
    expect(states.at(-1)).toEqual({ assetId: 'first', phase: 'playing' })
    calls[0].ended()
    expect(states.at(-1)).toEqual({ assetId: null, phase: 'idle' })
  })

  it('aborts a slow previous fetch and ignores its late result and end callback', async () => {
    const signals: AbortSignal[] = []
    const slow = deferred<Blob>()
    const { controller, calls, states } = harness(async (_url, signal) => {
      signals.push(signal)
      return slow.promise
    })
    controller.play('old')
    await Promise.resolve()
    controller.play('new')
    await Promise.resolve()
    expect(signals[0].aborted).toBe(true)
    expect(signals[1].aborted).toBe(false)
    calls[1].result.resolve(true)
    await Promise.resolve()
    calls[0].result.resolve(false)
    calls[0].ended()
    await Promise.resolve()
    expect(states.at(-1)).toEqual({ assetId: 'new', phase: 'playing' })
    slow.resolve(new Blob(['finished']))
  })

  it('keeps a decode failure visible even if the audio adapter ends before resolving false', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const { controller, calls, states } = harness(
      async () => new Blob(['bad codec']),
    )
    controller.play('bad')
    calls[0].ended()
    calls[0].result.resolve(false)
    await Promise.resolve()
    expect(states.at(-1)).toEqual({ assetId: 'bad', phase: 'error' })
    calls[0].ended()
    expect(states.at(-1)?.phase).toBe('error')
  })

  it('aborts a timed-out load before a retry can launch another request', async () => {
    const warning = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined)
    const signals: AbortSignal[] = []
    const slow = deferred<Blob>()
    const { controller, calls, states } = harness(async (_url, signal) => {
      signals.push(signal)
      return slow.promise
    })
    controller.play('slow')
    await Promise.resolve()
    calls[0].result.resolve(false)
    await Promise.resolve()
    expect(signals[0].aborted).toBe(true)
    expect(states.at(-1)?.phase).toBe('error')
    expect(warning).toHaveBeenCalledOnce()
    controller.play('retry')
    await Promise.resolve()
    expect(signals[1].aborted).toBe(false)
    controller.dispose()
    expect(signals[1].aborted).toBe(true)
    slow.resolve(new Blob(['late']))
  })

  it('handles a clip ending before successful startup has settled', async () => {
    const { controller, calls, states } = harness(
      async () => new Blob(['short']),
    )
    controller.play('short')
    calls[0].ended()
    calls[0].result.resolve(true)
    await Promise.resolve()
    expect(states.at(-1)).toEqual({ assetId: null, phase: 'idle' })
  })

  it('stops on backgrounding and cannot resurrect after disposal', async () => {
    const { controller, calls, states, player } = harness(
      async () => new Blob(['audio']),
    )
    controller.play('one')
    controller.stop()
    calls[0].result.resolve(true)
    await Promise.resolve()
    expect(states.at(-1)?.phase).toBe('idle')
    controller.play('two')
    controller.dispose()
    const count = states.length
    calls[1].result.resolve(true)
    calls[1].ended()
    controller.play('three')
    await Promise.resolve()
    expect(states).toHaveLength(count)
    expect(player.play).toHaveBeenCalledTimes(2)
    expect(player.dispose).toHaveBeenCalledOnce()
    expect(player.stop).toHaveBeenCalledTimes(2)
  })

  it('accepts non-empty iOS status-zero packaged media', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 0,
        arrayBuffer: async () => new ArrayBuffer(16),
      })),
    )
    const { controller, calls } = harness()
    controller.play('native')
    expect((await calls[0].audio).size).toBe(16)
  })

  it.each([
    { status: 0, size: 0, message: 'Asset was empty' },
    { status: 404, size: 16, message: 'Asset request failed' },
    { status: 200, size: 1_000_001, message: 'delivery budget' },
  ])(
    'rejects invalid packaged media: $status/$size',
    async ({ status, size, message }) => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => ({
          ok: status === 200,
          status,
          arrayBuffer: async () => new ArrayBuffer(size),
        })),
      )
      const { controller, calls } = harness()
      controller.play('bad')
      await expect(calls[0].audio).rejects.toThrow(message)
    },
  )
})
