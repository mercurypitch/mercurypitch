// ============================================================
// Sing the Universe — melody data integrity and range fitting.
// ============================================================

import { describe, expect, it } from 'vitest'
import { COSMIC_MELODIES, fitMelodyToRange } from './cosmic-melodies'

describe('COSMIC_MELODIES data', () => {
  it('every melody has notes, a name and a source', () => {
    expect(COSMIC_MELODIES.length).toBeGreaterThanOrEqual(3)
    for (const melody of COSMIC_MELODIES) {
      expect(melody.notes.length).toBeGreaterThan(0)
      expect(melody.name.length).toBeGreaterThan(0)
      expect(melody.source.length).toBeGreaterThan(0)
      for (const note of melody.notes) {
        expect(note.beats).toBeGreaterThan(0)
        expect(Math.abs(note.offset)).toBeLessThanOrEqual(12)
      }
    }
  })
})

describe('fitMelodyToRange', () => {
  const melodies = COSMIC_MELODIES

  it('keeps every note inside a comfortable baritone range', () => {
    for (const melody of melodies) {
      const midis = fitMelodyToRange(melody, 43, 67) // G2–G4
      expect(midis).toHaveLength(melody.notes.length)
      for (const midi of midis) {
        expect(midi).toBeGreaterThanOrEqual(43)
        expect(midi).toBeLessThanOrEqual(67)
      }
    }
  })

  it('keeps every note inside a narrow one-octave range', () => {
    for (const melody of melodies) {
      const midis = fitMelodyToRange(melody, 55, 67)
      for (const midi of midis) {
        expect(midi).toBeGreaterThanOrEqual(55)
        expect(midi).toBeLessThanOrEqual(67)
      }
    }
  })

  it('expands sub-octave ranges instead of collapsing melodies', () => {
    // A beginner range of just 4 semitones: notes must stay distinct (no
    // clamp pile-up) and the Perseus pin must survive, at the cost of tones
    // slightly outside the detected range (scoring octave-folds anyway).
    for (const melody of melodies) {
      const midis = fitMelodyToRange(melody, 60, 64)
      const distinctOffsets = new Set(melody.notes.map((n) => n.offset)).size
      expect(new Set(midis).size).toBe(distinctOffsets)
      for (const midi of midis) {
        expect(midi).toBeGreaterThanOrEqual(52)
        expect(midi).toBeLessThanOrEqual(72)
      }
    }
    const perseus = melodies.find((m) => m.id === 'perseus')
    if (perseus) {
      const midis = fitMelodyToRange(perseus, 60, 64)
      expect(((midis[0] % 12) + 12) % 12).toBe(10)
    }
  })

  it('pins the Perseus note to a B♭ whenever the range allows one', () => {
    const perseus = melodies.find((m) => m.id === 'perseus')
    expect(perseus).toBeDefined()
    if (!perseus) return
    const midis = fitMelodyToRange(perseus, 43, 67)
    expect(((midis[0] % 12) + 12) % 12).toBe(10)
  })

  it('preserves melodic intervals when the range is wide enough', () => {
    const orion = melodies.find((m) => m.id === 'orion')
    if (!orion) return
    const midis = fitMelodyToRange(orion, 40, 70)
    for (let i = 1; i < midis.length; i++) {
      expect(midis[i] - midis[i - 1]).toBe(
        orion.notes[i].offset - orion.notes[i - 1].offset,
      )
    }
  })
})
