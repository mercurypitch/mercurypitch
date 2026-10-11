// ============================================================
// The voice strip: the singer's two glides as one gold ridge
// ============================================================
//
// The twin's stat card draws the singer's own glides across its top. These
// tests pin what the line may and may not claim: it is the take itself,
// gaps are skipped rather than drawn as drops, it never runs past the
// notes the card names, and a narrow range is not stretched into a peak.

import { describe, expect, it } from 'vitest'
import type { F0Frame } from '@/lib/mirror/metrics'
import { computeRange } from '@/lib/mirror/metrics'
import { glideStrip, idealStrip, RIDGE_BOX, ridgeShape, STRIP_POINTS_PER_GLIDE, } from './voice-strip'

const HOP = 0.016

/** An even slide between two pitches, the way a singer glides. */
function glide(fromHz: number, toHz: number, seconds = 8): F0Frame[] {
  const n = Math.round(seconds / HOP)
  return Array.from({ length: n }, (_, i) => ({
    t: i * HOP,
    f0: fromHz * (toHz / fromHz) ** (i / (n - 1)),
    conf: 0.95,
  }))
}

/** Silence: frames the pitch tracker could not voice. */
function silence(from: number, seconds: number): F0Frame[] {
  return Array.from({ length: Math.round(seconds / HOP) }, (_, i) => ({
    t: from + i * HOP,
    f0: 0,
    conf: 0,
  }))
}

const A2 = 110
const A4 = 440

describe('glideStrip', () => {
  it('draws a glide up and back down as one ridge between the measured notes', () => {
    // Arrange
    const glides = [glide(A2, A4), glide(A4, A2)]
    const range = computeRange(glides)

    // Act
    const strip = glideStrip(glides, range)

    // Assert: it rises to the top note in the middle and falls back.
    expect(range).not.toBeNull()
    expect(strip).not.toBeNull()
    const line = strip as number[]
    expect(line).toHaveLength(2 * STRIP_POINTS_PER_GLIDE)
    const peak = line.indexOf(Math.max(...line))
    expect(peak).toBeGreaterThan(STRIP_POINTS_PER_GLIDE - 3)
    expect(peak).toBeLessThan(STRIP_POINTS_PER_GLIDE + 3)
    expect(Math.abs(Math.max(...line) - range!.highMidi)).toBeLessThan(1)
    expect(Math.abs(line[0] - range!.lowMidi)).toBeLessThan(1)
    expect(Math.abs((line.at(-1) ?? 0) - range!.lowMidi)).toBeLessThan(1)
  })

  it('skips a silent stretch instead of drawing it as a drop', () => {
    // Arrange: the singer runs out of breath halfway up.
    const up = [
      ...glide(A2, 220, 4),
      ...silence(4, 1),
      ...glide(220, A4, 3).map((f) => ({ ...f, t: f.t + 5 })),
    ]
    const glides = [up, glide(A4, A2)]
    const range = computeRange(glides)

    // Act
    const strip = glideStrip(glides, range) as number[]

    // Assert: fewer points, none of them anywhere near silence.
    expect(strip.length).toBeLessThan(2 * STRIP_POINTS_PER_GLIDE)
    expect(Math.min(...strip)).toBeGreaterThanOrEqual(range!.lowMidi)
  })

  it('holds a stray pitch to the edge of the measured range', () => {
    // Arrange: a jump of two octaves two seconds into the glide, the kind
    // of tracker slip the range's own outlier guard leaves out.
    const up = glide(A2, A4).map((f) =>
      f.t > 2 && f.t < 2.3 ? { ...f, f0: f.f0 * 4 } : f,
    )
    const range = { lowMidi: 45, highMidi: 69 }

    // Act
    const strip = glideStrip([up, glide(A4, A2)], range) as number[]

    // Assert: the slip reaches the top edge and stops there.
    expect(Math.max(...strip)).toBe(69)
    expect(strip.slice(0, 12).filter((m) => m === 69)).toHaveLength(1)
    expect(Math.min(...strip)).toBeGreaterThanOrEqual(45)
  })

  it('has nothing to draw without a range, or with too little voice', () => {
    const glides = [glide(A2, A4), glide(A4, A2)]

    expect(glideStrip(glides, null)).toBeNull()
    expect(
      glideStrip([silence(0, 8), silence(0, 8)], computeRange(glides)),
    ).toBeNull()
  })
})

describe('idealStrip', () => {
  it('rises from the low note to the high note and back', () => {
    const strip = idealStrip({ lowMidi: 45, highMidi: 69 })

    expect(strip[0]).toBe(45)
    expect(strip.at(-1)).toBe(45)
    expect(Math.max(...strip)).toBeCloseTo(69, 1)
  })
})

describe('ridgeShape', () => {
  const inside = (shape: ReturnType<typeof ridgeShape>): boolean =>
    shape.points.every(
      ([x, y]) =>
        x >= 0 && x <= RIDGE_BOX.width && y > 0 && y < RIDGE_BOX.height,
    )

  it('marks the peak and the lowest point, wherever in the take they fall', () => {
    // Arrange: the lowest point is the END of the glide down.
    const strip = [47, 52, 58, 64, 69, 63, 55, 50, 45]

    // Act
    const shape = ridgeShape(strip, { lowMidi: 45, highMidi: 69 })

    // Assert: the top note at the top, the bottom note at the bottom.
    expect(inside(shape)).toBe(true)
    expect(shape.high.x).toBeCloseTo(50, 0)
    expect(shape.low.x).toBeGreaterThan(90)
    expect(shape.high.y).toBeLessThan(20)
    expect(shape.low.y).toBeGreaterThan(80)
  })

  it('fills the box it is given, so any width draws without stretching', () => {
    const strip = [45, 57, 69, 57, 45]
    const box = { width: 220, height: 64 }

    const shape = ridgeShape(strip, { lowMidi: 45, highMidi: 69 }, box)

    expect(Math.max(...shape.points.map(([x]) => x))).toBe(220)
    expect(shape.points.every(([, y]) => y > 0 && y < 64)).toBe(true)
  })

  it('keeps a very wide range inside the box', () => {
    // Two and a half octaves, C2 to F#5.
    const shape = ridgeShape(idealStrip({ lowMidi: 36, highMidi: 78 }), {
      lowMidi: 36,
      highMidi: 78,
    })

    expect(inside(shape)).toBe(true)
    expect(shape.high.y).toBeGreaterThan(0)
    expect(shape.low.y).toBeLessThan(100)
  })

  it('draws a narrow range as a low hill, not a full-height peak', () => {
    // Arrange: three semitones against two octaves.
    const narrow = ridgeShape(idealStrip({ lowMidi: 57, highMidi: 60 }), {
      lowMidi: 57,
      highMidi: 60,
    })
    const wide = ridgeShape(idealStrip({ lowMidi: 45, highMidi: 69 }), {
      lowMidi: 45,
      highMidi: 69,
    })

    // Assert: the narrow ridge is a fraction of the wide one's height.
    const height = (s: typeof wide): number => s.low.y - s.high.y
    expect(inside(narrow)).toBe(true)
    expect(height(narrow)).toBeLessThan(height(wide) / 3)
  })

  it('draws a single note as a flat line rather than dividing by zero', () => {
    const shape = ridgeShape([57, 57, 57, 57], { lowMidi: 57, highMidi: 57 })

    expect(inside(shape)).toBe(true)
    expect(shape.line).not.toMatch(/NaN|Infinity/)
  })
})
