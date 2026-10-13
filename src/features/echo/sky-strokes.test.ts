// ============================================================
// Echo's strokes as gradients: the cores drawn soft, as the storyboard has them
// ============================================================

import { describe, expect, it } from 'vitest'
import { STROKES } from './echo-geometry'
import type { GradientStop } from './sky-strokes'
import { CORE_SIGMA_MIN_PX, CORE_STEP_PX, lineGradient, ringGradient, strokeCoverage, } from './sky-strokes'

/** A stop's alpha and its brightest channel. */
function paint(stop: GradientStop): { alpha: number; peak: number } {
  const [r, g, b, a] = (stop.colour.match(/[\d.]+/gu) ?? []).map(Number)
  return { alpha: a, peak: Math.max(r, g, b) * a }
}

const UNIT = 390

describe("a ring's gradient", () => {
  const radius = STROKES.ringWaiting.radiusW * UNIT
  const ring = ringGradient(STROKES.ringWaiting, radius, UNIT)
  const at = (stop: GradientStop) => stop.offset * ring.outer

  it('is brightest on the ring itself, in its core', () => {
    const brightest = ring.stops.reduce((a, b) =>
      paint(b).peak > paint(a).peak ? b : a,
    )

    expect(Math.abs(at(brightest) - radius)).toBeLessThanOrEqual(CORE_STEP_PX)
    expect(paint(brightest).alpha).toBeGreaterThan(0.95)
  })

  it('samples the core finely enough to draw its fall-off', () => {
    const across = ring.stops.filter((stop) => Math.abs(at(stop) - radius) <= 1)
    const gaps = across.slice(1).map((stop, i) => at(stop) - at(across[i]))

    expect(across.length).toBeGreaterThanOrEqual(19)
    expect(Math.max(...gaps)).toBeLessThanOrEqual(CORE_STEP_PX + 1e-9)
  })

  it("runs from the centre to the glow's reach, in order", () => {
    const offsets = ring.stops.map((stop) => stop.offset)

    expect(offsets[0]).toBe(0)
    expect(offsets[offsets.length - 1]).toBe(1)
    expect(
      offsets.every((offset, i) => i === 0 || offset > offsets[i - 1]),
    ).toBe(true)
  })
})

describe("a line's gradient", () => {
  const line = lineGradient(STROKES.lineFinished, UNIT)

  it('is brightest on its centre line and falls off alike to either side', () => {
    const peaks = line.stops.map((stop) => paint(stop).peak)
    const brightest = line.stops[peaks.indexOf(Math.max(...peaks))]
    // The even samples sit in pairs about the centre line.
    const nearest = (offset: number) =>
      line.stops.reduce((a, b) =>
        Math.abs(b.offset - offset) < Math.abs(a.offset - offset) ? b : a,
      )

    expect(
      Math.abs(brightest.offset - 0.5) * 2 * line.half,
    ).toBeLessThanOrEqual(CORE_STEP_PX)
    expect(paint(nearest(0.25)).peak).toBeCloseTo(paint(nearest(0.75)).peak, 1)
    expect(paint(nearest(0.25)).peak).toBeLessThan(paint(brightest).peak / 2)
  })
})

describe('a core drawn small', () => {
  it('keeps a blur of CORE_SIGMA_MIN_PX, so it never beads at DPR 2', () => {
    // At a quarter of the width the core's own blur is far under the floor.
    const small = lineGradient(STROKES.lineFinished, UNIT / 4)
    const core = STROKES.lineFinished.core
    const widthPx = (core.widthW * UNIT) / 4
    const centre = small.stops.reduce((a, b) =>
      Math.abs(b.offset - 0.5) < Math.abs(a.offset - 0.5) ? b : a,
    )

    expect(core.sigmaW * (UNIT / 4)).toBeLessThan(CORE_SIGMA_MIN_PX)
    // The core's coverage on its centre line, at the floor's blur.
    expect(paint(centre).alpha).toBeCloseTo(
      strokeCoverage(0, widthPx, CORE_SIGMA_MIN_PX) +
        (1 - strokeCoverage(0, widthPx, CORE_SIGMA_MIN_PX)) *
          STROKES.lineFinished.glow.opacity *
          strokeCoverage(
            0,
            STROKES.lineFinished.glow.widthW * (UNIT / 4),
            STROKES.lineFinished.glow.sigmaW * (UNIT / 4),
          ),
      2,
    )
  })
})
