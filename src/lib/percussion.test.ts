// ============================================================
// Percussion Identity Tests — bounded mappings, never implicit fallbacks
// ============================================================

import { describe, expect, it } from 'vitest'
import { generalMidiPercussionName, normalizeGeneralMidiPercussionKey, normalizeGuitarProPercussionKey, } from './percussion'

describe('normalizeGeneralMidiPercussionKey', () => {
  it('keeps the bounded General MIDI map unchanged', () => {
    expect(normalizeGeneralMidiPercussionKey(35)).toBe(35)
    expect(normalizeGeneralMidiPercussionKey(81)).toBe(81)
  })

  it('drops unknown and non-integral identities', () => {
    expect(normalizeGeneralMidiPercussionKey(32)).toBeNull()
    expect(normalizeGeneralMidiPercussionKey(91)).toBeNull()
    expect(normalizeGeneralMidiPercussionKey(38.5)).toBeNull()
  })
})

describe('normalizeGuitarProPercussionKey', () => {
  it('uses documented folds only at a Guitar Pro source boundary', () => {
    expect(normalizeGuitarProPercussionKey(29)).toBe(59)
    expect(normalizeGuitarProPercussionKey(91)).toBe(38)
    expect(normalizeGuitarProPercussionKey(127)).toBe(59)
  })

  it('keeps ordinary GM articulations and drops unknown identities', () => {
    expect(normalizeGuitarProPercussionKey(38)).toBe(38)
    expect(normalizeGuitarProPercussionKey(32)).toBeNull()
  })
})

describe('generalMidiPercussionName', () => {
  it('names known keys and labels an unknown key without guessing', () => {
    expect(generalMidiPercussionName(38)).toBe('Acoustic Snare')
    expect(generalMidiPercussionName(200)).toBe('Percussion 200')
  })
})
