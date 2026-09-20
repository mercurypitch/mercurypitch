// ============================================================
// The voice-type presets are notes, and they are a ladder
// ============================================================
//
// Owner report (2026-09-20): "the baritone selected in settings makes the
// ascent go from C2 to C3, but that is not really baritone range? I can't
// even go to C2". It is not. The presets were three octave numbers a voice:
// baritone and bass were the SAME row (C2 to B4, start on A2, scales from
// C2), and an alto started on C3, under the bottom of hers.
//
// Three other tables in the app already agreed on the textbook ranges; this
// was the one that did not, and the one every exercise read. These pin the
// table to them, and pin the properties the exercises lean on.

import { describe, expect, it } from 'vitest'
import { midiToNoteName } from '@/lib/frequency-to-note'
import { VOICE_TYPE_BANDS } from '@/lib/mirror/legend-catalog'
import { getComfortableMidiRange, getDefaultNote, getNoteOptions, octaveShiftIntoRange, vocalRangeMelodyId, } from '@/lib/vocal-range'
import type { VocalRangePreset } from '@/stores/settings-store'
import { VOCAL_RANGES } from '@/stores/settings-store'

/** Low to high. */
const LADDER: VocalRangePreset[] = [
  'bass',
  'baritone',
  'tenor',
  'alto',
  'mezzo-soprano',
  'soprano',
]

const OCTAVE = 12
const cOf = (octave: number): number => (octave + 1) * OCTAVE

describe('the voice-type presets', () => {
  it('covers every preset, low to high', () => {
    expect([...LADDER].sort()).toEqual(Object.keys(VOCAL_RANGES).sort())
  })

  it('agrees with the ranges the voice-type map draws', () => {
    // VOICE_TYPE_BANDS is what Voice Mirror shows a singer as "a baritone's
    // range". An exercise that asks a baritone for a note outside it is
    // contradicting the app's own picture of a baritone.
    const bands = new Map(
      VOICE_TYPE_BANDS.map((band) => [band.id.toLowerCase(), band]),
    )
    for (const preset of LADDER) {
      const band = bands.get(preset)
      expect(band, preset).toBeDefined()
      expect(VOCAL_RANGES[preset].lowMidi, preset).toBe(band?.lowMidi)
      expect(VOCAL_RANGES[preset].highMidi, preset).toBe(band?.highMidi)
    }
  })

  it('is a ladder: every voice starts, bottoms out and tops out above the one below', () => {
    for (let i = 1; i < LADDER.length; i++) {
      const below = VOCAL_RANGES[LADDER[i - 1]]
      const voice = VOCAL_RANGES[LADDER[i]]
      expect(voice.anchorMidi, LADDER[i]).toBeGreaterThan(below.anchorMidi)
      expect(voice.lowMidi, LADDER[i]).toBeGreaterThan(below.lowMidi)
      expect(voice.highMidi, LADDER[i]).toBeGreaterThan(below.highMidi)
    }
  })

  it('does not hand a baritone the bass', () => {
    expect(VOCAL_RANGES.baritone).not.toEqual({
      ...VOCAL_RANGES.bass,
      label: 'Baritone',
    })
    expect(getDefaultNote('baritone')).toBe('C3')
    expect(getDefaultNote('bass')).toBe('A2')
  })

  it('starts every voice on a natural note, low in the middle of its range', () => {
    expect(LADDER.map(getDefaultNote)).toEqual([
      'A2',
      'C3',
      'E3',
      'A3',
      'C4',
      'E4',
    ])
    for (const preset of LADDER) {
      const { lowMidi, highMidi, anchorMidi } = VOCAL_RANGES[preset]
      // A one-octave run up from the start stays clear of BOTH ends...
      expect(anchorMidi - lowMidi, preset).toBeGreaterThanOrEqual(3)
      expect(highMidi - (anchorMidi + OCTAVE), preset).toBeGreaterThanOrEqual(3)
      // ...and sits in the lower half: beginners strain at the top first.
      expect(anchorMidi + OCTAVE / 2, preset).toBeLessThanOrEqual(
        (lowMidi + highMidi) / 2,
      )
    }
  })

  it('never asks anybody for C2', () => {
    // The report itself. C2 is a major third under a BASS.
    for (const preset of LADDER) {
      expect(getComfortableMidiRange(preset).min, preset).toBeGreaterThan(
        cOf(2),
      )
      expect(getNoteOptions(preset), preset).not.toContain('C2')
      expect(vocalRangeMelodyId(preset), preset).not.toBe('scale-major-c2')
    }
  })

  it('spans two octaves, which the scale-runner fold depends on', () => {
    for (const preset of LADDER) {
      const { min, max } = getComfortableMidiRange(preset)
      expect(max - min, preset).toBeGreaterThanOrEqual(2 * OCTAVE)
    }
  })

  it('puts C-rooted material in the octave of C major that fits the range', () => {
    // The library's scales, the jam room's drills and a new melody can only
    // move by octaves, so there are two answers and not six -- but each one
    // has to be INSIDE the voice it is given to.
    for (const preset of LADDER) {
      const { lowMidi, highMidi, defaultOctave } = VOCAL_RANGES[preset]
      expect(cOf(defaultOctave), preset).toBeGreaterThanOrEqual(lowMidi)
      expect(cOf(defaultOctave) + OCTAVE, preset).toBeLessThanOrEqual(highMidi)
    }
    expect(LADDER.map((preset) => VOCAL_RANGES[preset].defaultOctave)).toEqual([
      3, 3, 3, 4, 4, 4,
    ])
  })

  it('shows a piano roll wide enough for the whole range', () => {
    for (const preset of LADDER) {
      const { lowMidi, highMidi, minOctave, maxOctave } = VOCAL_RANGES[preset]
      expect(cOf(minOctave), preset).toBeLessThanOrEqual(lowMidi)
      expect(cOf(maxOctave) + OCTAVE - 1, preset).toBeGreaterThanOrEqual(
        highMidi,
      )
    }
  })
})

