import { describe, expect, it, vi } from 'vitest'
import { resultMoment } from './long-note-run'

vi.mock('@/stores/exercise-history-store', () => ({
  recordExerciseResult: () => undefined,
}))

describe('resultMoment', () => {
  it('celebrates nothing on a take that never locked, which keepRun drops', () => {
    // Review A of PR 973, M2: whatever the room reached on the way, a take
    // with no lock keeps nothing, so its result cannot cheer.
    for (const improved of [false, true]) {
      for (const full of [false, true]) {
        for (const brim of [false, true]) {
          expect(resultMoment(improved, full, brim, false)).toBe('missed')
        }
      }
    }
  })

  it('names the best thing a kept run did: the brim, a best, the goal', () => {
    expect(resultMoment(true, true, true, true)).toBe('resultBrim')
    expect(resultMoment(true, true, false, true)).toBe('newBest')
    expect(resultMoment(false, true, false, true)).toBe('resultFull')
    expect(resultMoment(false, false, false, true)).toBe('result')
  })
})
