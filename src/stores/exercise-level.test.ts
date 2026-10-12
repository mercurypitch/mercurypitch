// ============================================================
// The premium exercises' level: the accuracy tier from Settings
// ============================================================
//
// Owner, 12 Oct 2026: the level is the accuracy tier Settings already
// has, mapped through to the premium exercises. Each case loads the
// settings store fresh on empty storage.

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

async function load() {
  const level = await import('./exercise-level')
  const settings = await import('@/stores/settings-store')
  return { ...level, ...settings }
}

describe('the exercise level', () => {
  it('is the accuracy tier: Singer for a singer who never picked one', async () => {
    const { accuracyTier, exerciseLevel } = await load()

    expect(exerciseLevel()).toBe('singer')
    expect(exerciseLevel()).toBe(accuracyTier())
  })

  it('follows the tier Settings picks', async () => {
    const { applyAccuracyTier, exerciseLevel } = await load()

    applyAccuracyTier('professional')
    expect(exerciseLevel()).toBe('professional')
    applyAccuracyTier('learning')
    expect(exerciseLevel()).toBe('learning')
  })

  it('sets the tier as Settings does: the mic preset and the score mode follow', async () => {
    const level = await load()

    level.setExerciseLevel('professional')

    expect(level.accuracyTier()).toBe('professional')
    expect(level.sensitivityPreset()).toBe('noisy')
    expect(level.scoreMode()).toBe('full')
    // Exactly what Settings' own control leaves behind.
    const viaLevel = {
      settings: level.settings(),
      preset: level.sensitivityPreset(),
      mode: level.scoreMode(),
    }
    level.applyAccuracyTier('learning')
    level.applyAccuracyTier('professional')
    expect({
      settings: level.settings(),
      preset: level.sensitivityPreset(),
      mode: level.scoreMode(),
    }).toEqual(viaLevel)
  })

  it('takes the tier another device picked when the account brings it', async () => {
    const { exerciseLevel } = await load()
    const { applyPersistedValue } = await import('@/lib/storage')

    applyPersistedValue('pitchperfect_accuracy_tier', 'learning')

    expect(exerciseLevel()).toBe('learning')
  })

  it('reads a tier it does not know as Singer', async () => {
    localStorage.setItem('pitchperfect_accuracy_tier', 'legend')
    const { exerciseLevel, exerciseLevelName } = await load()

    expect(exerciseLevel()).toBe('singer')
    expect(exerciseLevelName(exerciseLevel())).toBe('Singer')
  })

  it('names the levels as Settings names the tiers, Learning first', async () => {
    const { EXERCISE_LEVELS, exerciseLevelName, getAccuracyTierInfo } =
      await load()

    expect(EXERCISE_LEVELS.map(exerciseLevelName)).toEqual([
      'Learning',
      'Singer',
      'Professional',
    ])
    expect(EXERCISE_LEVELS.map(exerciseLevelName)).toEqual(
      EXERCISE_LEVELS.map((tier) => getAccuracyTierInfo(tier).label),
    )
  })

  it('is the one way the premium exercises reach the tier', () => {
    // Long note, the picker and the hold engine read and set the level
    // through exerciseLevel and setExerciseLevel, never the tier itself:
    // one module maps the tier to the premium exercises. And the level's
    // own key, which never shipped, is gone.
    const tier =
      /\b(accuracyTier|applyAccuracyTier|_setAccuracyTier|getAccuracyTierInfo|AccuracyTier)\b|pitchperfect_accuracy_tier/
    const reaching = [
      'features/long-note',
      'features/premium-exercises',
      'lib/hold',
    ]
      .flatMap((dir) => sourceFiles(join(SRC, dir)))
      .filter((file) => !/\.(test|spec)\.tsx?$/.test(file))
      .filter((file) => tier.test(readFileSync(file, 'utf8')))
      .map((file) => relative(SRC, file))
    expect(reaching).toEqual([])

    const ownKey = ['pitchperfect', 'premium', 'exercise', 'level'].join('_')
    const naming = sourceFiles(SRC)
      .filter((file) => readFileSync(file, 'utf8').includes(ownKey))
      .map((file) => relative(SRC, file))
    expect(naming).toEqual([])
  })
})
