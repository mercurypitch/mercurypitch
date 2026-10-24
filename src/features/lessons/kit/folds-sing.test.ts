// ============================================================
// Singing folds tests — the stretch, the vibration, the blur and the two stills
// ============================================================
//
// A recording context keeps every call the painters make, so a test reads
// the folds back from their outlines: each fold is a path that closes, its
// first 25 points its inner edge from front to back, so point 12 is the
// middle of the edge, where a vibration parts the folds most.

import { describe, expect, it } from 'vitest'
import type { FoldShape } from './folds'
import { drawFoldPair, foldShapeAt } from './folds'
import { drawFoldBlur, drawFoldStills, foldBulge, foldStretch, foldVibration, } from './folds-sing'

/** One call a canvas saw: a method and its arguments, or a property set, named `prop=`. */
type Call = readonly [string, ...unknown[]]

function recordingContext(): {
  ctx: CanvasRenderingContext2D
  calls: Call[]
} {
  const calls: Call[] = []
  const props: Record<string, unknown> = {}
  const ctx = new Proxy(props, {
    get: (target, k) => {
      if (typeof k !== 'string') return undefined
      if (k in target) return target[k]
      return (...args: unknown[]): unknown => {
        calls.push([k, ...args])
        return k === 'createLinearGradient'
          ? { addColorStop: (): undefined => undefined }
          : undefined
      }
    },
    set: (target, k, v: unknown) => {
      if (typeof k === 'string') {
        calls.push([`${k}=`, v])
        target[k] = v
      }
      return true
    },
  })
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls }
}

interface Fold {
  readonly points: readonly (readonly [number, number])[]
  readonly alpha: number
}

/** The folds the calls fill, in order, each with its outline and its alpha. */
function foldsDrawn(calls: readonly Call[]): Fold[] {
  const folds: Fold[] = []
  let path: [number, number][] = []
  let closed: [number, number][] | null = null
  let alpha = 1
  for (const [op, a, b] of calls) {
    if (op === 'beginPath') path = []
    else if (op === 'lineTo') path.push([Number(a), Number(b)])
    else if (op === 'closePath') closed = path
    else if (op === 'globalAlpha=') alpha = Number(a)
    else if (op === 'fill' && closed !== null) {
      folds.push({ points: closed, alpha })
      closed = null
    }
  }
  return folds
}

/** How far apart a pair's inner edges sit at their middle. */
const opening = (left: Fold, right: Fold): number =>
  right.points[12][0] - left.points[12][0]

/** A pair's centre, between its apexes. */
const centre = (left: Fold, right: Fold): number =>
  (left.points[0][0] + right.points[0][0]) / 2

/** Folds together at the back, `bulge` apart along their middle. */
const together = (bulge: number): FoldShape => ({
  ...foldShapeAt(200, 0.5, 100),
  bulge,
})

describe('foldStretch', () => {
  it('runs from slack at 110 Hz to tight at 440 Hz, half of it each octave, and holds at both ends', () => {
    // Act
    const stretches = [55, 110, 220, 440, 880].map(foldStretch)

    // Assert
    expect(stretches).toEqual([0, 0, 0.5, 1, 1])
  })
})

describe('foldVibration', () => {
  it('parts slack folds 6 px and tight ones 4.2 px', () => {
    // Act
    const slack = foldVibration(0)
    const tight = foldVibration(1)

    // Assert
    expect(slack).toBe(6)
    expect(tight).toBeCloseTo(4.2, 9)
  })
})

describe('foldBulge', () => {
  it("draws the folds' middle opening through the first half of a slowed cycle and shut through the second", () => {
    // Arrange
    const vib = foldVibration(0.5)
    const drawnAt = (phase: number): number => {
      const { ctx, calls } = recordingContext()
      drawFoldPair(ctx, together(foldBulge(0.5, phase)))
      const [left, right] = foldsDrawn(calls)
      return opening(left, right)
    }

    // Act
    const [start, eighth, quarter, half, threeQuarters] = [
      0, 0.125, 0.25, 0.5, 0.75,
    ].map(drawnAt)

    // Assert: shut, the inner edges sit 2 px apart; open, a vibration more on each side
    expect(start).toBeCloseTo(2, 9)
    expect(eighth).toBeCloseTo(2 + 2 * vib * Math.SQRT1_2, 9)
    expect(quarter).toBeCloseTo(2 + 2 * vib, 9)
    expect(half).toBeCloseTo(2, 9)
    expect(threeQuarters).toBeCloseTo(2, 9)
  })
})

describe('drawFoldBlur', () => {
  it('draws the folds fully open and faint, under the shape itself at three quarters', () => {
    // Arrange
    const { ctx, calls } = recordingContext()

    // Act
    drawFoldBlur(ctx, together(0), 0)

    // Assert
    const [openL, openR, shapeL, shapeR] = foldsDrawn(calls)
    expect([openL, openR, shapeL, shapeR].map((f) => f.alpha)).toEqual([
      0.35, 0.35, 0.75, 0.75,
    ])
    expect(opening(openL, openR)).toBeCloseTo(2 + 2 * 6, 9)
    expect(opening(shapeL, shapeR)).toBeCloseTo(2, 9)
  })
})

describe('drawFoldStills (reduced motion)', () => {
  it('draws OPEN and CLOSED side by side, the open pair parted by the vibration and the closed pair shut', () => {
    // Arrange
    const { ctx, calls } = recordingContext()

    // Act
    drawFoldStills(ctx, 400, 200, 0.5)

    // Assert
    const folds = foldsDrawn(calls)
    const words = calls.filter(([op]) => op === 'fillText')
    expect(folds).toHaveLength(4)
    expect(words.map(([, text]) => text)).toEqual(['OPEN', 'CLOSED'])
    const [openL, openR, closedL, closedR] = folds
    expect(opening(openL, openR)).toBeCloseTo(2 + 2 * foldVibration(0.5), 9)
    expect(opening(closedL, closedR)).toBeCloseTo(2, 9)
    expect(centre(openL, openR)).toBeCloseTo(400 * 0.3, 9)
    expect(centre(closedL, closedR)).toBeCloseTo(400 * 0.72, 9)
  })

  it('names each still beneath its own folds', () => {
    // Arrange
    const { ctx, calls } = recordingContext()

    // Act
    drawFoldStills(ctx, 400, 200, 0.5)

    // Assert
    const [openL, openR, closedL, closedR] = foldsDrawn(calls)
    const [open, closed] = calls
      .filter(([op]) => op === 'fillText')
      .map(([, , x, y]) => ({ x: Number(x), y: Number(y) }))
    const bottom = (f: Fold): number => Math.max(...f.points.map(([, y]) => y))
    expect(open.x).toBeCloseTo(centre(openL, openR), 9)
    expect(closed.x).toBeCloseTo(centre(closedL, closedR), 9)
    expect(open.y).toBeGreaterThan(bottom(openL))
    expect(closed.y).toBeGreaterThan(bottom(closedL))
  })
})
