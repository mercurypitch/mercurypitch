// ============================================================
// The premium exercises' level: Beginner, Singer or Pro
// ============================================================
//
// The level is read from storage when it is first read, so each case seeds
// storage and loads the module fresh.

import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const SRC = resolve(__dirname, '..')

/** Every .ts and .tsx file under `dir`. */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(path)
    return /\.tsx?$/.test(entry.name) ? [path] : []
  })
}

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

  it('is the one module that knows where the level lives', () => {
    // Where the level comes from may change (the accuracy tier in
    // Settings is one candidate). Then this module changes, and the bundle
    // check's marker for it, and nothing else: every other file, tests
    // too, reads and sets the level through exerciseLevel and
    // setExerciseLevel.
    const key = 'pitchperfect_premium_exercise_level'
    const naming = sourceFiles(SRC)
      .filter((file) => readFileSync(file, 'utf8').includes(key))
      .map((file) => relative(SRC, file))
      .sort()

    expect(naming).toEqual([
      'lib/exercise-level.test.ts',
      'lib/exercise-level.ts',
    ])
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
