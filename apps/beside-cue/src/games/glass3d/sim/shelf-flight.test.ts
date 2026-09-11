// How long a leap is in the air, and how far a hop carries him.
// ============================================================
//
// Two numbers the plan did not state and the stage lives by
// (docs/games/top-shelf.md §11, 6b): a leap that lands is short, because
// the catch takes him at the apex, and a hop reaches a riser only from
// close by, because its carry is walking pace -- which is why a leap in
// reach of a riser is aimed at it instead (`leapCarry`, §3.2). Stepped
// as the stage steps a hop: the voice launches him, then the wall, then
// the step.

import { describe, expect, it } from 'vitest'
import type { ShelfLevel } from '../levels/shelf'
import { groundFor, LEAP_REACH, leapCarry, leapHeight, MITT_SPAN, riserWallAt, SHELF_1, SHELF_2, topsOf, } from '../levels/shelf'
import { WORLD3D_CONFIG } from '../world3d-config'
import { createLocomotion, leapVelocity, stepLocomotion } from './locomotion3d'

const CFG = WORLD3D_CONFIG.locomotion
const DT = WORLD3D_CONFIG.loop.stepSeconds
const HALF = MITT_SPAN / 2
const RISER = SHELF_1.shelves[1]!.from
/** Where the wall pins him before a leap: his mitt on the riser. */
const AT_RISER = RISER - HALF
const LIP = topsOf(SHELF_1)[1]!

/** A leap of `semis` from a standstill at `x`, on the shelf whose top is
 * `y`, carried toward the next at walking pace: a hop. Where and when he
 * comes down. Room 1's floor unless told otherwise. */
const fly = (x: number, semis: number, room = SHELF_1, y = 0) => {
  const s = createLocomotion(x)
  s.y = y
  s.vy = leapVelocity(leapHeight(0, semis)!, CFG, DT)
  s.grounded = false
  const ground = groundFor(room, HALF)
  let t = 0
  do {
    const wall = riserWallAt(room, s.x, s.y, HALF)
    const walls = {
      ...CFG,
      minX: HALF,
      maxX: Math.min(room.length - HALF, wall),
    }
    stepLocomotion(s, { move: 1, jump: false }, ground, DT, walls)
    t += DT
  } while (!s.grounded && t < 3)
  return { t, x: s.x, y: s.y }
}

/** Room 1 with its riser swapped for one of `semis`, so every ask can
 * be flown at the same riser. */
const stairOf = (semis: number): ShelfLevel => ({
  ...SHELF_1,
  shelves: [SHELF_1.shelves[0]!, { ...SHELF_1.shelves[1]!, rise: semis }],
})

/** The furthest short of the riser a leap of exactly its rise can be
 * sung, to the centimetre, and still land on it. */
const reach = (semis: number): number => {
  const room = stairOf(semis)
  const lip = topsOf(room)[1]!
  let d = 0
  while (fly(AT_RISER - (d + 0.01), semis, room).y === lip) d += 0.01
  return d
}

describe('a leap in the air', () => {
  it('lands at its apex when it is exact: under half a second aloft', () => {
    const up = fly(AT_RISER, 7)
    expect(up.y).toBeCloseTo(LIP, 9)
    expect(up.t).toBeCloseTo(0.48, 2)
  })

  it('comes back down in twice that when it lands nowhere', () => {
    // From room 1's back wall, 1.47 m out: beyond reach, so a hop.
    const hop = fly(HALF, 7)
    expect(hop.y).toBe(0)
    expect(hop.t).toBeCloseTo(0.96, 2)
  })
})

describe('the carry of a hop', () => {
  it('takes a fifth to the shelf from 0.62 m short of the riser, and no further', () => {
    expect(reach(7)).toBeCloseTo(0.62, 2)
  })

  it('takes a smaller leap less far: it is in the air for less', () => {
    const cm = (m: number): number => Math.round(m * 100)
    expect([3, 4, 5, 7].map((semis) => cm(reach(semis)))).toEqual([
      43, 48, 53, 62,
    ])
  })

  it('so as a hop, room 2 minor third sung where the last leap left him falls short, and the stage aims it instead (§11)', () => {
    // The carry walks him on until all of him is past the lip (6b); on
    // a shelf 1.0 m deep that leaves his mitt 0.47 m short of the next
    // riser, and a minor third carries 0.43.
    const tops = topsOf(SHELF_2)
    const riser = SHELF_2.shelves[3]!
    expect(riser.rise).toBe(3)
    const boarded = SHELF_2.shelves[2]!.from + HALF
    expect(riser.from - HALF - boarded).toBeCloseTo(0.47, 9)
    const hop = fly(boarded, 3, SHELF_2, tops[2])
    expect(hop.y).toBe(tops[2])
    // Walked to the riser first, the same third lands.
    expect(fly(riser.from - HALF, 3, SHELF_2, tops[2]).y).toBe(tops[3])
    // 0.47 m is in reach, so the stage never flies it as a hop.
    expect(
      leapCarry(SHELF_2, boarded, tops[2]!, 0.3, CFG.gravity, HALF),
    ).not.toBeNull()
  })

  it('as it would a fifth from room 1 start line, 0.9 m out: past any hop, inside the reach (§11)', () => {
    expect(AT_RISER - SHELF_1.startX).toBeCloseTo(0.9, 9)
    expect(AT_RISER - SHELF_1.startX).toBeLessThanOrEqual(LEAP_REACH)
    expect(fly(SHELF_1.startX, 7).y).toBe(0)
    expect(
      leapCarry(SHELF_1, SHELF_1.startX, 0, LIP, CFG.gravity, HALF),
    ).not.toBeNull()
  })
})
