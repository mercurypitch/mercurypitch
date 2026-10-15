// ============================================================
// The bay's scroll and zoom: time is the distance along the bay
// ============================================================

import { describe, expect, it } from 'vitest'
import { lipRollPath } from '@/lib/glide/glide-path'
import { LIP_ROLL_LEVELS } from '@/lib/glide/glide-presets'
import { INTRO, LANDING_W, PERIOD_W, PLAYHEAD_X, WAVE } from './bay-geometry'
import { createBayScroll, crestX, holdCamera, INTRO_CAMERA } from './bay-scroll'

const ROOTS = [48, 50, 52]
const COUNT_IN = 2.5

const levels = Object.entries(LIP_ROLL_LEVELS)

describe('the waves on the bay', () => {
  it('sit one period apart: a wave and its landing', () => {
    expect(crestX(0)).toBe(0)
    expect(crestX(2) - crestX(1)).toBeCloseTo(PERIOD_W, 12)
    expect(PERIOD_W).toBeCloseTo(2 * WAVE.a + LANDING_W, 3)
  })
})

describe('the camera during a wave', () => {
  it.each(levels)(
    'moves at one speed over up, top and down (%s)',
    (_, preset) => {
      const path = lipRollPath(ROOTS, 12, preset)
      const scroll = createBayScroll(path, COUNT_IN)
      for (const [k, wave] of path.arches.entries()) {
        // The foot at the start, the crest mid-wave, the far foot at the end.
        expect(scroll.at(wave.start)).toBeCloseTo(crestX(k) - WAVE.a, 9)
        expect(scroll.at((wave.start + wave.end) / 2)).toBeCloseTo(crestX(k), 9)
        expect(scroll.at(wave.end)).toBeCloseTo(crestX(k) + WAVE.a, 9)
        const quarter = (wave.end - wave.start) / 4
        const steps = [1, 2, 3, 4].map(
          (i) =>
            scroll.at(wave.start + i * quarter) -
            scroll.at(wave.start + (i - 1) * quarter),
        )
        for (const step of steps) expect(step).toBeCloseTo(steps[0], 9)
      }
    },
  )

  it('puts the target under the playhead: x is linear in the sung time', () => {
    const preset = LIP_ROLL_LEVELS.singer
    const path = lipRollPath(ROOTS, 12, preset)
    const scroll = createBayScroll(path, COUNT_IN)
    const D = preset.upSec + preset.topSec + preset.downSec
    expect(scroll.waveSpeed).toBeCloseTo((2 * WAVE.a) / D, 9)
  })
})

describe('the camera between waves', () => {
  it.each(levels)(
    'covers the landing in the landing and breath, slower, and meets each wave at its speed (%s)',
    (_, preset) => {
      const path = lipRollPath(ROOTS, 12, preset)
      const scroll = createBayScroll(path, COUNT_IN)
      const v = scroll.waveSpeed
      const h = 1e-4
      for (let k = 0; k + 1 < path.arches.length; k++) {
        const from = path.arches[k].end
        const to = path.arches[k + 1].start
        expect(scroll.at(to) - scroll.at(from)).toBeCloseTo(LANDING_W, 9)
        expect((scroll.at(from + h) - scroll.at(from)) / h).toBeCloseTo(v, 2)
        expect((scroll.at(to) - scroll.at(to - h)) / h).toBeCloseTo(v, 2)
        let previous = scroll.at(from)
        for (let i = 1; i <= 50; i++) {
          const x = scroll.at(from + ((to - from) * i) / 50)
          expect(x).toBeGreaterThanOrEqual(previous - 1e-12)
          previous = x
        }
      }
    },
  )
})

