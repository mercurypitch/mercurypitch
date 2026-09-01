// ============================================================
// Percussion Identity Tests — bounded mappings, never implicit fallbacks
// ============================================================

import { describe, expect, it } from 'vitest'
import { generalMidiPercussionName, isGeneralMidiPercussionChokeTarget, normalizeGeneralMidiPercussionKey, normalizeGuitarProPercussionKey, } from './percussion'

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

describe('isGeneralMidiPercussionChokeTarget', () => {
  it('accepts only the six bounded cymbal lanes used by authored chokes', () => {
    expect(
      [49, 51, 52, 55, 57, 59].every(isGeneralMidiPercussionChokeTarget),
    ).toBe(true)
    expect(isGeneralMidiPercussionChokeTarget(46)).toBe(false)
    expect(isGeneralMidiPercussionChokeTarget(81)).toBe(false)
  })
})

describe('generalMidiPercussionName', () => {
  it('names known keys and labels an unknown key without guessing', () => {
    expect(generalMidiPercussionName(38)).toBe('Acoustic Snare')
    expect(generalMidiPercussionName(200)).toBe('Percussion 200')
  })
})
