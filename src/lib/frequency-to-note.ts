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
 * Convert frequency to MIDI note number (e.g., 60 = C4)
 */
export function frequencyToMidi(frequency: number): number {
  const A4 = 440
  const A4Note = 69
  return Math.round(12 * Math.log2(frequency / A4) + A4Note)
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

/**
 * Convert note string (e.g., "A3", "C#4") to MIDI note number.
 */
export function noteToMidi(note: string): number {
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
  const match = /^([A-G]#?)(-?\d+)$/.exec(note)
  if (!match) return NaN
  const [, name, octaveStr] = match
  const octave = parseInt(octaveStr, 10)
  return noteNames.indexOf(name as NoteName) + (octave + 1) * 12
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
