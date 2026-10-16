// ============================================================
// The bay's sky: the moon reaches storyboard screens 2 and 3
// ============================================================

import { describe, expect, it } from 'vitest'
import { lipRollPath } from '@/lib/glide/glide-path'
import { LIP_ROLL_LEVELS } from '@/lib/glide/glide-presets'
import { BAY, PLATES, WAVE } from './bay-geometry'
import { createBayScroll, holdCamera, INTRO_CAMERA } from './bay-scroll'
import { moonAt, skyTravel } from './bay-sky'
import { demoTake } from './demo/demo-script'

/** Screen 2: a run a quarter of the way into its first wave (u = -0.467). */
const SCREEN2_CAMERA = -0.467 * WAVE.a

/** Screen 3: the demo's first take, standing on its hold. */
function screen3Camera(): number {
  const take = demoTake('off', 50)
  const { path, countIn } = take.plan
  return holdCamera(createBayScroll(path, countIn), take.hold).camera(
    take.hold.to,
  )
}

const [screen2, screen3] = BAY.moonScreens

describe('the moon in the run', () => {
  it("stands where screen 2 has it, across, and at screen 2's size", () => {
    const moon = moonAt(SCREEN2_CAMERA, 1, false)

    expect(Math.abs(moon.x - screen2.cx)).toBeLessThan(0.01)
    expect(Math.abs(moon.d / screen2.d - 1)).toBeLessThan(0.1)
    // Its height is screens 2 and 3's mean: the storyboard repaints it
    // per screen (0.575 and 0.4754 W), which no slide can follow.
    expect(Math.abs(moon.y - screen2.cy)).toBeLessThan(0.051)
  })

  it("stands where screen 3 has it, across, and at screen 3's size", () => {
    const moon = moonAt(screen3Camera(), 1, false)

    expect(Math.abs(moon.x - screen3.cx)).toBeLessThan(0.01)
    expect(Math.abs(moon.d / screen3.d - 1)).toBeLessThan(0.1)
    expect(Math.abs(moon.y - screen3.cy)).toBeLessThan(0.051)
  })

  it("starts at screen 1's place and size on the intro", () => {
    const moon = moonAt(INTRO_CAMERA, 0, false)

    expect(moon.x).toBeCloseTo(BAY.moon.cx, 9)
    expect(moon.y).toBeCloseTo(BAY.moon.cy, 9)
    expect(moon.d).toBeCloseTo(BAY.moon.d, 9)
  })

  it('stays put across with reduced motion', () => {
    expect(moonAt(SCREEN2_CAMERA, 1, true).x).toBe(BAY.moon.cx)
  })
})

describe('the sky slide', () => {
  it.each(Object.entries(LIP_ROLL_LEVELS))(
    'keeps the plate over the whole screen through a %s run, and never jumps',
    (_, preset) => {
      const path = lipRollPath([48, 50, 52], 12, preset)
      const scroll = createBayScroll(path, 2.5)
      const back = PLATES.back.frame
      const step = 0.002
      let previous = skyTravel(scroll.min)
      for (let c = scroll.min; c <= scroll.max + 1e-9; c += step) {
        const travel = skyTravel(c)
        // The plate's left edge left of the screen's, its right edge right.
        expect(back.left - travel).toBeLessThanOrEqual(0)
        expect(back.left + back.width - travel).toBeGreaterThanOrEqual(1)
        // Forward with the camera, and smooth: no step in its speed.
        expect(travel).toBeGreaterThanOrEqual(previous - 1e-12)
        expect(travel - previous).toBeLessThan(0.53 * step + 1e-9)
        previous = travel
      }
    },
  )

  it('ends a run where the old quarter-speed slide did', () => {
    const path = lipRollPath([48, 50, 52], 12, LIP_ROLL_LEVELS.singer)
    const scroll = createBayScroll(path, 2.5)

    expect(skyTravel(scroll.max)).toBeCloseTo(
      (scroll.max - INTRO_CAMERA) * 0.25,
      2,
    )
  })
})
