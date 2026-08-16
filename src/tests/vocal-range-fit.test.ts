// ============================================================
// Drills land in the singer's range
// ============================================================
//
// The owner's repro was deterministic: apply-phrase eight (London Bridge)
// starts on G4, the routine passed it verbatim, and call-response walked a
// baritone from G4 into the fifth octave. `apply-melodies.ts` had claimed
// since it was written that "the exercise engine … can transpose into the
// singer's range" — no such code existed. `fitPhraseToRange` is that
// transpose; `fitScaleBaseNote` is its cousin for one-octave runs whose TOP
// must fit as well as their base. Both are applied at the launch choke
// points, so what these pin is the arithmetic every launch now goes
// through.

import { describe, expect, it } from 'vitest'
import { APPLY_PHRASES } from '@/data/apply-melodies'
import { midiToNoteName, noteToMidi } from '@/lib/frequency-to-note'
import { fitPhraseToRange, fitScaleBaseNote, getComfortableMidiRange, } from '@/lib/vocal-range'
import type { VocalRangePreset } from '@/stores/settings-store'
import { VOCAL_RANGES } from '@/stores/settings-store'

const PRESETS = Object.keys(VOCAL_RANGES) as VocalRangePreset[]

const midis = (notes: string[]): number[] => notes.map(noteToMidi)
const intervals = (notes: string[]): number[] => {
  const m = midis(notes)
  return m.slice(1).map((v, i) => v - m[i]!)
}

describe('fitPhraseToRange', () => {
  it('brings London Bridge down where a baritone can sing it', () => {
    // The exact repro: G4 is inside the baritone option list (C2–B4), so
    // the old includes() gate waved it through, and everything after the
    // first note was out of the singer's reach.
    const fitted = fitPhraseToRange(
      ['G4', 'A4', 'G4', 'F4', 'E4', 'F4', 'G4'],
      'baritone',
    )
    expect(fitted).toEqual(['G3', 'A3', 'G3', 'F3', 'E3', 'F3', 'G3'])
  })

  it('keeps the contour and the pitch classes — octave shifts only', () => {
    const phrase = ['G4', 'A4', 'G4', 'F4', 'E4', 'F4', 'G4']
    const fitted = fitPhraseToRange(phrase, 'bass')
    expect(intervals(fitted)).toEqual(intervals(phrase))
    fitted.forEach((note, i) => {
      expect(Math.abs(noteToMidi(note) - noteToMidi(phrase[i]!)) % 12).toBe(0)
    })
  })

  it('lifts a low phrase up for a high voice the same way', () => {
    const fitted = fitPhraseToRange(['G2', 'A2', 'F2'], 'soprano')
    const { min, max } = getComfortableMidiRange('soprano')
    for (const midi of midis(fitted)) {
      expect(midi).toBeGreaterThanOrEqual(min)
      expect(midi).toBeLessThanOrEqual(max)
    }
    expect(intervals(fitted)).toEqual(intervals(['G2', 'A2', 'F2']))
  })

  it('picks the octave whose centre sits nearest the range centre', () => {
    // Baritone spans C2–B4; both G2- and G3-rooted copies fit, and the
    // range centre (~F3) is nearest the G3 copy.
    expect(fitPhraseToRange(['G4', 'B4', 'G4'], 'baritone')).toEqual([
      'G3',
      'B3',
      'G3',
    ])
  })

  it('returns the phrase itself when it already sits best where it is', () => {
    const phrase = ['F3', 'G3', 'A3']
    expect(fitPhraseToRange(phrase, 'baritone')).toBe(phrase)
  })

  it('centres a phrase too wide to fit instead of clamping its notes', () => {
    // 46 semitones of span beats every preset's range. Folding notes
    // one-by-one would flatten the melody; the whole thing is centred and
    // allowed to spill equally.
    const wide = ['C2', 'C4', 'A5']
    const fitted = fitPhraseToRange(wide, 'alto')
    expect(intervals(fitted)).toEqual(intervals(wide))
    const { min, max } = getComfortableMidiRange('alto')
    const m = midis(fitted)
    const spillLow = min - Math.min(...m)
    const spillHigh = Math.max(...m) - max
    // Centred: whatever spills out does so by about the same amount on
    // both sides (within the half-octave rounding the pitch classes need).
    expect(Math.abs(spillLow - spillHigh)).toBeLessThanOrEqual(12)
  })

  it('passes empty and unparseable input through untouched', () => {
    const empty: string[] = []
    expect(fitPhraseToRange(empty, 'tenor')).toBe(empty)
    const broken = ['G4', 'H4']
    expect(fitPhraseToRange(broken, 'tenor')).toBe(broken)
  })

  it('fits every authored apply-phrase into every voice preset', () => {
    // The regression net: whatever the routine deals out tomorrow, no
    // voice type is handed a note outside its own comfortable range.
    for (const preset of PRESETS) {
      const { min, max } = getComfortableMidiRange(preset)
      for (const phrase of APPLY_PHRASES) {
        const fitted = fitPhraseToRange(phrase.notes, preset)
        for (const midi of midis(fitted)) {
          expect(midi, `${phrase.id} for ${preset}`).toBeGreaterThanOrEqual(min)
          expect(midi, `${phrase.id} for ${preset}`).toBeLessThanOrEqual(max)
        }
      }
    }
  })
})

describe('fitScaleBaseNote', () => {
  it('folds a base whose octave run would top out over the ceiling', () => {
    // Baritone tops at B4: a G4 base runs to G5, folded G3 runs to G4.
    expect(fitScaleBaseNote('G4', 'baritone')).toBe('G3')
  })

  it('leaves a base alone when the whole run already fits', () => {
    expect(fitScaleBaseNote('G3', 'baritone')).toBe('G3')
  })

  it('every preset spans two octaves, so the fold can never fall off the floor', () => {
    // fitScaleBaseNote folds without checking the bottom, on the strength
    // of this invariant: a base high enough to need the fold (above
    // max - 12) is at least min + 12 when the range spans >= 24
    // semitones. If a narrower preset is ever added, this fails before
    // the fold can misbehave.
    for (const preset of PRESETS) {
      const { min, max } = getComfortableMidiRange(preset)
      expect(max - min, preset).toBeGreaterThanOrEqual(24)
      // The fold, applied to every in-range base, never leaves the range.
      for (let midi = min; midi <= max; midi++) {
        const folded = noteToMidi(
          fitScaleBaseNote(midiToNoteName(midi), preset),
        )
        expect(folded).toBeGreaterThanOrEqual(min)
        expect(folded).toBeLessThanOrEqual(max)
      }
    }
  })

  it('passes an unparseable note through', () => {
    expect(fitScaleBaseNote('nope', 'bass')).toBe('nope')
  })
})
