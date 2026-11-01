import { describe, expect, it } from 'vitest'
import { BUZZ_RIDE_TAU_SEC, RIDE_TAU_SEC, rideFeet, rideStep, } from './glide-ride'

const FRAME = 1 / 60

/** His feet's distance from the path, frame by frame, over `seconds`. */
function ride(
  voiceOff: (t: number) => number,
  pathY: (t: number) => number,
  seconds: number,
  tauSec?: number,
): number[] {
  const out: number[] = []
  let offset = 0
  for (let t = FRAME; t <= seconds; t += FRAME) {
    const feet = rideFeet(
      offset,
      pathY(t) + voiceOff(t),
      pathY(t),
      FRAME,
      tauSec,
    )
    offset = feet.offset
    out.push(feet.y - pathY(t))
  }
  return out
}

const maxAbs = (xs: readonly number[]): number => Math.max(...xs.map(Math.abs))

describe('rideStep', () => {
  it('eases toward the target at the core’s pace by default', () => {
    expect(rideStep(0, 1, RIDE_TAU_SEC)).toBeCloseTo(1 - Math.exp(-1), 6)
  })

  it('stands still when no time has passed', () => {
    expect(rideStep(0.4, 1, 0)).toBe(0.4)
    expect(rideStep(0.4, 1, -1, BUZZ_RIDE_TAU_SEC)).toBe(0.4)
  })
})

describe('rideFeet', () => {
  it('stands on a gliding path the voice follows, with no lag', () => {
    // A wave's rise: half the screen in under a second.
    const off = ride(
      () => 0,
      (t) => 1 - 0.6 * t,
      0.9,
      BUZZ_RIDE_TAU_SEC,
    )
    expect(maxAbs(off)).toBe(0)
  })

  it('damps a lip trill’s flutter around the path, more at a lip roll’s pace', () => {
    // A flutter of 0.05 either way, five times a second, on a moving path.
    const flutter = (t: number): number => 0.05 * Math.sin(2 * Math.PI * 5 * t)
    const path = (t: number): number => 1 - 0.3 * t
    const buzz = maxAbs(ride(flutter, path, 2, BUZZ_RIDE_TAU_SEC).slice(60))
    const core = maxAbs(ride(flutter, path, 2).slice(60))
    expect(buzz).toBeLessThan(0.2 * 0.05)
    expect(core).toBeGreaterThan(2 * buzz)
  })

  it('eases onto a voice that sits off the path, a time constant at a time', () => {
    const off = ride(
      () => 0.1,
      () => 0.5,
      BUZZ_RIDE_TAU_SEC,
      BUZZ_RIDE_TAU_SEC,
    )
    expect(off.at(-1)!).toBeCloseTo(0.1 * (1 - Math.exp(-1)), 2)
  })
})
