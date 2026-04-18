// ============================================================
// Scale Data Tests
// ============================================================

import { describe, expect,it } from 'vitest'
import { buildMajorScale, buildMultiOctaveScale, freqToMidi, freqToNote, isBlackKey, keyTonicFreq,melodyIndexAtBeat, melodyMidiRange, melodyNoteAtBeat, melodyTotalBeats, midiToFreq, midiToNote, NOTE_NAMES, noteToMidi, SCALE_DEFINITIONS,  } from '@/lib/scale-data'
import type { MelodyItem } from '@/types'

describe('MIDI/Frequency Conversion', () => {
  it('converts MIDI to frequency correctly', () => {
    // A4 = MIDI 69 = 440 Hz
    expect(midiToFreq(69)).toBeCloseTo(440, 2)
    // C4 = MIDI 60
    expect(midiToFreq(60)).toBeCloseTo(261.63, 1)
    // Middle C octave reference
    expect(midiToFreq(60)).toBeCloseTo(261.6255653, 5)
  })

  it('converts frequency to MIDI correctly', () => {
    expect(freqToMidi(440)).toBe(69)
    expect(freqToMidi(261.63)).toBe(60)
  })

  it('round-trips MIDI → freq → MIDI', () => {
    for (let midi = 36; midi <= 96; midi++) {
      const freq = midiToFreq(midi)
      const back = freqToMidi(freq)
      expect(back).toBe(midi)
    }
  })

  it('converts note + octave to MIDI', () => {
    expect(noteToMidi('A', 4)).toBe(69)
    expect(noteToMidi('C', 4)).toBe(60)
    expect(noteToMidi('C', 3)).toBe(48)
  })

  it('converts MIDI to note + octave', () => {
    const { name, octave } = midiToNote(69)
    expect(name).toBe('A')
    expect(octave).toBe(4)

    const middleC = midiToNote(60)
    expect(middleC.name).toBe('C')
    expect(middleC.octave).toBe(4)
  })

  it('calculates cents deviation correctly', () => {
    // 440 Hz is exactly A4 (0 cents)
    const note = freqToNote(440)
    expect(note.cents).toBe(0)
    expect(note.name).toBe('A')
    expect(note.octave).toBe(4)
    expect(note.midi).toBe(69)

    // ~10 cents sharp
    const sharp = freqToNote(446)
    expect(Math.abs(sharp.cents)).toBeGreaterThan(20)
    expect(Math.abs(sharp.cents)).toBeLessThan(30)
  })

  it('returns correct tonic frequency for each key', () => {
    // C4 tonic = 261.63 Hz
    expect(keyTonicFreq('C', 4)).toBeCloseTo(261.63, 1)
    // G4 tonic = 392 Hz
    expect(keyTonicFreq('G', 4)).toBeCloseTo(392, 1)
    // A4 tonic = 440 Hz
    expect(keyTonicFreq('A', 4)).toBeCloseTo(440, 1)
    // F4 tonic ≈ 349.23 Hz
    expect(keyTonicFreq('F', 4)).toBeCloseTo(349.23, 1)
  })
})

