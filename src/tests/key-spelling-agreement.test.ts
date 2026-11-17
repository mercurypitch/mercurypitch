// The sheet music view spells by a small table of its own (keySpelling,
// src/lib/key-names.ts), because src/lib cannot import Sight-Singing's
// speller (sight-key.ts). The two must write the twenty-four keys the same
// way, or a line would read differently in the drill and on the sheet.

import { describe, expect, it } from 'vitest'
import { sightKey, spellIn } from '@/features/exercises/sight-singing/sight-key'
import { isMinorScaleType, keyDisplayName, keySpelling, MAJOR_KEYS, MINOR_KEYS, } from '@/lib/key-names'
import { KEY_SIGNATURES, SCALE_DEFINITIONS } from '@/lib/scale-data'
import { notationKeySignature } from '@/lib/sheet-music-renderer'

const CASES = [
  ...MAJOR_KEYS.map((key) => [key, 'major'] as const),
  ...MINOR_KEYS.flatMap((key) =>
    (['natural-minor', 'harmonic-minor', 'melodic-minor'] as const).map(
      (scaleType) => [key, scaleType] as const,
    ),
  ),
]

describe('the sheet and Sight-Singing on the twenty-four keys', () => {
  it('name each key the same', () => {
    for (const [key, scaleType] of CASES) {
      expect(sightKey(key, scaleType).name, `${key} ${scaleType}`).toBe(
        keyDisplayName(key),
      )
    }
  })

  it('give each key the same signature', () => {
    for (const [key, scaleType] of CASES) {
      const sight = sightKey(key, scaleType).sig
      const sheet = KEY_SIGNATURES[notationKeySignature(key, scaleType)]
      expect(
        {
          sharps: sight.sign === 'sharp' ? sight.count : 0,
          flats: sight.sign === 'flat' ? sight.count : 0,
        },
        `${key} ${scaleType}`,
      ).toEqual(sheet)
    }
  })

  it("write each of the scale's notes on the same letter with the same sign", () => {
    for (const [key, scaleType] of CASES) {
      const sight = sightKey(key, scaleType)
      const sheet = keySpelling(key, scaleType)
      for (const degree of SCALE_DEFINITIONS[scaleType].degrees) {
        const midi = 60 + sight.pc + degree
        const { letter, alter } = spellIn(sight, midi)
        expect(sheet[midi % 12], `${key} ${scaleType} +${degree}`).toEqual({
          letter,
          alter,
        })
      }
    }
  })

  it("agree on which of the pickers' scales are a minor key's, mode by mode apart", () => {
    // Sight-Singing also gives the modes with a minor third a minor key's
    // signature; the sheet, and so the pickers, keep those on the major key
    // of their do. The four minor scales are where both say minor.
    for (const scaleType of [
      'natural-minor',
      'harmonic-minor',
      'melodic-minor',
      'pentatonic-minor',
    ]) {
      expect(isMinorScaleType(scaleType), scaleType).toBe(true)
      expect(sightKey('A', scaleType).minor, scaleType).toBe(true)
    }
    expect(isMinorScaleType('major')).toBe(false)
    expect(sightKey('C', 'major').minor).toBe(false)
  })
})