describe('the count-in, its zoom, and the end', () => {
  it("starts on screen 1's camera, still, and reaches the first foot at the wave speed", () => {
    const path = lipRollPath(ROOTS, 12, LIP_ROLL_LEVELS.learning)
    const scroll = createBayScroll(path, COUNT_IN)
    const h = 1e-4

    expect(scroll.at(-COUNT_IN - 1)).toBe(INTRO_CAMERA)
    // Screen 1: the first crest at INTRO.crestX under the intro's zoom.
    expect(
      PLAYHEAD_X + INTRO.sx * (crestX(0) - scroll.at(-COUNT_IN)),
    ).toBeCloseTo(INTRO.crestX, 9)
    expect((scroll.at(-COUNT_IN + h) - scroll.at(-COUNT_IN)) / h).toBeCloseTo(
      0,
      2,
    )
    expect(scroll.at(0)).toBeCloseTo(-WAVE.a, 9)
    expect((scroll.at(0) - scroll.at(-h)) / h).toBeCloseTo(scroll.waveSpeed, 2)
  })

  it("zooms from screen 1's wave to the run's over the count-in, and holds it", () => {
    const path = lipRollPath(ROOTS, 12, LIP_ROLL_LEVELS.singer)
    const scroll = createBayScroll(path, COUNT_IN)

    expect(scroll.zoom(-COUNT_IN - 1)).toBe(0)
    expect(scroll.zoom(-COUNT_IN)).toBe(0)
    const mid = scroll.zoom((-COUNT_IN + path.arches[0].start) / 2)
    expect(mid).toBeGreaterThan(0.2)
    expect(mid).toBeLessThan(0.8)
    expect(scroll.zoom(path.arches[0].start)).toBe(1)
    expect(scroll.zoom(path.duration)).toBe(1)
  })

  it('comes to rest after the last landing, and stays there', () => {
    const path = lipRollPath(ROOTS, 12, LIP_ROLL_LEVELS.singer)
    const scroll = createBayScroll(path, COUNT_IN)
    const end = path.duration

    expect(scroll.at(end)).toBeCloseTo(scroll.max, 9)
    expect(scroll.at(end + 5)).toBeCloseTo(scroll.max, 9)
    expect(scroll.max).toBeGreaterThan(crestX(2) + WAVE.a)
  })
})

describe("a held camera (the demo's one wave)", () => {
  const path = lipRollPath([48], 12, LIP_ROLL_LEVELS.learning)
  const scroll = createBayScroll(path, COUNT_IN)
  const hold = { from: 1.2, to: 3 }
  const held = holdCamera(scroll, hold)

  it('follows the voice until the hold, as the room does', () => {
    expect(scroll.camera).toBe(scroll.at)
    for (const t of [-COUNT_IN, -1, 0, 0.6, hold.from]) {
      expect(held.camera(t)).toBeCloseTo(scroll.at(t), 12)
    }
  })

  it('slows to a stand with no jolt, and stands still from then on', () => {
    const dt = 1 / 120
    let previous = held.camera(hold.from)
    let speed = scroll.waveSpeed
    for (let t = hold.from + dt; t <= hold.to + 1e-9; t += dt) {
      const now = held.camera(t)
      const v = (now - previous) / dt
      // Never backwards, never faster than the waves, never a sudden stop.
      expect(v).toBeGreaterThanOrEqual(-1e-9)
      expect(v).toBeLessThanOrEqual(scroll.waveSpeed + 1e-9)
      expect(Math.abs(v - speed)).toBeLessThan(scroll.waveSpeed * 0.02)
      previous = now
      speed = v
    }
    const stand = held.camera(hold.to)
    expect(held.camera(path.duration)).toBe(stand)
    expect(held.camera(path.duration + 5)).toBe(stand)
    expect(held.max).toBe(stand)
    // Half the slowing's span at the wave speed: the eased stop's travel.
    expect(stand - held.camera(hold.from)).toBeCloseTo(
      (scroll.waveSpeed * (hold.to - hold.from)) / 2,
      9,
    )
  })

  it('moves nothing the voice sings: each moment is sung where it was', () => {
    for (const t of [-1, 0, 1, 2.5, 4, path.duration]) {
      expect(held.at(t)).toBe(scroll.at(t))
    }
    expect(held.zoom).toBe(scroll.zoom)
  })
})