describe('octaveShiftIntoRange', () => {
  // A major scale written from C4 to C5, which is where every catalogue
  // exercise is authored and where every voice used to be asked to sing it.
  const C4 = 60
  const C5 = 72

  it('brings a scale written at C4 down an octave for the low voices', () => {
    expect(octaveShiftIntoRange(C4, C5, 'bass')).toBe(-OCTAVE)
    expect(octaveShiftIntoRange(C4, C5, 'baritone')).toBe(-OCTAVE)
    expect(octaveShiftIntoRange(C4, C5, 'tenor')).toBe(-OCTAVE)
  })

  it('leaves it where it is for the high ones', () => {
    expect(octaveShiftIntoRange(C4, C5, 'alto')).toBe(0)
    expect(octaveShiftIntoRange(C4, C5, 'mezzo-soprano')).toBe(0)
    expect(octaveShiftIntoRange(C4, C5, 'soprano')).toBe(0)
  })

  it('only ever moves by whole octaves, and lands inside the range', () => {
    for (const preset of LADDER) {
      const { min, max } = getComfortableMidiRange(preset)
      for (const low of [36, 43, 48, 55, 60, 67, 72]) {
        const shift = octaveShiftIntoRange(low, low + 7, preset)
        expect(shift % OCTAVE === 0, `${preset} from ${low}`).toBe(true)
        expect(low + shift, midiToNoteName(low)).toBeGreaterThanOrEqual(min)
        expect(low + 7 + shift, midiToNoteName(low)).toBeLessThanOrEqual(max)
      }
    }
  })

  it('never answers minus zero', () => {
    expect(Object.is(octaveShiftIntoRange(C4, C5, 'soprano'), 0)).toBe(true)
  })
})
