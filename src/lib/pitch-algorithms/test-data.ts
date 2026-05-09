// ============================================================
// Pitch Detection Test Data
// Predefined waveforms and test cases for pitch detection
// ============================================================

import type { TestFrequency } from '@/types/pitch-algorithms'

// Basic test frequencies
export const BASIC_FREQUENCIES: TestFrequency[] = [
  {
    frequency: 130.81,
    expectedNote: 'C3',
    expectedFreq: 130.81,
    expectedMidi: 48,
    expectedCents: 0,
  },
  {
    frequency: 261.63,
    expectedNote: 'C4',
    expectedFreq: 261.63,
    expectedMidi: 60,
    expectedCents: 0,
  },
  {
    frequency: 523.25,
    expectedNote: 'C5',
    expectedFreq: 523.25,
    expectedMidi: 72,
    expectedCents: 0,
  },
  {
    frequency: 440.0,
    expectedNote: 'A4',
    expectedFreq: 440.0,
    expectedMidi: 69,
    expectedCents: 0,
  },
  {
    frequency: 659.25,
    expectedNote: 'E5',
    expectedFreq: 659.25,
    expectedMidi: 76,
    expectedCents: 0,
  },
]

// Guitar strings (E, A, D, G, B, E)
export const GUITAR_STRINGS: TestFrequency[] = [
  {
    frequency: 82.41,
    expectedNote: 'E2',
    expectedFreq: 82.41,
    expectedMidi: 41,
    expectedCents: 0,
  },
  {
    frequency: 110.0,
    expectedNote: 'A2',
    expectedFreq: 110.0,
    expectedMidi: 45,
    expectedCents: 0,
  },
  {
    frequency: 146.83,
    expectedNote: 'D3',
    expectedFreq: 146.83,
    expectedMidi: 50,
    expectedCents: 0,
  },
  {
    frequency: 196.0,
    expectedNote: 'G3',
    expectedFreq: 196.0,
    expectedMidi: 55,
    expectedCents: 0,
  },
  {
    frequency: 246.94,
    expectedNote: 'B3',
    expectedFreq: 246.94,
    expectedMidi: 59,
    expectedCents: 0,
  },
  {
    frequency: 329.63,
    expectedNote: 'E4',
    expectedFreq: 329.63,
    expectedMidi: 64,
    expectedCents: 0,
  },
]

// Piano keys (C4 octaves)
export const PIANO_KEYS: TestFrequency[] = [
  {
    frequency: 261.63,
    expectedNote: 'C4',
    expectedFreq: 261.63,
    expectedMidi: 60,
    expectedCents: 0,
  },
  {
    frequency: 293.66,
    expectedNote: 'D4',
    expectedFreq: 293.66,
    expectedMidi: 62,
    expectedCents: 0,
  },
  {
    frequency: 329.63,
    expectedNote: 'E4',
    expectedFreq: 329.63,
    expectedMidi: 64,
    expectedCents: 0,
  },
  {
    frequency: 349.23,
    expectedNote: 'F4',
    expectedFreq: 349.23,
    expectedMidi: 65,
    expectedCents: 0,
  },
  {
    frequency: 392.0,
    expectedNote: 'G4',
    expectedFreq: 392.0,
    expectedMidi: 67,
    expectedCents: 0,
  },
  {
    frequency: 440.0,
    expectedNote: 'A4',
    expectedFreq: 440.0,
    expectedMidi: 69,
    expectedCents: 0,
  },
  {
    frequency: 493.88,
    expectedNote: 'B4',
    expectedFreq: 493.88,
    expectedMidi: 71,
    expectedCents: 0,
  },
  {
    frequency: 523.25,
    expectedNote: 'C5',
    expectedFreq: 523.25,
    expectedMidi: 72,
    expectedCents: 0,
  },
]

// Common intervals
export const COMMON_INTERVALS: TestFrequency[] = [
  {
    frequency: 277.18,
    expectedNote: 'C#4',
    expectedFreq: 277.18,
    expectedMidi: 61,
    expectedCents: 100,
  },
  {
    frequency: 311.13,
    expectedNote: 'D#4',
    expectedFreq: 311.13,
    expectedMidi: 63,
    expectedCents: 200,
  },
  {
    frequency: 349.23,
    expectedNote: 'F4',
    expectedFreq: 349.23,
    expectedMidi: 65,
    expectedCents: 500,
  },
  {
    frequency: 392.0,
    expectedNote: 'G4',
    expectedFreq: 392.0,
    expectedMidi: 67,
    expectedCents: 700,
  },
  {
    frequency: 440.0,
    expectedNote: 'A4',
    expectedFreq: 440.0,
    expectedMidi: 69,
    expectedCents: 700,
  },
  {
    frequency: 493.88,
    expectedNote: 'B4',
    expectedFreq: 493.88,
    expectedMidi: 71,
    expectedCents: 1100,
  },
]

// Octave jumps
export const OCTAVE_JUMPS: TestFrequency[] = [
  {
    frequency: 55.0,
    expectedNote: 'A2',
    expectedFreq: 55.0,
    expectedMidi: 45,
    expectedCents: 0,
  },
  {
    frequency: 110.0,
    expectedNote: 'A3',
    expectedFreq: 110.0,
    expectedMidi: 57,
    expectedCents: 1200,
  },
  {
    frequency: 220.0,
    expectedNote: 'A4',
    expectedFreq: 220.0,
    expectedMidi: 69,
    expectedCents: 1200,
  },
  {
    frequency: 440.0,
    expectedNote: 'A5',
    expectedFreq: 440.0,
    expectedMidi: 81,
    expectedCents: 1200,
  },
  {
    frequency: 880.0,
    expectedNote: 'A6',
    expectedFreq: 880.0,
    expectedMidi: 93,
    expectedCents: 1200,
  },
]

// Extended range test (MIDI 40-100)
export const EXTENDED_RANGE: TestFrequency[] = Array.from(
  { length: 61 },
  (_, i) => {
    const midi = 40 + i
    const freq = 440 * Math.pow(2, (midi - 69) / 12)
    const noteName = freqToNoteName(midi)
    return {
      frequency: freq,
      expectedNote: noteName,
      expectedFreq: freq,
      expectedMidi: midi,
      expectedCents: 0,
    }
  },
)

function freqToNoteName(midi: number): string {
  const noteNames = [
    'C',
    'C#',
    'D',
    'D#',
    'E',
    'F',
    'F#',
    'G',
    'G#',
    'A',
    'A#',
    'B',
  ]
  const octave = Math.floor(midi / 12) - 1
  const noteIndex = midi % 12
  return noteNames[noteIndex] + octave
}

// Combined test data
export const COMBINED_TEST_DATA: TestFrequency[] = [
  ...BASIC_FREQUENCIES,
  ...GUITAR_STRINGS,
  ...PIANO_KEYS,
  ...COMMON_INTERVALS,
  ...OCTAVE_JUMPS,
  ...EXTENDED_RANGE,
]

// Get all tests
export const getBasisTests = (): TestFrequency[] => BASIC_FREQUENCIES
export const getGuitarTests = (): TestFrequency[] => GUITAR_STRINGS
export const getPianoTests = (): TestFrequency[] => PIANO_KEYS
export const getCommonIntervalTests = (): TestFrequency[] => COMMON_INTERVALS
export const getOctaveJumpTests = (): TestFrequency[] => OCTAVE_JUMPS
export const getExtendedRangeTests = (): TestFrequency[] => EXTENDED_RANGE
export const getAllTests = (): TestFrequency[] => COMBINED_TEST_DATA
