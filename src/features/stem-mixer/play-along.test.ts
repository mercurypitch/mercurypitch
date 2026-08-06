// Play-along presets — backing-mix composition regression tests.

import { describe, expect, it } from 'vitest'
import { playAlongPresets } from './play-along'

describe('playAlongPresets', () => {
  it('offers sing and generic play roles for a two-stem separation', () => {
    expect(playAlongPresets(['vocal', 'instrumental'])).toEqual([
      {
        id: 'sing',
        label: 'I sing',
        description: 'Mute the guide vocal and keep the backing track.',
        selectedStemKeys: ['vocal', 'instrumental'],
        mutedStemKeys: ['vocal'],
      },
      {
        id: 'play',
        label: 'I play',
        description: 'Mute the backing track and keep the vocal guide.',
        selectedStemKeys: ['vocal', 'instrumental'],
        mutedStemKeys: ['instrumental'],
      },
    ])
  })

  it('reconstructs full-band backing without doubling the instrumental', () => {
    const presets = playAlongPresets([
      'vocal',
      'instrumental',
      'drums',
      'bass',
      'guitar',
      'piano',
      'other',
    ])
    const guitar = presets.find((preset) => preset.id === 'guitar')

    expect(presets.map((preset) => preset.id)).toEqual([
      'sing',
      'drums',
      'bass',
      'guitar',
      'piano',
    ])
    expect(guitar?.selectedStemKeys).toEqual([
      'vocal',
      'drums',
      'bass',
      'guitar',
      'piano',
      'other',
    ])
    expect(guitar?.selectedStemKeys).not.toContain('instrumental')
    expect(guitar?.mutedStemKeys).toEqual(['guitar'])
  })

  it('uses isolated parts as the singing backing when the core mix is absent', () => {
    const sing = playAlongPresets(['vocal', 'drums', 'bass']).find(
      (preset) => preset.id === 'sing',
    )

    expect(sing?.selectedStemKeys).toEqual(['vocal', 'drums', 'bass'])
    expect(sing?.mutedStemKeys).toEqual(['vocal'])
  })

  it('does not expose a residual Other performer role or silent presets', () => {
    expect(playAlongPresets(['other'])).toEqual([])
    expect(
      playAlongPresets(['vocal', 'other']).map((preset) => preset.id),
    ).toEqual(['sing'])
    expect(
      playAlongPresets(['vocal', 'instrumental', 'other']).map(
        (preset) => preset.id,
      ),
    ).toEqual(['sing', 'play'])
  })
})
