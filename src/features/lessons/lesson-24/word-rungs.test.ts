// ============================================================
// Lesson 24 word rungs tests — evenly spaced, the sounding one lit, the ends named
// ============================================================
//
// WEB-SPEC, Toys 4: Harmonic's six rungs and Equal-tempered's thirteen
// stand evenly spaced from the stub's foot to its top, chrome at rest; the
// one sounding is lit in ink, thicker, with a glow, and only that one; the
// lowest rung and the highest are named at the left.

import { describe, expect, it } from 'vitest'
import { COLOR, rgba } from '@/features/lessons/kit/notes'
import { NAME_W, paintWordRungs, rungY } from './word-rungs'

/** One rung as the canvas drew it: its height, its ends, its colour, its width and its glow. */
interface Stroke {
  readonly y: number
  readonly x0: number
  readonly x1: number
  readonly colour: string
  readonly width: number
  readonly blur: number
}

/** A 2D context that keeps the rungs it strokes and the words it writes, and draws nothing. */
function recorder(): {
  ctx: CanvasRenderingContext2D
  strokes: Stroke[]
  texts: [string, number, number][]
} {
  const strokes: Stroke[] = []
  const texts: [string, number, number][] = []
  const state: Record<string, unknown> = { lineWidth: 1, shadowBlur: 0 }
  const saved: Record<string, unknown>[] = []
  let path: [number, number][] = []
  const methods: Record<string, (...args: never[]) => void> = {
    save: () => {
      saved.push({ ...state })
    },
    restore: () => {
      Object.assign(state, saved.pop())
    },
    beginPath: () => {
      path = []
    },
    moveTo: (x: number, y: number) => {
      path.push([x, y])
    },
    lineTo: (x: number, y: number) => {
      path.push([x, y])
    },
    stroke: () => {
      strokes.push({
        y: path[0][1],
        x0: path[0][0],
        x1: path[1][0],
        colour: String(state.strokeStyle),
        width: Number(state.lineWidth),
        blur: Number(state.shadowBlur),
      })
    },
    fillText: (text: string, x: number, y: number) => {
      texts.push([text, x, y])
    },
  }
  const ctx = new Proxy(state, {
    get: (target, key) =>
      typeof key === 'string' && key in methods
        ? methods[key]
        : target[key as string],
    set: (target, key, value: unknown) => {
      target[key as string] = value
      return true
    },
  }) as unknown as CanvasRenderingContext2D
  return { ctx, strokes, texts }
}

describe('the rungs', () => {
  it('stand evenly spaced from the foot to the top, each across from the names to the right edge', () => {
    // Arrange
    const { ctx, strokes } = recorder()

    // Act: Equal-tempered's thirteen on a stub 240 by 120
    paintWordRungs(ctx, 240, 120, { n: 13, lit: null, ends: ['A3', 'A4'] })

    // Assert
    expect(strokes).toHaveLength(13)
    const ys = strokes.map((s) => s.y)
    expect(ys[0]).toBe(120 - 14)
    expect(ys[12]).toBe(14)
    const gaps = ys.slice(1).map((y, i) => ys[i] - y)
    for (const g of gaps) expect(g).toBeCloseTo(92 / 12, 9)
    for (const s of strokes) expect([s.x0, s.x1]).toEqual([NAME_W, 240 - 12])
  })

  it('draws them chrome at rest, and lights the sounding one alone in ink, thicker and glowing', () => {
    // Arrange
    const { ctx, strokes } = recorder()

    // Act: Harmonic's third rung, 660 Hz, sounding
    paintWordRungs(ctx, 240, 120, {
      n: 6,
      lit: 2,
      ends: ['220 Hz', '1,320 Hz'],
    })

    // Assert
    expect(strokes.map((s) => [s.colour, s.width, s.blur])).toEqual([
      [rgba(COLOR.chrome, 0.55), 1.5, 0],
      [rgba(COLOR.chrome, 0.55), 1.5, 0],
      [COLOR.ink, 3, 12],
      [rgba(COLOR.chrome, 0.55), 1.5, 0],
      [rgba(COLOR.chrome, 0.55), 1.5, 0],
      [rgba(COLOR.chrome, 0.55), 1.5, 0],
    ])
  })

  it('names the lowest rung and the highest at the left, level with each', () => {
    // Arrange
    const { ctx, texts } = recorder()

    // Act
    paintWordRungs(ctx, 240, 120, {
      n: 6,
      lit: null,
      ends: ['220 Hz', '1,320 Hz'],
    })

    // Assert
    expect(texts).toEqual([
      ['220 Hz', 8, rungY(120, 6, 0)],
      ['1,320 Hz', 8, rungY(120, 6, 5)],
    ])
  })
})