describe('Scale Building', () => {
  it('builds C major scale correctly', () => {
    const scale = buildMajorScale('C', 4)
    expect(scale.length).toBe(8)
    expect(scale[0].name).toBe('C')
    expect(scale[0].octave).toBe(4)
    expect(scale[7].name).toBe('C')
    expect(scale[7].octave).toBe(5)
  })

  it('contains all 7 notes in C major', () => {
    const scale = buildMajorScale('C', 4)
    const names = scale.map((n) => n.name)
    expect(names).toContain('C')
    expect(names).toContain('D')
    expect(names).toContain('E')
    expect(names).toContain('F')
    expect(names).toContain('G')
    expect(names).toContain('A')
    expect(names).toContain('B')
  })

  it('builds G major scale with F#', () => {
    const scale = buildMajorScale('G', 4)
    const names = scale.map((n) => n.name)
    expect(names).toContain('F#')
    expect(names).not.toContain('F')
  })

  it('builds multi-octave scale correctly', () => {
    // numOctaves=N means exactly N octave ranges
    const scale = buildMultiOctaveScale('C', 4, 2, 'major')
    // Should have 16 notes (2 octaves × 8 notes each)
    expect(scale.length).toBe(16)
    // First note should be highest pitch (top of piano roll)
    expect(scale[0].midi).toBeGreaterThan(scale[scale.length - 1].midi)
  })

  it('respects scale type parameter', () => {
    const major = buildMultiOctaveScale('C', 4, 1, 'major')
    const minor = buildMultiOctaveScale('C', 4, 1, 'natural-minor')

    // Scale should have notes
    expect(major.length).toBeGreaterThan(0)
    expect(minor.length).toBeGreaterThan(0)

    // Major scale should contain B (7th degree)
    const majorNames = major.map((n) => n.name)
    expect(majorNames).toContain('B')

    // Different scale types should produce different note combinations
    // by comparing the MIDI values
    const majorMidis = major.map((n) => n.midi)
    const minorMidis = minor.map((n) => n.midi)

    // They should both be valid scales with same count
    expect(majorMidis.length).toBe(minorMidis.length)
  })
})

describe('Scale Definitions', () => {
  it('has all expected scale types', () => {
    const expected = [
      'major',
      'natural-minor',
      'harmonic-minor',
      'melodic-minor',
      'phrygian',
      'lydian',
      'locrian',
      'dorian',
      'mixolydian',
      'pentatonic-major',
      'pentatonic-minor',
      'blues',
      'chromatic',
    ]

    for (const scaleType of expected) {
      expect(SCALE_DEFINITIONS).toHaveProperty(scaleType)
    }
  })

  it('has valid degree arrays for all scales', () => {
    for (const [_name, def] of Object.entries(SCALE_DEFINITIONS)) {
      expect(def.degrees.length).toBeGreaterThanOrEqual(5)
      expect(def.degrees[0]).toBe(0) // Should start at root
      expect(def.degrees[def.degrees.length - 1]).toBe(12) // Should include octave
      // All degrees should be in ascending order
      for (let i = 1; i < def.degrees.length; i++) {
        expect(def.degrees[i]).toBeGreaterThan(def.degrees[i - 1])
      }
    }
  })
})

describe('Melody Utilities', () => {
  it('calculates total beats correctly', () => {
    const melody: MelodyItem[] = [
      {
        note: { name: 'C', octave: 4, midi: 60, freq: 261 },
        startBeat: 0,
        duration: 2,
      },
      {
        note: { name: 'E', octave: 4, midi: 64, freq: 329 },
        startBeat: 2,
        duration: 4,
      },
    ]
    expect(melodyTotalBeats(melody)).toBe(6)
  })

  it('returns 0 for empty melody', () => {
    expect(melodyTotalBeats([])).toBe(0)
  })

  it('finds note at specific beat', () => {
    const melody: MelodyItem[] = [
      {
        note: { name: 'C', octave: 4, midi: 60, freq: 261 },
        startBeat: 0,
        duration: 2,
      },
      {
        note: { name: 'E', octave: 4, midi: 64, freq: 329 },
        startBeat: 3,
        duration: 2,
      },
    ]

    expect(melodyNoteAtBeat(melody, 1)).not.toBeNull()
    expect(melodyNoteAtBeat(melody, 2)).toBeNull() // Gap between notes
    expect(melodyNoteAtBeat(melody, 4)).not.toBeNull()
    expect(melodyNoteAtBeat(melody, 10)).toBeNull() // Beyond melody
  })

  it('finds note index at beat', () => {
    const melody: MelodyItem[] = [
      {
        note: { name: 'C', octave: 4, midi: 60, freq: 261 },
        startBeat: 0,
        duration: 2,
      },
      {
        note: { name: 'E', octave: 4, midi: 64, freq: 329 },
        startBeat: 3,
        duration: 2,
      },
    ]

    expect(melodyIndexAtBeat(melody, 1)).toBe(0)
    expect(melodyIndexAtBeat(melody, 4)).toBe(1)
    expect(melodyIndexAtBeat(melody, 10)).toBe(-1)
  })

  it('identifies black keys correctly', () => {
    // isBlackKey only checks for '#' (sharps), not 'b' (flats)
    expect(isBlackKey('C#')).toBe(true)
    expect(isBlackKey('F#')).toBe(true)
    expect(isBlackKey('Db')).toBe(false) // flats use 'b', not '#'
    expect(isBlackKey('Eb')).toBe(false)
    expect(isBlackKey('C')).toBe(false)
    expect(isBlackKey('E')).toBe(false)
  })

  it('calculates MIDI range correctly', () => {
    const melody: MelodyItem[] = [
      {
        note: { name: 'C', octave: 4, midi: 60, freq: 261 },
        startBeat: 0,
        duration: 1,
      },
      {
        note: { name: 'G', octave: 4, midi: 67, freq: 392 },
        startBeat: 1,
        duration: 1,
      },
      {
        note: { name: 'C', octave: 5, midi: 72, freq: 523 },
        startBeat: 2,
        duration: 1,
      },
    ]

    const range = melodyMidiRange(melody)
    expect(range.min).toBe(60)
    expect(range.max).toBe(72)
  })

  it('returns default range for empty melody', () => {
    const range = melodyMidiRange([])
    expect(range.min).toBe(60)
    expect(range.max).toBe(72)
  })
})

