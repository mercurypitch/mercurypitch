// ============================================================
// TV stage trail spline tests — one smooth curve through the singer's pitch
// ============================================================
//
// The curve passes through every knot, bends without a corner at each, keeps
// a straight run straight, and does not swing past a step in pitch the way a
// plain Catmull-Rom spline does. Before it, a stroke is smoothed and thinned
// without moving its ends.

import { describe, expect, it } from 'vitest'
import type { TrailPoint } from '@/lib/tv-stage/lane-judge'
import type { CurvePiece, Knot } from '@/lib/tv-stage/trail-spline'
import { catmullRom, KNOT_STEP_SEC, smoothStroke, } from '@/lib/tv-stage/trail-spline'

/** A point on the piece from `from`, `t` of the way along. */
function along(from: Knot, piece: CurvePiece, t: number): Knot {
  const u = 1 - t
  const w = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t]
  const pts = [from, piece.c1, piece.c2, piece.to]
  return {
    x: pts.reduce((sum, p, i) => sum + p.x * w[i], 0),
    y: pts.reduce((sum, p, i) => sum + p.y * w[i], 0),
  }
}

/** The lowest and highest the curve through `knots` goes. */
function reach(knots: readonly Knot[]): { low: number; high: number } {
  let low = Infinity
  let high = -Infinity
  catmullRom(knots).forEach((piece, index) => {
    for (let t = 0; t <= 1; t += 0.01) {
      const y = along(knots[index], piece, t).y
      low = Math.min(low, y)
      high = Math.max(high, y)
    }
  })
  return { low, high }
}

const WAVE: Knot[] = [
  { x: 0, y: 40 },
  { x: 9, y: 31 },
  { x: 17, y: 36 },
  { x: 26, y: 20 },
  { x: 34, y: 24 },
  { x: 43, y: 12 },
]

describe('the curve', () => {
  it('passes through every knot, one piece from each to the next', () => {
    const pieces = catmullRom(WAVE)

    expect(pieces).toHaveLength(WAVE.length - 1)
    pieces.forEach((piece, index) => {
      expect(piece.to).toEqual(WAVE[index + 1])
      expect(along(WAVE[index], piece, 0)).toEqual(WAVE[index])
    })
  })

  it('bends without a corner at each knot', () => {
    const pieces = catmullRom(WAVE)

    for (let index = 1; index < pieces.length; index += 1) {
      const knot = WAVE[index]
      const into = pieces[index - 1].c2
      const out = pieces[index].c1
      const inAngle = Math.atan2(knot.y - into.y, knot.x - into.x)
      const outAngle = Math.atan2(out.y - knot.y, out.x - knot.x)
      expect(outAngle).toBeCloseTo(inAngle, 9)
    }
  })

  it('keeps a straight run straight', () => {
    const line = [0, 1, 2, 3].map((i) => ({ x: i * 8, y: 50 - i * 3 }))

    for (const piece of catmullRom(line)) {
      for (const control of [piece.c1, piece.c2]) {
        expect(control.y).toBeCloseTo(50 - (control.x / 8) * 3, 9)
      }
    }
  })

  it('does not swing past a step in pitch', () => {
    // Knots 8 px apart, as 30 ms apart are at 1080 lines, and a leap of two
    // semitones between two of them: a plain Catmull-Rom spline swings 7%
    // past both levels (3 px), this one 2%.
    const step = [0, 0, 0, 40, 40, 40].map((y, i) => ({ x: i * 8, y }))

    const { low, high } = reach(step)

    expect(low).toBeGreaterThan(-1)
    expect(high).toBeLessThan(41)
  })

  it('needs two knots to make anything', () => {
    expect(catmullRom([])).toEqual([])
    expect(catmullRom([{ x: 1, y: 1 }])).toEqual([])
  })
})

describe('a stroke before it is drawn', () => {
  const point = (time: number, midi: number): TrailPoint => ({
    time,
    midi,
    verdict: 'hit',
    note: null,
  })

  it('is averaged over its neighbours, and thinned to a knot every 30 ms', () => {
    // Readings every 10 ms, alternating a fifth of a semitone either side.
    const jitter = Array.from({ length: 31 }, (_, i) =>
      point(i / 100, i % 2 === 0 ? 60.2 : 59.8),
    )

    const smooth = smoothStroke(jitter)

    for (let i = 1; i < smooth.length; i += 1) {
      expect(smooth[i].time - smooth[i - 1].time).toBeGreaterThanOrEqual(
        KNOT_STEP_SEC - 1e-9,
      )
    }
    for (const p of smooth.slice(2, -2)) {
      expect(Math.abs(p.midi - 60)).toBeLessThan(0.05)
    }
  })

  it('starts and ends where the singer did', () => {
    const stroke = [point(0, 60), point(0.012, 61), point(0.024, 62)]

    const smooth = smoothStroke(stroke)

    expect(smooth.map((p) => p.time)).toEqual([0, 0.024])
  })

  it('keeps each reading’s verdict', () => {
    const stroke = [
      point(0, 60),
      { ...point(0.05, 61), verdict: 'off' as const },
      point(0.1, 60),
    ]

    expect(smoothStroke(stroke).map((p) => p.verdict)).toEqual([
      'hit',
      'off',
      'hit',
    ])
  })
})
