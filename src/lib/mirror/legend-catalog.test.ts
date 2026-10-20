// ============================================================
// Voice Mirror legend catalogue — roster and band invariants.
// ============================================================

import { describe, expect, it } from 'vitest'
import { BASS_BARITONE, VOICE_LEGENDS, VOICE_TYPE_BANDS, voiceTypeBand, } from './legend-catalog'

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
  it('contains all 31 legends in their broad catalogue bands', () => {
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
      Bass: ['Johnny Cash', 'Barry White', 'Louis Armstrong', 'Paul Robeson'],
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
        'Nusrat Fateh Ali Khan',
      ],
      Alto: [
        'Amy Winehouse',
        'Cher',
        'Nina Simone',
        'Umm Kulthum',
        'Miriam Makeba',
        'Billie Holiday',
        'Patti Smith',
      ],
      'Mezzo-soprano': [
        'Adele',
        'Whitney Houston',
        'Aretha Franklin',
        'Édith Piaf',
        'Lady Gaga',
        'PJ Harvey',
      ],
      Soprano: ['Mariah Carey', 'Celine Dion', 'Ariana Grande', 'Dolly Parton'],
    })
    expect(VOICE_LEGENDS).toHaveLength(31)
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

describe('voiceTypeBand', () => {
  it('is the band itself for every band', () => {
    for (const band of VOICE_TYPE_BANDS) {
      expect(voiceTypeBand(band.id)).toBe(band.id)
    }
  })

  it('draws a bass-baritone on Bass, where its twins come from', () => {
    expect(voiceTypeBand(BASS_BARITONE)).toBe('Bass')
  })

  it('knows no band for a name no band carries', () => {
    expect(voiceTypeBand('Countertenor')).toBeNull()
    expect(voiceTypeBand(null)).toBeNull()
  })
})
