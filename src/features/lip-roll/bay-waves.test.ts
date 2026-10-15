// ============================================================
// The waves' canvases: wave 1's is ready before its first strip
// ============================================================
//
// jsdom has no canvas, so every 2d context here is a fake that keeps its
// drawImage calls. The point: the frame that lights wave 1's first strip
// copies that strip and nothing else. Made on that frame, the canvas cost
// a full-plate copy and both pictures' decodes (167 ms at 4x CPU).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { WaveImages } from './bay-waves'
import { createBayWaves } from './bay-waves'

/** One drawImage: the canvas it drew into and its arguments after the picture. */
interface Draw {
  readonly canvas: HTMLCanvasElement
  readonly args: readonly number[]
}

const PICTURE_W = 968
const PICTURE_H = 794

let draws: Draw[] = []

beforeEach(() => {
  draws = []
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
    function (this: HTMLCanvasElement) {
      return {
        canvas: this,
        clearRect: () => undefined,
        drawImage: (_picture: unknown, ...args: number[]) => {
          draws.push({ canvas: this, args })
        },
      } as unknown as CanvasRenderingContext2D
    } as unknown as typeof HTMLCanvasElement.prototype.getContext,
  )
})

afterEach(() => {
  vi.restoreAllMocks()
})

/** A picture of the wave sprites' size. */
function picture(): HTMLImageElement {
  const img = document.createElement('img')
  Object.defineProperty(img, 'naturalWidth', { value: PICTURE_W })
  Object.defineProperty(img, 'naturalHeight', { value: PICTURE_H })
  return img
}

/** Three wave holders and a waves object whose pictures have decoded. */
function bay() {
  const holders = [0, 1, 2].map(() => document.createElement('div'))
  const art: WaveImages = { unlit: picture(), lit: picture() }
  const images = vi.fn(() => Promise.resolve(art))
  const waves = createBayWaves({
    holder: (k) => holders[k] ?? null,
    images,
  })
  return { holders, waves, images }
}

/** The pictures' promise and what it starts have run. */
const settled = (): Promise<void> => new Promise((r) => setTimeout(r, 0))

const isFullPlate = (d: Draw): boolean => d.args.length === 2

describe('the first wave lighting', () => {
  it('has its canvas over wave 1 before the first strip arrives', async () => {
    const { holders, waves } = bay()

    waves.reset()
    await settled()

    expect(holders[0]?.querySelectorAll('canvas[data-lit]')).toHaveLength(1)
    expect(draws.filter(isFullPlate)).toHaveLength(1)
  })

  it('keeps the ready canvas hidden until its first strip, then shows it', async () => {
    const { holders, waves } = bay()
    waves.reset()
    await settled()
    const canvas = holders[0]?.querySelector('canvas')

    expect(canvas?.style.visibility).toBe('hidden')
    waves.paint([{ arch: 0, from: -0.2, to: -0.18 }])
    expect(canvas?.style.visibility).toBe('')
  })

  it('copies one strip and nothing else on wave 1’s first lit strip', async () => {
    const { holders, waves } = bay()
    waves.reset()
    await settled()
    const before = draws.length

    waves.paint([{ arch: 0, from: -0.2, to: -0.18 }])

    const onTheFrame = draws.slice(before)
    expect(onTheFrame).toHaveLength(1)
    expect(onTheFrame.some(isFullPlate)).toBe(false)
    expect(onTheFrame[0]?.args[2]).toBeLessThan(PICTURE_W / 10)
    expect(holders[0]?.querySelectorAll('canvas')).toHaveLength(1)
  })

  it('keeps a ready canvas through another reset, as it is still unlit', async () => {
    const { holders, waves } = bay()
    waves.reset()
    await settled()

    waves.reset()
    await settled()

    expect(holders[0]?.querySelectorAll('canvas')).toHaveLength(1)
    expect(draws.filter(isFullPlate)).toHaveLength(1)
  })

  it('makes a fresh ready canvas once a run has lit the old one', async () => {
    const { holders, waves } = bay()
    waves.reset()
    await settled()
    waves.paint([{ arch: 0, from: -0.2, to: 0 }])

    waves.reset()

    const canvases = holders[0]?.querySelectorAll('canvas')
    expect(canvases).toHaveLength(1)
    expect(draws.filter(isFullPlate)).toHaveLength(2)
  })

  it('removes every canvas on dispose, and makes none after it', async () => {
    const { holders, waves } = bay()
    waves.reset()
    await settled()
    waves.paint([{ arch: 0, from: -0.2, to: 0 }])
    waves.paint([{ arch: 1, from: -1, to: -0.9 }])

    waves.dispose()
    waves.reset()
    waves.paint([{ arch: 2, from: -1, to: -0.9 }])
    await settled()

    for (const holder of holders) {
      expect(holder.querySelectorAll('canvas')).toHaveLength(0)
    }
  })

  it('makes nothing when the room leaves before the pictures decode', async () => {
    const { holders, waves } = bay()

    waves.reset()
    waves.dispose()
    await settled()

    expect(holders[0]?.querySelectorAll('canvas')).toHaveLength(0)
    expect(draws).toHaveLength(0)
  })
})
