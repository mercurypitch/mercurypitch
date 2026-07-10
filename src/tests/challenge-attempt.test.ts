import { describe, expect, it } from 'vitest'
import { computeAttemptOutcome } from '@/features/challenges/challenge-attempt'

describe('computeAttemptOutcome', () => {
  it('first attempt below target stays active', () => {
    const out = computeAttemptOutcome(null, 60, 75)
    expect(out).toEqual({
      attempts: 1,
      bestScore: 60,
      progress: 60,
      status: 'active',
      completed: false,
      newlyCompleted: false,
    })
  })

  it('meeting the target on a single run completes', () => {
    const out = computeAttemptOutcome(
      { attempts: 2, bestScore: 70, completed: false },
      80,
      75,
    )
    expect(out.attempts).toBe(3)
    expect(out.bestScore).toBe(80)
    expect(out.status).toBe('completed')
    expect(out.completed).toBe(true)
    expect(out.newlyCompleted).toBe(true)
  })

  it('exactly hitting the target counts', () => {
    const out = computeAttemptOutcome(null, 75, 75)
    expect(out.completed).toBe(true)
    expect(out.newlyCompleted).toBe(true)
  })

  it('a stale bestScore above target does NOT complete (only a real run does)', () => {
    // Legacy seeded rows carried invented bests — a new low-scoring attempt
    // must not complete the challenge off stale data.
    const out = computeAttemptOutcome(
      { attempts: 4, bestScore: 92, completed: false },
      50,
      90,
    )
    expect(out.completed).toBe(false)
    expect(out.newlyCompleted).toBe(false)
    expect(out.bestScore).toBe(92)
    expect(out.attempts).toBe(5)
  })

  it('an already-completed challenge stays completed and keeps counting attempts', () => {
    const out = computeAttemptOutcome(
      { attempts: 3, bestScore: 85, completed: true },
      40,
      75,
    )
    expect(out.completed).toBe(true)
    expect(out.newlyCompleted).toBe(false)
    expect(out.status).toBe('completed')
    expect(out.attempts).toBe(4)
    expect(out.bestScore).toBe(85)
  })

  it('a retry can still raise the best score after completion', () => {
    const out = computeAttemptOutcome(
      { attempts: 3, bestScore: 85, completed: true },
      95,
      75,
    )
    expect(out.bestScore).toBe(95)
    expect(out.newlyCompleted).toBe(false)
  })

  it('clamps scores into 0-100', () => {
    expect(computeAttemptOutcome(null, 140, 75).bestScore).toBe(100)
    expect(computeAttemptOutcome(null, -10, 75).bestScore).toBe(0)
    expect(computeAttemptOutcome(null, 79.6, 80).completed).toBe(true) // rounds
  })

  it('progress mirrors best score capped at 100', () => {
    expect(computeAttemptOutcome(null, 64, 90).progress).toBe(64)
    expect(
      computeAttemptOutcome(
        { attempts: 1, bestScore: 98, completed: true },
        20,
        90,
      ).progress,
    ).toBe(98)
  })
})
