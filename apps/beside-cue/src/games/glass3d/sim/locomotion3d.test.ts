import { describe, expect, it } from 'vitest'
import type { LocomotionConfig, LocomotionIntent } from './locomotion3d'
import { createLocomotion, hasFallenOut, jumpVelocity, stepLocomotion, } from './locomotion3d'

const CFG: LocomotionConfig = {
  walkSpeed: 1.2,
  accelSeconds: 0.12,
  jumpHeight: 0.55,
  gravity: 6.5,
  coyoteSeconds: 0.1,
  bufferSeconds: 0.12,
  maxFallSpeed: 6,
  minX: -2,
  maxX: 2,
}

const STEP = 1 / 120
const STILL: LocomotionIntent = { move: 0, jump: false }

/** A floor at 0 everywhere, which is the room with nothing in it. */
const flat = () => 0
/** A floor with a hole in it, so falling can be provoked. */
const holed = (from: number, to: number) => (x: number) =>
  x > from && x < to ? null : 0

const run = (
  state: ReturnType<typeof createLocomotion>,
  intent: LocomotionIntent | ((i: number) => LocomotionIntent),
  ground: (x: number) => number | null,
  seconds: number,
  cfg: LocomotionConfig = CFG,
): { landings: number } => {
  const steps = Math.round(seconds / STEP)
  let landings = 0
  for (let i = 0; i < steps; i++) {
    const at = typeof intent === 'function' ? intent(i) : intent
    if (stepLocomotion(state, at, ground, STEP, cfg).landed) landings++
  }
  return { landings }
}

describe('walking', () => {
  it('goes nowhere without an intent', () => {
    const s = createLocomotion(0)
    run(s, STILL, flat, 1)
    expect(s.x).toBe(0)
    expect(s.grounded).toBe(true)
  })

  it('reaches walking speed and no faster', () => {
    const s = createLocomotion(0)
    run(s, { move: 1, jump: false }, flat, 1)
    expect(s.vx).toBeCloseTo(CFG.walkSpeed, 5)
  })

  it('takes accelSeconds to get there, not one step', () => {
    const s = createLocomotion(0)
    // Half the acceleration time buys about half the speed.
    run(s, { move: 1, jump: false }, flat, CFG.accelSeconds / 2)
    expect(s.vx).toBeGreaterThan(CFG.walkSpeed * 0.4)
    expect(s.vx).toBeLessThan(CFG.walkSpeed * 0.6)
  })

  it('honours a half-pressed intent', () => {
    const s = createLocomotion(0)
    run(s, { move: 0.5, jump: false }, flat, 1)
    expect(s.vx).toBeCloseTo(CFG.walkSpeed * 0.5, 5)
  })

  it('faces the way it is going, and keeps facing that way when it stops', () => {
    const s = createLocomotion(0)
    run(s, { move: -1, jump: false }, flat, 0.3)
    expect(s.facing).toBe(-1)
    run(s, STILL, flat, 0.5)
    expect(s.facing).toBe(-1)
  })

  it('stops at the walls and banks no momentum against them', () => {
    const s = createLocomotion(0)
    run(s, { move: 1, jump: false }, flat, 10)
    expect(s.x).toBe(CFG.maxX)
    expect(s.vx).toBe(0)
  })

  it('survives a NaN intent rather than teleporting', () => {
    const s = createLocomotion(0)
    run(s, { move: Number.NaN, jump: false }, flat, 0.5)
    expect(Number.isFinite(s.x)).toBe(true)
    expect(s.x).toBe(0)
  })
})

describe('jumping', () => {
  it('reaches the configured height, and not much more', () => {
    const s = createLocomotion(0)
    let peak = 0
    for (let i = 0; i < 240; i++) {
      stepLocomotion(s, { move: 0, jump: i < 2 }, flat, STEP, CFG)
      peak = Math.max(peak, s.y)
    }
    // One step of discretisation is the whole error budget.
    expect(peak).toBeGreaterThan(CFG.jumpHeight * 0.97)
    expect(peak).toBeLessThan(CFG.jumpHeight * 1.03)
  })

  it('derives its launch speed from the height and gravity', () => {
    expect(jumpVelocity(CFG)).toBeCloseTo(
      Math.sqrt(2 * CFG.gravity * CFG.jumpHeight),
      6,
    )
  })

  it('comes back down and reports the landing once', () => {
    const s = createLocomotion(0)
    const { landings } = run(s, (i) => ({ move: 0, jump: i < 2 }), flat, 2)
    expect(landings).toBe(1)
    expect(s.grounded).toBe(true)
    expect(s.y).toBe(0)
  })

  it('does not double-jump on a held button', () => {
    const s = createLocomotion(0)
    // Held for the whole flight: the edge fired once, and the buffer
    // must not re-fire it on landing.
    const { landings } = run(s, { move: 0, jump: true }, flat, 2)
    expect(landings).toBe(1)
  })

  it('jumps again when the button is released and pressed', () => {
    const s = createLocomotion(0)
    const { landings } = run(
      s,
      (i) => ({ move: 0, jump: i < 2 || (i > 160 && i < 164) }),
      flat,
      3,
    )
    expect(landings).toBe(2)
  })
})

