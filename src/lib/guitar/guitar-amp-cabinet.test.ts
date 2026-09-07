// Guitar cabinet loading tests verify original-byte integrity, lazy sharing and explicit recovery.
import { webcrypto } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const original = new Uint8Array(
  readFileSync(resolve('src/assets/audio/guitar/cookie-monster.wav')),
).buffer
const buffer = (rate = 48_000): AudioBuffer =>
  ({
    numberOfChannels: 1,
    sampleRate: rate,
    duration: 1.19625,
  }) as AudioBuffer

function context(rate = 48_000) {
  const decodeAudioData = vi.fn(async (_data: ArrayBuffer) => buffer(rate))
  return {
    decodeAudioData,
    context: {
      sampleRate: rate,
      decodeAudioData,
    } as unknown as BaseAudioContext,
  }
}
beforeEach(() => {
  vi.resetModules()
  vi.stubGlobal('crypto', webcrypto)
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('guitar cabinet ownership', () => {
  it('does not fetch on import or subscription and shares exact verified bytes across output rates', async () => {
    const fetcher = vi.fn(async () => new Response(original.slice(0)))
    vi.stubGlobal('fetch', fetcher)
    const cabinet = await import('./guitar-amp-cabinet')
    const listener = vi.fn()
    const unsubscribe = cabinet.subscribeGuitarAmpCabinetStatus(listener)
    expect(cabinet.getGuitarAmpCabinetStatus()).toBe('idle')
    expect(fetcher).not.toHaveBeenCalled()
    const first = context()
    const second = context()
    const alternate = context(44_100)
    const a = cabinet.loadGuitarAmpCabinet(first.context)
    const b = cabinet.loadGuitarAmpCabinet(second.context)
    expect(a).toBe(b)
    const [ready] = await Promise.all([
      a,
      b,
      cabinet.loadGuitarAmpCabinet(alternate.context),
    ])
    expect(ready.sampleRate).toBe(48_000)
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(first.decodeAudioData).toHaveBeenCalledTimes(1)
    expect(second.decodeAudioData).not.toHaveBeenCalled()
    expect(alternate.decodeAudioData).toHaveBeenCalledTimes(1)
    expect(first.decodeAudioData.mock.calls[0]?.[0]).toEqual(original)
    expect(cabinet.getGuitarAmpCabinetStatus()).toBe('ready')
    expect(listener).toHaveBeenCalledWith('loading')
    expect(listener).toHaveBeenCalledWith('ready')
    unsubscribe()
  })

  it('rejects a same-sized changed IR before decoding rather than silently changing the audition', async () => {
    const altered = new Uint8Array(original.slice(0))
    altered[200] ^= 1
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(altered)),
    )
    const cabinet = await import('./guitar-amp-cabinet')
    const decoder = context()
    await expect(cabinet.loadGuitarAmpCabinet(decoder.context)).rejects.toThrow(
      'checksum',
    )
    expect(decoder.decodeAudioData).not.toHaveBeenCalled()
    expect(cabinet.getGuitarAmpCabinetStatus()).toBe('error')
  })

  it('rejects truncated bytes and never retries failed requests until explicitly asked', async () => {
    const fetcher = vi.fn(async () => new Response(original.slice(0, 100)))
    vi.stubGlobal('fetch', fetcher)
    const cabinet = await import('./guitar-amp-cabinet')
    const decoder = context()
    await expect(cabinet.loadGuitarAmpCabinet(decoder.context)).rejects.toThrow(
      'size',
    )
    await expect(cabinet.loadGuitarAmpCabinet(decoder.context)).rejects.toThrow(
      'size',
    )
    expect(fetcher).toHaveBeenCalledTimes(1)
    fetcher.mockImplementation(async () => new Response(original.slice(0)))
    cabinet.retryGuitarAmpCabinet()
    expect(cabinet.getGuitarAmpCabinetStatus()).toBe('idle')
    expect(fetcher).toHaveBeenCalledTimes(1)
    await expect(
      cabinet.loadGuitarAmpCabinet(decoder.context),
    ).resolves.toMatchObject({ sampleRate: 48_000 })
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('rejects a wrong decoded rate or truncated kernel instead of normalizing it into acceptance', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(original.slice(0))),
    )
    const cabinet = await import('./guitar-amp-cabinet')
    const decoder = context()
    decoder.decodeAudioData.mockResolvedValue({
      ...buffer(44_100),
      duration: 0.1,
    } as AudioBuffer)
    await expect(cabinet.loadGuitarAmpCabinet(decoder.context)).rejects.toThrow(
      'format',
    )
    expect(cabinet.getGuitarAmpCabinetStatus()).toBe('error')
  })

  it('delivers retry to every failed owner before nested loading notifications', async () => {
    const fetcher = vi.fn(async () => new Response(null, { status: 503 }))
    vi.stubGlobal('fetch', fetcher)
    const cabinet = await import('./guitar-amp-cabinet')
    const first = context()
    const second = context()
    await expect(cabinet.loadGuitarAmpCabinet(first.context)).rejects.toThrow()
    fetcher.mockImplementation(async () => new Response(original.slice(0)))
    const pending: Promise<AudioBuffer>[] = []
    const seen = [[], [], []] as string[][]
    const unsubscribes = [first, second].map((owner, index) =>
      cabinet.subscribeGuitarAmpCabinetStatus((next) => {
        seen[index].push(next)
        if (next === 'idle')
          pending.push(cabinet.loadGuitarAmpCabinet(owner.context))
      }),
    )
    unsubscribes.push(
      cabinet.subscribeGuitarAmpCabinetStatus((next) => seen[2].push(next)),
    )
    cabinet.retryGuitarAmpCabinet()
    expect(pending).toHaveLength(2)
    expect(pending[0]).toBe(pending[1])
    await Promise.all(pending)
    expect(seen).toEqual(
      Array.from({ length: 3 }, () => ['idle', 'loading', 'ready']),
    )
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(second.decodeAudioData).not.toHaveBeenCalled()
    for (const unsubscribe of unsubscribes) unsubscribe()
  })

  it('aborts a stalled download after ten seconds and removes its timeout', async () => {
    vi.useFakeTimers()
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url, options: RequestInit) =>
          new Promise((_resolve, reject) => {
            options.signal?.addEventListener(
              'abort',
              () => reject(new Error('aborted')),
              { once: true },
            )
          }),
      ),
    )
    const cabinet = await import('./guitar-amp-cabinet')
    const pending = cabinet.loadGuitarAmpCabinet(context().context)
    const assertion = expect(pending).rejects.toThrow('aborted')
    await vi.advanceTimersByTimeAsync(10_000)
    await assertion
    expect(cabinet.getGuitarAmpCabinetStatus()).toBe('error')
    expect(vi.getTimerCount()).toBe(0)
  })
})
