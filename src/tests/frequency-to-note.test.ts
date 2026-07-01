import { describe, expect, it } from 'vitest'
import { frequenciesToNoteName, frequencyToMidi, midiToFrequency, midiToNoteName, noteToMidi, } from '@/lib/frequency-to-note'

describe('midiToNoteName', () => {
  it('converts MIDI 60 to C4', () => {
    expect(midiToNoteName(60)).toBe('C4')
  })

  it('converts MIDI 69 to A4', () => {
    expect(midiToNoteName(69)).toBe('A4')
  })

  it('converts MIDI 48 to C3', () => {
    expect(midiToNoteName(48)).toBe('C3')
  })

  it('converts MIDI 72 to C5', () => {
    expect(midiToNoteName(72)).toBe('C5')
  })

  it('handles sharps', () => {
    expect(midiToNoteName(61)).toBe('C#4')
    expect(midiToNoteName(70)).toBe('A#4')
    expect(midiToNoteName(66)).toBe('F#4')
  })

  it('handles flats as enharmonic sharps', () => {
    // D#4 = MIDI 63 (Eb4 enharmonic)
    expect(midiToNoteName(63)).toBe('D#4')
  })

  it('rounds fractional MIDI values', () => {
    expect(midiToNoteName(60.2)).toBe('C4')
    expect(midiToNoteName(60.8)).toBe('C#4')
  })

  it('handles negative MIDI values for low notes', () => {
    // MIDI 0 = C-1
    expect(midiToNoteName(0)).toBe('C-1')
  })

  it('does not produce "undefined" for MIDI values below 0', () => {
    // -1 % 12 === -1 in JS, which used to index noteNames[-1] === undefined
    expect(midiToNoteName(-1)).toBe('B-2')
    expect(midiToNoteName(-12)).toBe('C-2')
    expect(midiToNoteName(-13)).toBe('B-3')
  })

  it('returns correct note for all 12 semitones in one octave', () => {
    const expected = [
      'C4',
      'C#4',
      'D4',
      'D#4',
      'E4',
      'F4',
      'F#4',
      'G4',
      'G#4',
      'A4',
      'A#4',
      'B4',
    ]
    for (let i = 0; i < 12; i++) {
      expect(midiToNoteName(60 + i)).toBe(expected[i])
    }
  })
})

describe('noteToMidi', () => {
  it('converts "A4" to MIDI 69', () => {
    expect(noteToMidi('A4')).toBe(69)
  })

  it('converts "C4" to MIDI 60', () => {
    expect(noteToMidi('C4')).toBe(60)
  })

  it('converts "C3" to MIDI 48', () => {
    expect(noteToMidi('C3')).toBe(48)
  })

  it('converts "C5" to MIDI 72', () => {
    expect(noteToMidi('C5')).toBe(72)
  })

  it('handles sharps', () => {
    expect(noteToMidi('C#4')).toBe(61)
    expect(noteToMidi('F#4')).toBe(66)
    expect(noteToMidi('A#3')).toBe(58)
  })

  it('handles all natural notes in octave 4', () => {
    const expected: Record<string, number> = {
      C4: 60,
      D4: 62,
      E4: 64,
      F4: 65,
      G4: 67,
      A4: 69,
      B4: 71,
    }
    for (const [note, midi] of Object.entries(expected)) {
      expect(noteToMidi(note)).toBe(midi)
    }
  })

  it('handles multi-digit octaves', () => {
    // C10 = MIDI 132 (name.slice(0,-1) used to grab only the trailing digit)
    expect(noteToMidi('C10')).toBe(132)
  })

  it('handles negative octaves', () => {
    // C-1 = MIDI 0
    expect(noteToMidi('C-1')).toBe(0)
    expect(noteToMidi('B-2')).toBe(-1)
  })

  it('round-trips with midiToNoteName', () => {
    for (const note of [
      'C3',
      'D3',
      'E3',
      'F3',
      'G3',
      'A3',
      'B3',
      'C4',
      'D4',
      'E4',
      'F4',
      'G4',
      'A4',
      'B4',
      'C5',
    ]) {
      const midi = noteToMidi(note)
      const back = midiToNoteName(midi)
      expect(back).toBe(note)
    }
  })

  it('covers the NOTE_OPTIONS range used by all exercises', () => {
    // All exercises use octaves 3-5, natural notes only
    for (const note of [
      'C3',
      'D3',
      'E3',
      'F3',
      'G3',
      'A3',
      'B3',
      'C4',
      'D4',
      'E4',
      'F4',
      'G4',
      'A4',
      'B4',
      'C5',
    ]) {
      const midi = noteToMidi(note)
      expect(midi).toBeGreaterThan(0)
      expect(midi).toBeLessThan(96)
      // Round-trip
      expect(midiToNoteName(midi)).toBe(note)
    }
  })
})

describe('frequencyToMidi', () => {
  it('returns 69 for A4 (440 Hz)', () => {
    expect(frequencyToMidi(440)).toBe(69)
  })

  it('returns 60 for C4 (~261.63 Hz)', () => {
    expect(frequencyToMidi(261.63)).toBe(60)
  })
})

describe('midiToFrequency', () => {
  it('returns 440 Hz for MIDI 69', () => {
    expect(midiToFrequency(69)).toBeCloseTo(440, 2)
  })

  it('returns ~261.63 Hz for MIDI 60', () => {
    expect(midiToFrequency(60)).toBeCloseTo(261.63, 1)
  })
})

describe('frequenciesToNoteName', () => {
  it('converts 440 Hz to A4', () => {
    expect(frequenciesToNoteName(440)).toBe('A4')
  })

  it('converts 261.63 Hz to C4', () => {
    expect(frequenciesToNoteName(261.63)).toBe('C4')
  })

  it('returns C-∞ for zero or negative frequency', () => {
    expect(frequenciesToNoteName(0)).toBe('C-∞')
    expect(frequenciesToNoteName(-1)).toBe('C-∞')
  })

  it('does not produce "undefined" for very low (but positive) frequencies', () => {
    // 1 Hz maps to a deeply negative MIDI note number
    expect(frequenciesToNoteName(1)).not.toContain('undefined')
    expect(frequenciesToNoteName(1)).toBe('C-4')
  })
})
