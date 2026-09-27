import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DownloadProgress } from './fetch-progress'
import { aggregateProgress, fetchArrayBufferWithProgress, formatBytes, } from './fetch-progress'

/** A Response whose body streams `chunks` one read at a time. */
function streamingResponse(
  chunks: readonly number[],
  headers: Record<string, string> = {},
): Response {
  let i = 0
  const body = {
    getReader: () => ({
      read: () =>
        Promise.resolve(
          i < chunks.length
            ? { done: false, value: new Uint8Array(chunks[i++]) }
            : { done: true, value: undefined },
        ),
      releaseLock: () => {},
    }),
  }
  return {
    ok: true,
    status: 200,
    headers: new Headers(headers),
    body,
  } as unknown as Response
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('fetchArrayBufferWithProgress', () => {
  it('reports bytes as chunks arrive, not just at the end', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          streamingResponse([100, 300, 600], { 'content-length': '1000' }),
        ),
      ),
    )
    const seen: DownloadProgress[] = []
    const buf = await fetchArrayBufferWithProgress('https://x/stem.mp3', {
      onProgress: (p) => seen.push(p),
    })

    expect(buf.byteLength).toBe(1000)
    // The regression this file exists for: a two-stem count-based bar could
    // only ever read 0 / 50 / 100. Bytes give us the middle.
    expect(seen.map((p) => p.received)).toEqual([0, 100, 400, 1000, 1000])
    expect(seen[2].fraction).toBeCloseTo(0.4)
  })

  it('fires once before the first chunk so "connecting" can end at the headers', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(streamingResponse([50], { 'content-length': '50' })),
      ),
    )
    const seen: DownloadProgress[] = []
    await fetchArrayBufferWithProgress('https://x/a.mp3', {
      onProgress: (p) => seen.push(p),
    })
    expect(seen[0]).toEqual({ received: 0, total: 50, fraction: 0 })
  })

  it('reports an unknown total as null rather than guessing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(streamingResponse([10, 10]))),
    )
    const seen: DownloadProgress[] = []
    await fetchArrayBufferWithProgress('https://x/a.mp3', {
      onProgress: (p) => seen.push(p),
    })
    expect(seen[1]).toEqual({ received: 10, total: null, fraction: null })
  })

  it('never reports past 100% when the declared length was the compressed size', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          // Declared 100, delivers 250 — what a gzipped response looks like.
          streamingResponse([250], { 'content-length': '100' }),
        ),
      ),
    )
    const seen: DownloadProgress[] = []
    await fetchArrayBufferWithProgress('https://x/a.mp3', {
      onProgress: (p) => seen.push(p),
    })
    expect(seen.every((p) => (p.fraction ?? 0) <= 1)).toBe(true)
  })

  it('falls back to arrayBuffer when the response has no readable body', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers(),
          body: null,
          arrayBuffer: () => Promise.resolve(new ArrayBuffer(64)),
        } as unknown as Response),
      ),
    )
    const seen: DownloadProgress[] = []
    const buf = await fetchArrayBufferWithProgress('https://x/a.mp3', {
      onProgress: (p) => seen.push(p),
    })
    expect(buf.byteLength).toBe(64)
    expect(seen.at(-1)).toEqual({ received: 64, total: 64, fraction: 1 })
  })

  it('throws with the status on a failed response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 404,
          headers: new Headers(),
          body: null,
        } as unknown as Response),
      ),
    )
    await expect(
      fetchArrayBufferWithProgress('https://x/gone.mp3'),
    ).rejects.toThrow('HTTP 404')
  })

  // K2 (karaoke audit): a file packaged inside the iOS app, fetched from the
  // WebView's own scheme, answers status 0 and `ok: false` WITH its whole
  // body. The bundled example songs are exactly that, and every one of them
  // was refused here before a byte was read.
  it('reads a packaged file that answers status 0 with its body (iOS)', async () => {
    const packaged = streamingResponse([120, 80])
    Object.assign(packaged, { ok: false, status: 0 })
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(packaged)),
    )
    const buf = await fetchArrayBufferWithProgress(
      '/karaoke/examples/goodbye-to-spring/vocal.m4a',
    )
    expect(buf.byteLength).toBe(200)
  })

  it('reads a status-0 file that has no stream to read, too', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 0,
          headers: new Headers(),
          body: null,
          arrayBuffer: () => Promise.resolve(new ArrayBuffer(48)),
        } as unknown as Response),
      ),
    )
    const buf = await fetchArrayBufferWithProgress('/karaoke/a.m4a')
    expect(buf.byteLength).toBe(48)
  })

  it('refuses a status-0 answer with nothing in it, naming the file', async () => {
    // An opaque cross-origin response also says 0; its body is empty. That
    // is a failure, and "the file is not there" has to be told apart from
    // "the file will not decode" in a device report.
    const opaque = streamingResponse([])
    Object.assign(opaque, { ok: false, status: 0 })
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(opaque)),
    )
    await expect(
      fetchArrayBufferWithProgress('/karaoke/missing.m4a'),
    ).rejects.toThrow('/karaoke/missing.m4a')
  })
})

describe('aggregateProgress', () => {
  const sized = (received: number, total: number): DownloadProgress => ({
    received,
    total,
    fraction: received / total,
  })

  it('weights by bytes so a big stem is not worth the same as a small one', () => {
    // 1 MB of a 1 MB vocal done, none of a 9 MB instrumental: 10%, not 50%.
    const agg = aggregateProgress([sized(1000, 1000), sized(0, 9000)])
    expect(agg.fraction).toBeCloseTo(0.1)
    expect(agg.total).toBe(10000)
  })

  it('never exceeds 1', () => {
    expect(aggregateProgress([sized(2000, 1000)]).fraction).toBe(1)
  })

  it('averages fractions when any part has no declared size', () => {
    const agg = aggregateProgress([
      sized(1000, 1000),
      { received: 40, total: null, fraction: null },
    ])
    expect(agg.fraction).toBeCloseTo(0.5)
    // Reported as unknown, so the UI shows a byte count instead of "x of y".
    expect(agg.total).toBeNull()
  })

  it('rises monotonically as a seeded-but-unstarted part begins', () => {
    // Seeding every url up front is what stops the bar jumping backwards when
    // the extras batch starts fetching.
    const before = aggregateProgress([
      sized(1000, 1000),
      { received: 0, total: null, fraction: null },
    ])
    const after = aggregateProgress([sized(1000, 1000), sized(500, 1000)])
    expect(after.fraction).toBeGreaterThan(before.fraction)
  })

  it('is zero for an empty load rather than NaN', () => {
    expect(aggregateProgress([])).toEqual({
      fraction: 0,
      received: 0,
      total: null,
    })
  })
})

describe('formatBytes', () => {
  it('reads as a person would say it', () => {
    expect(formatBytes(0)).toBe('0 MB')
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(4096)).toBe('4 KB')
    expect(formatBytes(11.8 * 1024 * 1024)).toBe('11.8 MB')
  })

  it('does not print NaN for a missing size', () => {
    expect(formatBytes(Number.NaN)).toBe('0 MB')
    expect(formatBytes(-1)).toBe('0 MB')
  })
})
