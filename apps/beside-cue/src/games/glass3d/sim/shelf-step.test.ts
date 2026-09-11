// The Top Shelf's step, driven as the stage drives it.
// ============================================================
//
// `stepShelf` fed a note and a thumb a step at a time, at the loop's own
// rate, on the body the rooms are tested on: the review of 6d, each
// finding reproduced where the stage runs it.

import { describe, expect, it } from 'vitest'
import type { ShelfLevel } from '../levels/shelf'
import { MITT_SPAN, SHELF_1, SHELF_3, topsOf } from '../levels/shelf'
import { WORLD3D_CONFIG } from '../world3d-config'
import { NO_LEAPS } from './shelf-grade'
import type { ShelfClimb, ShelfStep } from './shelf-step'
import { closeWalls, createClimb, stepShelf } from './shelf-step'

const CFG = WORLD3D_CONFIG.locomotion
const DT = WORLD3D_CONFIG.loop.stepSeconds
const HALF = MITT_SPAN / 2

/** Sing `midi`, or nothing, for `seconds` with the thumb at `thumb`:
 * what each step reported. */
const sing = (
  climb: ShelfClimb,
  midi: number | null,
  seconds: number,
  thumb = 0,
): ShelfStep[] => {
  const out: ShelfStep[] = []
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    out.push(stepShelf(climb, midi, thumb, DT))
  }
  return out
}

/** Him standing on shelf `k` of `room` at `x`, from its door otherwise:
 * no reference yet, nothing graded. */
const standAt = (room: ShelfLevel, k: number, x: number): ShelfClimb => {
  const climb = createClimb(room, CFG)
  climb.loco.x = x
  climb.loco.y = topsOf(room)[k]!
  climb.standingOn = k
  closeWalls(climb)
  return climb
}

describe('a stop a few cents above the reference', () => {
  it('fires nothing at room 3 octave riser from the ledge, and grades nothing', () => {
    const climb = createClimb(SHELF_3, CFG)
    sing(climb, 57, 0.3)
    // A fifth from the start line, onto the ledge, and held there.
    sing(climb, 64, 1.5)
    expect(climb).toMatchObject({ standingOn: 1, leaps: 1 })
    // Its tail flicks up 0.6 of a semitone for 30 ms, and settles 20
    // cents sharp.
    sing(climb, 64.6, 0.03)
    sing(climb, 64.2, 0.5)
    expect(climb.leaps).toBe(1)
    expect(climb.grades[1]).toEqual(NO_LEAPS)
    expect(climb.loco.y).toBe(topsOf(SHELF_3)[1])
    expect(climb.voice.reference).toBe(64.2)
    expect(climb.readying).toBe(true)
  })
})

// A leap is aimed at a shelf when his mitt reaches its riser on the way
// up (`sim/shelf-grade`). Beyond `LEAP_REACH` it is a hop at walking
// pace, and a sharp one flies long enough to meet room 1's riser falling.
describe('a hop that meets the riser on the way down', () => {
  it('is aimed at nothing and not graded: room 1, 1.01 to 1.1 m out, a fifth sung 1.5 or 2 semitones sharp', () => {
    const riser = SHELF_1.shelves[1]!.from
    for (let cm = 101; cm <= 110; cm++) {
      for (const semis of [8.5, 9]) {
        const name = `${String(cm)} cm out, ${String(semis)} semitones`
        const climb = standAt(SHELF_1, 0, riser - HALF - cm / 100)
        sing(climb, 57, 0.3)
        sing(climb, 57 + semis, 1.5)
        expect(climb.leaps, name).toBe(1)
        // Down on the floor at the foot of the riser: it met it.
        expect(climb.loco.y, name).toBe(0)
        expect(climb.loco.x, name).toBeCloseTo(riser - HALF, 6)
        expect(climb.grades[0], name).toEqual(NO_LEAPS)
      }
    }
  })
})
