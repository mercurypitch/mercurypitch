import { describe, expect, it, vi } from 'vitest'
import type { HoldState } from '@/lib/hold/hold-engine'
import { createHoldState } from '@/lib/hold/hold-engine'
import { resultMoment } from './long-note-run'

vi.mock('@/stores/exercise-history-store', () => ({
  recordExerciseResult: () => undefined,
}))

/** A finished take's engine, with what the lantern reached. */
const ended = (reached: Partial<HoldState>): HoldState => ({
  ...createHoldState(),
  phase: 'ended',
  ...reached,
})

describe('resultMoment', () => {
  it('celebrates nothing on a take that never locked, which keepRun drops', () => {
    // Review A of PR 973, M2: whatever the room reached on the way, a take
    // with no lock keeps nothing, so its result cannot cheer.
    for (const improved of [false, true]) {
      for (const goalReached of [false, true]) {
        for (const brimReached of [false, true]) {
          expect(
            resultMoment(improved, ended({ goalReached, brimReached }), false),
          ).toBe('missed')
        }
      }
    }
  })

  it('names the best thing a kept run did: the brim, a best, the goal', () => {
    const brim = ended({ goalReached: true, brimReached: true, reach: 1 })
    const goal = ended({ goalReached: true, reach: 1, topCharge: 0.3 })
    expect(resultMoment(true, brim, true)).toBe('resultBrim')
    expect(resultMoment(true, goal, true)).toBe('newBest')
    expect(resultMoment(false, goal, true)).toBe('resultLonger')
    expect(resultMoment(false, ended({}), true)).toBe('result')
  })

  it('says why the brim did not come: the note ended, or the top had stopped', () => {
    // Steady enough for the brim at this level, but the note ended first.
    expect(
      resultMoment(
        false,
        ended({ goalReached: true, reach: 1, topCharge: 0.5 }),
        true,
      ),
    ).toBe('resultLonger')
    // Not steady enough for the brim at this level, however long it went:
    // the top had filled as far as the voice let it, or not even that.
    for (const topCharge of [0.4, 0.25]) {
      expect(
        resultMoment(
          false,
          ended({ goalReached: true, reach: 0.4, topCharge }),
          true,
        ),
      ).toBe('resultSteadier')
    }
  })
})