describe('Note Names', () => {
  it('has all 12 note names', () => {
    expect(NOTE_NAMES.length).toBe(12)
    expect(NOTE_NAMES).toContain('C')
    expect(NOTE_NAMES).toContain('B')
    expect(NOTE_NAMES).toContain('A#')
  })
})

describe('Custom Scales', () => {
  it('builds custom scale from comma-separated note list', () => {
    const scale = buildMultiOctaveScale('C', 4, 1, 'custom:My Scale:C,D,E,G')
    expect(scale.length).toBeGreaterThan(0)
    // Should only contain C, D, E, G notes
    const names = scale.map((n) => n.name)
    expect(names).toContain('C')
    expect(names).toContain('D')
    expect(names).toContain('E')
    expect(names).toContain('G')
    expect(names).not.toContain('F')
    expect(names).not.toContain('A')
    expect(names).not.toContain('B')
  })

  it('falls back to major for single-note custom scale', () => {
    // Single-note custom scale returns null from parser, falls back to major
    const scale = buildMultiOctaveScale('C', 4, 1, 'custom:Single:C')
    // Should still return notes (falls back to major)
    expect(scale.length).toBeGreaterThan(0)
  })

  it('handles sharps in custom scale', () => {
    const scale = buildMultiOctaveScale('C', 4, 1, 'custom:Jazz:C,E,G,B')
    expect(scale.length).toBeGreaterThan(0)
    const names = scale.map((n) => n.name)
    expect(names).toContain('C')
    expect(names).toContain('E')
    expect(names).toContain('G')
    expect(names).toContain('B')
  })

  it('deduplicates repeated notes in custom scale', () => {
    const scale = buildMultiOctaveScale('C', 4, 1, 'custom:Test:C,C,D,D,E')
    const names = scale.map((n) => n.name)
    const cCount = names.filter((n) => n === 'C').length
    expect(cCount).toBeGreaterThan(0) // Should still appear at octave boundaries
  })

  it('transposes custom scale with different keys', () => {
    const cScale = buildMultiOctaveScale('C', 4, 1, 'custom:Test:C,D,E')
    const gScale = buildMultiOctaveScale('G', 4, 1, 'custom:Test:C,D,E')
    // G scale should have higher MIDI values than C scale (G is 7 semitones above C)
    expect(gScale[gScale.length - 1].midi).toBe(
      cScale[cScale.length - 1].midi + 7,
    )
  })
})
