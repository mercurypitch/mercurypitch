// ============================================================
// The premium exercises' level: Beginner, Singer or Pro
// ============================================================
//
// The level is read from storage when it is first read, so each case seeds
// storage and loads the module fresh.

import { beforeEach, describe, expect, it, vi } from 'vitest'

beforeEach(() => {
  localStorage.clear()
  vi.resetModules()
})

async function load(stored?: string) {
  if (stored !== undefined) {
    localStorage.setItem('pitchperfect_premium_exercise_level', stored)
  }
  return import('./exercise-level')
}

describe('the exercise level', () => {
  it('is Beginner for a singer who never picked one', async () => {
    const { exerciseLevel } = await load()

    expect(exerciseLevel()).toBe('beginner')
  })

  it('is kept as its bare id under a key the settings sync carries', async () => {
    const { exerciseLevel, setExerciseLevel, EXERCISE_LEVEL_KEY } = await load()

    setExerciseLevel('pro')

    expect(exerciseLevel()).toBe('pro')
    expect(EXERCISE_LEVEL_KEY).toBe('pitchperfect_premium_exercise_level')
    expect(localStorage.getItem(EXERCISE_LEVEL_KEY)).toBe('pro')
  })

  it('opens on the level picked before', async () => {
    const { exerciseLevel } = await load('singer')

    expect(exerciseLevel()).toBe('singer')
  })

  it('reads a level it does not know as Beginner', async () => {
    const { exerciseLevel } = await load('legend')

    expect(exerciseLevel()).toBe('beginner')
  })

  it('takes the level another device picked when the account brings it', async () => {
    const { exerciseLevel } = await load()
    const { applyPersistedValue } = await import('@/lib/storage')
    expect(exerciseLevel()).toBe('beginner')

    applyPersistedValue('pitchperfect_premium_exercise_level', 'singer')

    expect(exerciseLevel()).toBe('singer')
  })

  it('names the three levels in order, easiest first', async () => {
    const { EXERCISE_LEVELS, exerciseLevelName } = await load()

    expect(EXERCISE_LEVELS.map(exerciseLevelName)).toEqual([
      'Beginner',
      'Singer',
      'Pro',
    ])
  })
})
