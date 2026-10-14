// ============================================================
// The bridge's scroll: time is the distance along the bridge
// ============================================================

import { describe, expect, it } from 'vitest'
import { ngSlidesPath } from '@/lib/glide/glide-path'
import { NG_SLIDES_LEVELS } from '@/lib/glide/glide-presets'
import { ARCH, INTRO_APEX_X, LANDING_W, PLAYHEAD_X } from './bridge-geometry'
import { apexX, createBridgeScroll, INTRO_CAMERA } from './bridge-scroll'

const ROOTS = [45, 46, 47, 48, 49]
const COUNT_IN = 2.6

const levels = Object.entries(NG_SLIDES_LEVELS)

describe('the camera during a slide', () => {
  it.each(levels)(
    'moves at one speed over up, top and down (%s)',
    (_, preset) => {
      const path = ngSlidesPath(ROOTS, preset)
      const scroll = createBridgeScroll(path, COUNT_IN)
      for (const [k, arch] of path.arches.entries()) {
        // The foot at the start, the apex mid-slide, the far foot at the end.
        expect(scroll.at(arch.start)).toBeCloseTo(apexX(k) - ARCH.a, 9)
        expect(scroll.at((arch.start + arch.end) / 2)).toBeCloseTo(apexX(k), 9)
        expect(scroll.at(arch.end)).toBeCloseTo(apexX(k) + ARCH.a, 9)
        // Linear: equal steps in time are equal steps in X.
        const quarter = (arch.end - arch.start) / 4
        const steps = [1, 2, 3, 4].map(
          (i) =>
            scroll.at(arch.start + i * quarter) -
            scroll.at(arch.start + (i - 1) * quarter),
        )
        for (const step of steps) expect(step).toBeCloseTo(steps[0], 9)
      }
    },
  )

  it('puts the target under the playhead: x is linear in the sung time', () => {
    const preset = NG_SLIDES_LEVELS.singer
    const path = ngSlidesPath(ROOTS, preset)
    const scroll = createBridgeScroll(path, COUNT_IN)
    const D = preset.upSec + preset.topSec + preset.downSec
    expect(scroll.slideSpeed).toBeCloseTo((2 * ARCH.a) / D, 9)
  })
})

describe('the camera between slides', () => {
  it.each(levels)(
    'covers the landing in the landing and breath, slower, and meets each slide at its speed (%s)',
    (_, preset) => {
      const path = ngSlidesPath(ROOTS, preset)
      const scroll = createBridgeScroll(path, COUNT_IN)
      const v = scroll.slideSpeed
      const h = 1e-4
      for (let k = 0; k + 1 < path.arches.length; k++) {
        const from = path.arches[k].end
        const to = path.arches[k + 1].start
        expect(scroll.at(to) - scroll.at(from)).toBeCloseTo(LANDING_W, 9)
        // Speed continuous at both ends of the gap.
        expect((scroll.at(from + h) - scroll.at(from)) / h).toBeCloseTo(v, 2)
        expect((scroll.at(to) - scroll.at(to - h)) / h).toBeCloseTo(v, 2)
        // Never backwards, and slower than a slide in the middle.
        let previous = scroll.at(from)
        for (let i = 1; i <= 50; i++) {
          const x = scroll.at(from + ((to - from) * i) / 50)
          expect(x).toBeGreaterThanOrEqual(previous - 1e-12)
          previous = x
        }
        const mid = (from + to) / 2
        expect((scroll.at(mid + h) - scroll.at(mid)) / h).toBeLessThan(v / 4)
      }
    },
  )
})

describe('the count-in and the end', () => {
  it('starts at the intro, still, and reaches the first foot at the slide speed', () => {
    const path = ngSlidesPath(ROOTS, NG_SLIDES_LEVELS.learning)
    const scroll = createBridgeScroll(path, COUNT_IN)
    const h = 1e-4

    expect(scroll.at(-COUNT_IN - 1)).toBe(INTRO_CAMERA)
    // Screen 1: the first apex at INTRO_APEX_X.
    expect(PLAYHEAD_X + apexX(0) - scroll.at(-COUNT_IN)).toBeCloseTo(
      INTRO_APEX_X,
      9,
    )
    expect((scroll.at(-COUNT_IN + h) - scroll.at(-COUNT_IN)) / h).toBeCloseTo(
      0,
      2,
    )
    expect(scroll.at(0)).toBeCloseTo(-ARCH.a, 9)
    expect((scroll.at(0) - scroll.at(-h)) / h).toBeCloseTo(scroll.slideSpeed, 2)
    // It rolls back a little first: the intro's playhead is inside the ramp.
    expect(scroll.min).toBeLessThan(-ARCH.a)
    expect(scroll.min).toBeGreaterThan(-ARCH.a - 0.1)
  })

  it('comes to rest after the last landing, and stays there', () => {
    const path = ngSlidesPath(ROOTS, NG_SLIDES_LEVELS.singer)
    const scroll = createBridgeScroll(path, COUNT_IN)
    const end = path.duration

    expect(scroll.at(end)).toBeCloseTo(scroll.max, 9)
    expect(scroll.at(end + 5)).toBeCloseTo(scroll.max, 9)
    expect(scroll.max).toBeGreaterThan(apexX(4) + ARCH.a)
  })
})
