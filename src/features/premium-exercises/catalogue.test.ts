// ============================================================
// The catalogue: one entry per premium exercise, each its own
// ============================================================

import { describe, expect, it } from 'vitest'
import { catalogueEntry, EXERCISE_CATALOGUE } from './catalogue'
import { PREMIUM_EXERCISE_IDS } from './ids'

describe('the exercise catalogue', () => {
  it('has exactly one entry for every premium exercise id', () => {
    const ids = EXERCISE_CATALOGUE.map((exercise) => exercise.id)

    expect([...ids].sort()).toEqual([...PREMIUM_EXERCISE_IDS].sort())
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('gives every exercise a name of its own', () => {
    const names = EXERCISE_CATALOGUE.map((exercise) => exercise.name)

    expect(new Set(names).size).toBe(names.length)
  })

  it('finds an entry by its id', () => {
    expect(catalogueEntry('long-note-lantern')?.name).toBe('Long note')
    expect(catalogueEntry('echo-stars')?.name).toBe('Echo')
  })
})