describe('the forgivenesses', () => {
  /** Walk right off a floor that stops at x = 0, and stop the moment
   * the ground does. */
  const walkOffTheEdge = () => {
    const s = createLocomotion(-0.2)
    const ground = holed(0, 1)
    for (let i = 0; i < 600 && s.grounded; i++) {
      stepLocomotion(s, { move: 1, jump: false }, ground, STEP, CFG)
    }
    return { s, ground }
  }

  it('coyote time: a jump just after the edge still jumps', () => {
    const { s, ground } = walkOffTheEdge()
    expect(s.grounded).toBe(false)
    expect(s.coyoteLeft).toBeGreaterThan(0)
    stepLocomotion(s, { move: 1, jump: true }, ground, STEP, CFG)
    expect(s.vy).toBeGreaterThan(0)
  })

  it('and not once the grace has run out', () => {
    const { s, ground } = walkOffTheEdge()
    // Past the window, still falling, and now simply falling.
    run(s, { move: 1, jump: false }, ground, CFG.coyoteSeconds * 2)
    expect(s.coyoteLeft).toBe(0)
    const before = s.vy
    stepLocomotion(s, { move: 1, jump: true }, ground, STEP, CFG)
    expect(s.vy).toBeLessThan(before)
  })

  it('jump buffer: a jump pressed before landing fires on landing', () => {
    // The flight lasts 2 * v0 / g, which at this config is about 99
    // steps. Press at 90: inside the buffer window, outside the flight.
    const flightSteps = Math.round((2 * jumpVelocity(CFG)) / CFG.gravity / STEP)
    const pressAt = flightSteps - Math.round(CFG.bufferSeconds / STEP / 2)
    const s = createLocomotion(0)
    let landings = 0
    for (let i = 0; i < 400; i++) {
      const jump = i < 2 || (i >= pressAt && i < pressAt + 3)
      if (stepLocomotion(s, { move: 0, jump }, flat, STEP, CFG).landed) {
        landings++
      }
    }
    // Two landings means the buffered press was honoured on the first.
    expect(landings).toBe(2)
  })

  it('and a press too early is simply forgotten', () => {
    const s = createLocomotion(0)
    let landings = 0
    for (let i = 0; i < 400; i++) {
      // Halfway through the flight: long past the buffer's patience.
      const jump = i < 2 || (i > 45 && i < 49)
      if (stepLocomotion(s, { move: 0, jump }, flat, STEP, CFG).landed) {
        landings++
      }
    }
    expect(landings).toBe(1)
  })
})

describe('falling', () => {
  it('drops through a hole in the floor', () => {
    const s = createLocomotion(-0.5)
    run(s, { move: 1, jump: false }, holed(0, 5), 1.2)
    expect(s.grounded).toBe(false)
    expect(s.y).toBeLessThan(-0.5)
  })

  it('does not exceed the terminal speed', () => {
    const s = createLocomotion(0.5)
    run(s, STILL, () => null, 20)
    expect(s.vy).toBeCloseTo(-CFG.maxFallSpeed, 5)
  })

  it('is gone once it is below the room', () => {
    const s = createLocomotion(0.5)
    expect(hasFallenOut(s, -3)).toBe(false)
    run(s, STILL, () => null, 5)
    expect(hasFallenOut(s, -3)).toBe(true)
  })

  it('lands on a platform on the way down but not on the way up', () => {
    const s = createLocomotion(0)
    // A platform at 0.3, over a floor at 0.
    const ground = (x: number) => (x > -1 && x < 1 ? 0.3 : 0)
    s.y = 0
    s.grounded = false
    // Rising through it: the platform must not catch him.
    s.vy = 2
    stepLocomotion(s, STILL, ground, STEP, CFG)
    expect(s.grounded).toBe(false)
    expect(s.y).toBeGreaterThan(0)
    // Falling onto it: it must.
    run(s, STILL, ground, 2)
    expect(s.grounded).toBe(true)
    expect(s.y).toBeCloseTo(0.3, 5)
  })
})
