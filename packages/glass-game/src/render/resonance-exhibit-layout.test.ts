// Resonance exhibit presentation tests — tuning binds once to an existing capable recipe.

import { expect, it } from 'vitest'
import { CLOUDWAY_THAWING_SONG } from '../content/cloudway-thawing-song'
import { resolveResonanceExhibitPresentations } from './resonance-exhibit-layout'

it('resolves the three Thawing Song Rosebud presets by encounter', () => {
  const presentations = resolveResonanceExhibitPresentations(
    CLOUDWAY_THAWING_SONG,
  )
  expect([...presentations]).toEqual([
    [
      'thaw-note-home',
      expect.objectContaining({ seed: 20_260_930, intensity: 0.78 }),
    ],
    [
      'thaw-note-crown',
      expect.objectContaining({ seed: 20_260_931, intensity: 1 }),
    ],
    [
      'thaw-note-homecoming',
      expect.objectContaining({ seed: 20_260_932, intensity: 0.88 }),
    ],
  ])
})

it('rejects duplicate, orphaned, and unsupported encounter presets', () => {
  const level = CLOUDWAY_THAWING_SONG
  const presentation = level.presentation!.resonanceExhibits![0]!
  const withPresentations = (
    resonanceExhibits: NonNullable<
      NonNullable<typeof level.presentation>['resonanceExhibits']
    >,
  ) => ({
    ...level,
    presentation: { ...level.presentation!, resonanceExhibits },
  })

  expect(() =>
    resolveResonanceExhibitPresentations(
      withPresentations([presentation, presentation]),
    ),
  ).toThrow(/duplicate tuning/)
  expect(() =>
    resolveResonanceExhibitPresentations(
      withPresentations([
        { ...presentation, encounterId: 'missing-encounter' },
      ]),
    ),
  ).toThrow(/does not exist/)
  expect(() =>
    resolveResonanceExhibitPresentations(
      withPresentations([{ ...presentation, encounterId: 'thaw-gate-rise' }]),
    ),
  ).toThrow(/does not support Resonance/)
})
