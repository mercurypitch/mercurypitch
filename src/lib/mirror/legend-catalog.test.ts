// ============================================================
// Voice Mirror legend catalogue — roster and band invariants.
// ============================================================

import { describe, expect, it } from 'vitest'
import { VOICE_LEGENDS, VOICE_TYPE_BANDS } from './legend-catalog'

describe('VOICE_TYPE_BANDS', () => {
  it('contains the six broad voice bands in stable low-to-high order', () => {
    expect(VOICE_TYPE_BANDS.map((band) => band.id)).toEqual([
      'Bass',
      'Baritone',
      'Tenor',
      'Alto',
      'Mezzo-soprano',
      'Soprano',
    ])
    for (const band of VOICE_TYPE_BANDS) {
      expect(band.lowMidi).toBeLessThan(band.highMidi)
      expect(band.rangeLabel).not.toBe('')
    }
  })
})

describe('VOICE_LEGENDS', () => {
  it('contains all 21 legends in their broad catalogue bands', () => {
    expect(
      Object.fromEntries(
        VOICE_TYPE_BANDS.map((band) => [
          band.id,
          VOICE_LEGENDS.filter((legend) => legend.band === band.id).map(
            (legend) => legend.name,
          ),
        ]),
      ),
    ).toEqual({
      Bass: ['Johnny Cash', 'Barry White', 'Louis Armstrong'],
      Baritone: [
        'Elvis Presley',
        'Frank Sinatra',
        'Kurt Cobain',
        'David Bowie',
      ],
      Tenor: [
        'Freddie Mercury',
        'Bruce Dickinson',
        'Michael Jackson',
        'Prince',
        'Luciano Pavarotti',
      ],
      Alto: ['Amy Winehouse', 'Cher', 'Nina Simone'],
      'Mezzo-soprano': ['Adele', 'Whitney Houston', 'Aretha Franklin'],
      Soprano: ['Mariah Carey', 'Celine Dion', 'Ariana Grande'],
    })
    expect(VOICE_LEGENDS).toHaveLength(21)
  })

  it('keeps every stable id, persisted name, and portrait unique', () => {
    const ids = VOICE_LEGENDS.map((legend) => legend.id)
    const names = VOICE_LEGENDS.map((legend) => legend.name)
    const imageSources = VOICE_LEGENDS.map((legend) => legend.imageSrc)

    expect(new Set(ids).size).toBe(ids.length)
    expect(new Set(names).size).toBe(names.length)
    expect(new Set(imageSources).size).toBe(imageSources.length)
    expect(imageSources.every((source) => source.startsWith('/legends/'))).toBe(
      true,
    )
  })
})
