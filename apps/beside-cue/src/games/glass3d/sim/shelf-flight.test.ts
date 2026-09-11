// How long a leap is in the air, and how far it carries him.
// ============================================================
//
// Two numbers the plan did not state and the stage lives by
// (docs/games/top-shelf.md §11, 6b): a leap that lands is short, because
// the catch takes him at the apex, and a leap reaches a riser only from
// close by, because the carry is walking pace. Stepped as the stage
// steps him: the voice launches him, then the wall, then the step.

import { describe, expect, it } from 'vitest'
import { groundFor, leapHeight, MITT_SPAN, riserWallAt, SHELF_1, topsOf, } from '../levels/shelf'
import { WORLD3D_CONFIG } from '../world3d-config'
import { createLocomotion, leapVelocity, stepLocomotion } from './locomotion3d'

const CFG = WORLD3D_CONFIG.locomotion
const DT = WORLD3D_CONFIG.loop.stepSeconds
const HALF = MITT_SPAN / 2
const RISER = SHELF_1.shelves[1]!.from
/** Where the wall pins him before a leap: his mitt on the riser. */
const AT_RISER = RISER - HALF
const LIP = topsOf(SHELF_1)[1]!

/** A leap of `semis` from a standstill at `x` on room 1's floor, carried
 * toward the shelf at walking pace. Where and when he comes down. */
const fly = (x: number, semis: number) => {
  const s = createLocomotion(x)
  s.vy = leapVelocity(leapHeight(0, semis)!, CFG, DT)
  s.grounded = false
  const ground = groundFor(SHELF_1, HALF)
  let t = 0
  do {
    const wall = riserWallAt(SHELF_1, s.x, s.y, HALF)
    const walls = {
      ...CFG,
      minX: HALF,
      maxX: Math.min(SHELF_1.length - HALF, wall),
    }
    stepLocomotion(s, { move: 1, jump: false }, ground, DT, walls)
    t += DT
  } while (!s.grounded && t < 3)
  return { t, x: s.x, y: s.y }
}

describe('a leap in the air', () => {
  it('lands at its apex when it is exact: under half a second aloft', () => {
    const up = fly(AT_RISER, 7)
    expect(up.y).toBeCloseTo(LIP, 9)
    expect(up.t).toBeCloseTo(0.48, 2)
  })

  it('comes back down in twice that when it lands nowhere', () => {
    const hop = fly(SHELF_1.startX, 7)
    expect(hop.y).toBe(0)
    expect(hop.t).toBeCloseTo(0.96, 2)
  })
})

describe('the carry', () => {
  /** The furthest a fifth can be sung from the riser, to the centimetre,
   * and still land on the shelf. */
  const reach = (): number => {
    let d = 0
    while (fly(AT_RISER - (d + 0.01), 7).y === LIP) d += 0.01
    return d
  }

  it('takes a fifth to the shelf from 0.62 m short of the riser, and no further', () => {
    expect(reach()).toBeCloseTo(0.62, 2)
  })

  it('so a fifth sung at room 1 start line is a hop that lands 0.3 m short', () => {
    expect(AT_RISER - SHELF_1.startX).toBeCloseTo(1.335, 3)
    const hop = fly(SHELF_1.startX, 7)
    expect(hop.y).toBe(0)
    expect(AT_RISER - hop.x).toBeCloseTo(0.3, 1)
  })
})
