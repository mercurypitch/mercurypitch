// ============================================================
// A result band: decoded ahead, then only copied at the result
// ============================================================

import { afterEach, describe, expect, it, vi } from 'vitest'
import { createResultBand } from './result-band'

class FakeBitmap {
  closed = false
  constructor(
    readonly width: number,
    readonly height: number,
  ) {}
  close(): void {
    this.closed = true
  }
}

/** fetch and createImageBitmap as a browser has them: every file is 1290 x 1560. */
function browserWithBitmaps() {
  const made: FakeBitmap[] = []
  const createImageBitmap = vi.fn(() => {
    const bitmap = new FakeBitmap(1290, 1560)
    made.push(bitmap)
    return Promise.resolve(bitmap)
  })
  vi.stubGlobal('ImageBitmap', FakeBitmap)
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve({ ok: true, blob: () => Promise.resolve(new Blob()) }),
    ),
  )
  vi.stubGlobal('createImageBitmap', createImageBitmap)
  return { createImageBitmap, made }
}

/** A canvas that records its resizes and what is drawn into it. */
function recordingCanvas() {
  const log: string[] = []
  const draws: { source: unknown; args: number[] }[] = []
  let width = 300
  let height = 150
  const ctx = {
    clearRect: () => log.push('clear'),
    drawImage: (source: unknown, ...args: number[]) => {
      log.push('draw')
      draws.push({ source, args })
    },
  }
  const canvas = {
    get width() {
      return width
    },
    set width(next: number) {
      log.push(`width ${next}`)
      width = next
    },
    get height() {
      return height
    },
    set height(next: number) {
      log.push(`height ${next}`)
      height = next
    },
    getContext: () => ({ ...ctx, canvas }),
  }
  return { canvas: canvas as unknown as HTMLCanvasElement, log, draws }
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))
const noImg = (): Promise<HTMLImageElement> =>
  Promise.reject(new Error('the <img> loader is not wanted here'))

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('a result band', () => {
  it('is decoded and sized before the result, so the result only copies', async () => {
    const { createImageBitmap, made } = browserWithBitmaps()
    const { canvas, log, draws } = recordingCanvas()
    const band = createResultBand(
      () => canvas,
      () => '/lit.webp',
      noImg,
    )

    band.prepare()
    await flush()
    expect(createImageBitmap).toHaveBeenCalledOnce()
    expect(log).toEqual(['width 1290', 'height 1560'])

    log.length = 0
    await band.paint((width) => [
      [0, 100],
      [500, width + 40],
    ])

    // No resize (a resize would clear and reallocate it), no second decode:
    // the result's frame clears and copies the take's columns, nothing else.
    expect(log).toEqual(['clear', 'draw', 'draw'])
    expect(createImageBitmap).toHaveBeenCalledOnce()
    expect(draws).toEqual([
      { source: made[0], args: [0, 0, 100, 1560, 0, 0, 100, 1560] },
      { source: made[0], args: [500, 0, 830, 1560, 500, 0, 830, 1560] },
    ])
  })

  it('decodes on the result itself when nobody asked ahead', async () => {
    const { createImageBitmap } = browserWithBitmaps()
    const { canvas, log } = recordingCanvas()
    const band = createResultBand(
      () => canvas,
      () => '/lit.webp',
      noImg,
    )

    await band.paint(() => [[10, 20]])

    expect(createImageBitmap).toHaveBeenCalledOnce()
    expect(log).toEqual(['width 1290', 'height 1560', 'clear', 'draw'])
  })

  it('skips an empty column and paints a fresh band each time', async () => {
    browserWithBitmaps()
    const { canvas, log } = recordingCanvas()
    const band = createResultBand(
      () => canvas,
      () => '/lit.webp',
      noImg,
    )
    band.prepare()
    await flush()
    log.length = 0

    await band.paint(() => [
      [40, 40],
      [60, 50],
    ])
    await band.paint(() => [[0, 1]])

    expect(log).toEqual(['clear', 'clear', 'draw'])
  })

  it('paints nothing when its picture will not load', async () => {
    vi.stubGlobal('createImageBitmap', undefined)
    const { canvas, log } = recordingCanvas()
    const band = createResultBand(
      () => canvas,
      () => '/lit.webp',
      noImg,
    )

    band.prepare()
    await band.paint(() => [[0, 100]])

    expect(log).toEqual([])
  })

  it('lets its bitmap go when the room leaves', async () => {
    const { made } = browserWithBitmaps()
    const { canvas } = recordingCanvas()
    const band = createResultBand(
      () => canvas,
      () => '/lit.webp',
      noImg,
    )
    band.prepare()
    await flush()

    band.release()
    await flush()

    expect(made).toHaveLength(1)
    expect(made[0]?.closed).toBe(true)
  })
})
