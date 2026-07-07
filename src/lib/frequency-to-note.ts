// ============================================================
// Frequency to Note Name Converter
// ============================================================

export type NoteName =
  | 'C'
  | 'C#'
  | 'D'
  | 'D#'
  | 'E'
  | 'F'
  | 'F#'
  | 'G'
  | 'G#'
  | 'A'
  | 'A#'
  | 'B'

/**
 * Convert frequency (Hz) to musical note name (e.g., C4, A#3)
 */
export function frequenciesToNoteName(frequency: number): string {
  if (frequency <= 0) return 'C-∞'

  const A4 = 440
  const A4Note = 69
  // Calculate MIDI note number
  const midiNote = Math.round(12 * Math.log2(frequency / A4) + A4Note)

  // Convert MIDI note to octave
  const octave = Math.floor(midiNote / 12) - 1

  // Calculate semitone offset from C (normalized so negative MIDI notes
  // don't produce a negative array index)
  const semitone = ((midiNote % 12) + 12) % 12

  const noteNames: NoteName[] = [
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

  return `${noteNames[semitone]}${octave}`
}

/**
 * Convert frequency to MIDI note number (e.g., 60 = C4).
 *
 * Rounds to the nearest semitone by default. Pass `round = false` for the
 * exact fractional MIDI value (useful for cent-accurate deviation math).
 */
export function frequencyToMidi(frequency: number, round = true): number {
  const A4 = 440
  const A4Note = 69
  const midi = 12 * Math.log2(frequency / A4) + A4Note
  return round ? Math.round(midi) : midi
}

/**
 * Convert MIDI note number to formatted note name string (e.g., 60 -> "C4")
 */
export function midiToNoteName(midi: number): string {
  const rounded = Math.round(midi)
  const noteNames: NoteName[] = [
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
  const noteIndex = ((rounded % 12) + 12) % 12
  const octave = Math.floor(rounded / 12) - 1
  return `${noteNames[noteIndex]}${octave}`
}

/** Semitone index (0–11) for each natural note letter, C = 0. */
const LETTER_SEMITONES: Record<string, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
}

/**
 * Convert note string (e.g., "A3", "C#4", "Bb3", "G#10") to MIDI note number.
 *
 * Accepts sharps (`#`) and flats (`b`), a leading letter in either case, and
 * multi-digit / negative octaves. Returns NaN for anything unparseable.
 */
export function noteToMidi(note: string): number {
  const match = /^([A-Ga-g])([#b]?)(-?\d+)$/.exec(note.trim())
  if (!match) return NaN
  const [, letter, accidental, octaveStr] = match
  const base = LETTER_SEMITONES[letter.toUpperCase()]
  if (base === undefined) return NaN
  const offset = accidental === '#' ? 1 : accidental === 'b' ? -1 : 0
  const octave = parseInt(octaveStr, 10)
  return base + offset + (octave + 1) * 12
}

/**
 * Convert MIDI note number to frequency (Hz)
 */
export function midiToFrequency(midi: number): number {
  const A4 = 440
  const A4Note = 69
  return A4 * 2 ** ((midi - A4Note) / 12)
}

/**
 * Compute deviation in cents between a given pitch (in MIDI note format) and the exact target note.
 */
export function computeCentsDeviation(
  midiPitch: number,
  targetNoteMidi?: number,
): number {
  const target = targetNoteMidi ?? Math.round(midiPitch)
  return (midiPitch - target) * 100
}
