// The Top Shelf's step, driven as the stage drives it.
// ============================================================
//
// `stepShelf` fed a note and a thumb a step at a time, at the loop's own
// rate, on the body the rooms are tested on: the review of 6d, each
// finding reproduced where the stage runs it.

import { describe, expect, it } from 'vitest'
import { SHELF_3, topsOf } from '../levels/shelf'
import { WORLD3D_CONFIG } from '../world3d-config'
import { NO_LEAPS } from './shelf-grade'
import type { ShelfClimb, ShelfStep } from './shelf-step'
import { createClimb, stepShelf } from './shelf-step'

const CFG = WORLD3D_CONFIG.locomotion
const DT = WORLD3D_CONFIG.loop.stepSeconds

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
