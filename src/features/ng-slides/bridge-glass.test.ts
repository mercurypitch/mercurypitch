// ============================================================
// The arches' canvases: arch 1's are ready before its first strip
// ============================================================
//
// jsdom has no canvas, so every 2d context here is a fake that keeps its
// drawImage calls. The frame that lights slide 1's first strip copies
// that strip into the glass and into its reflection, and nothing else.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { GlassImages } from './bridge-glass'
import { createArchGlass } from './bridge-glass'

/** One drawImage: the canvas it drew into and its arguments after the picture. */
interface Draw {
  readonly canvas: HTMLCanvasElement
  readonly args: readonly number[]
}

let draws: Draw[] = []

beforeEach(() => {
  draws = []
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
    function (this: HTMLCanvasElement) {
      return {
        canvas: this,
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

function picture(width: number, height: number): HTMLImageElement {
  const img = document.createElement('img')
  Object.defineProperty(img, 'naturalWidth', { value: width })
  Object.defineProperty(img, 'naturalHeight', { value: height })
  return img
}

function bridge() {
  const glass = [0, 1].map(() => document.createElement('div'))
  const reflection = [0, 1].map(() => document.createElement('div'))
  const art: GlassImages = {
    glassUnlit: picture(732, 518),
    glassLit: picture(732, 518),
    reflectionUnlit: picture(366, 296),
    reflectionLit: picture(366, 296),
  }
  const arches = createArchGlass({
    holders: (k) => {
      const g = glass[k]
      const r = reflection[k]
      return g === undefined || r === undefined
        ? null
        : { glass: g, reflection: r }
    },
    images: () => Promise.resolve(art),
  })
  return { glass, reflection, arches }
}

const settled = (): Promise<void> => new Promise((r) => setTimeout(r, 0))
const isFullPicture = (d: Draw): boolean => d.args.length === 2

describe('the first arch lighting', () => {
  it('has its glass and reflection canvases before the first strip', async () => {
    const { glass, reflection, arches } = bridge()

    arches.reset()
    await settled()

    expect(glass[0]?.querySelectorAll('canvas[data-lit]')).toHaveLength(1)
    expect(reflection[0]?.querySelectorAll('canvas[data-lit]')).toHaveLength(1)
  })

  it('keeps them hidden until the first strip, then shows them', async () => {
    const { glass, reflection, arches } = bridge()
    arches.reset()
    await settled()
    const canvases = [glass[0], reflection[0]].map((h) =>
      h?.querySelector('canvas'),
    )

    expect(canvases.map((c) => c?.style.visibility)).toEqual([
      'hidden',
      'hidden',
    ])
    arches.paint([{ arch: 0, from: -0.4, to: -0.38 }])
    expect(canvases.map((c) => c?.style.visibility)).toEqual(['', ''])
  })

  it('copies one strip a canvas and nothing else on the first lit strip', async () => {
    const { arches } = bridge()
    arches.reset()
    await settled()
    const before = draws.length

    arches.paint([{ arch: 0, from: -0.4, to: -0.38 }])

    const onTheFrame = draws.slice(before)
    expect(onTheFrame).toHaveLength(2)
    expect(onTheFrame.some(isFullPicture)).toBe(false)
  })

  it('removes every canvas on dispose, and makes none after it', async () => {
    const { glass, reflection, arches } = bridge()
    arches.reset()
    await settled()
    arches.paint([{ arch: 1, from: -1, to: -0.9 }])

    arches.dispose()
    arches.reset()
    await settled()

    for (const holder of [...glass, ...reflection]) {
      expect(holder.querySelectorAll('canvas')).toHaveLength(0)
    }
  })
})
