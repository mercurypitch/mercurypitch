// ============================================================
// The catalogue: one entry per premium exercise, each its own
// ============================================================

import { describe, expect, it } from 'vitest'
import { catalogueEntry, catalogueGroups, EXERCISE_CATALOGUE, EXERCISE_GROUPS, } from './catalogue'
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

  it("lists a group's entries together, in the headings' order", () => {
    // The picker draws the groups in turn: an entry out of its group's run
    // would move its card away from where the catalogue puts it.
    const grouped = catalogueGroups().flatMap((group) =>
      group.exercises.map((exercise) => exercise.id),
    )

    expect(grouped).toEqual(EXERCISE_CATALOGUE.map((exercise) => exercise.id))
  })

  it('heads the pitch rooms Pitch, the warm-ups Warm-ups and the Ear rooms Ear', () => {
    expect(
      catalogueGroups().map((group) => [
        group.title,
        group.exercises.map((exercise) => exercise.name),
      ]),
    ).toEqual([
      ['Pitch', ['Long note', 'Echo']],
      ['Warm-ups', ['Warm-up', 'Lip roll', 'Ng slides']],
      ['Ear', ['Home note', 'First note', 'Leap']],
    ])
  })

  it('names Home note by its task, with no note of its own to open on', () => {
    const home = catalogueEntry('home-note-lighthouse')
    expect(home?.name).toBe('Home note')
    expect(home?.line).toBe(
      'The band plays an intro. Sing the note that feels like home.',
    )
    expect([home?.note(), home?.demoAutoPlays(), home?.bestOnNote]).toEqual([
      null,
      false,
      false,
    ])
  })

  it('names First note by its task, with no note of its own to open on', () => {
    const first = catalogueEntry('first-note-stage')
    expect(first?.name).toBe('First note')
    expect(first?.line).toBe(
      'A song plays up to the singer. Come in on their first note.',
    )
    expect([first?.note(), first?.demoAutoPlays(), first?.bestOnNote]).toEqual([
      null,
      false,
      false,
    ])
  })

  it('puts every entry under a heading the picker draws', () => {
    const headings = new Set(EXERCISE_GROUPS.map((group) => group.id))

    for (const exercise of EXERCISE_CATALOGUE) {
      expect(headings.has(exercise.group), exercise.name).toBe(true)
    }
  })

  it('heads the Warm-ups with the Warm-up: four stops, then a song', () => {
    const warmUp = catalogueEntry('warm-up-path')
    expect(warmUp?.name).toBe('Warm-up')
    expect(warmUp?.line).toBe('Four stops, about three minutes, then a song.')
    expect([
      warmUp?.note(),
      warmUp?.demoAutoPlays(),
      warmUp?.bestOnNote,
    ]).toEqual([null, false, false])
  })

  it('finds an entry by its id', () => {
    expect(catalogueEntry('long-note-lantern')?.name).toBe('Long note')
    expect(catalogueEntry('echo-stars')?.name).toBe('Echo')
    expect(catalogueEntry('lip-roll-bay')?.name).toBe('Lip roll')
    expect(catalogueEntry('ng-slides-bridge')?.name).toBe('Ng slides')
  })
})
