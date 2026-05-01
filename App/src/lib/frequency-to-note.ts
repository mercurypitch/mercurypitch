// ============================================================
// Frequency to Note Name Converter
// ============================================================

export type NoteName = 'C' | 'C#' | 'D' | 'D#' | 'E' | 'F' | 'F#' | 'G' | 'G#' | 'A' | 'A#' | 'B'

/**
 * Convert frequency (Hz) to musical note name (e.g., C4, A#3)
 */
export function frequenciesToNoteName(frequency: number): string {
  if (frequency <= 0) return 'C-∞'

  const A4 = 440
  const A4Note = 69
  const semitoneRatio = 2 ** (1 / 12)

  // Calculate MIDI note number
  const midiNote = Math.round(12 * Math.log2(frequency / A4) + A4Note)

  // Convert MIDI note to octave
  const octave = Math.floor(midiNote / 12) - 1

  // Calculate semitone offset from C
  const semitone = midiNote % 12

  const noteNames: NoteName[] = [
    'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B',
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
 * Convert MIDI note number to frequency (Hz)
 */
export function midiToFrequency(midi: number): number {
  const A4 = 440
  const A4Note = 69
  return A4 * 2 ** ((midi - A4Note) / 12)
}
