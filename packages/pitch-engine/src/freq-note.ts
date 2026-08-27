/** Minimal note math extracted from the root app's scale-data so the
 * detector chain stays free of the full scale/melody catalog. */

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

const NOTE_NAMES: readonly NoteName[] = [
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

const A4_MIDI = 69
const A4_FREQ = 440.0

export interface NoteInfo {
  name: NoteName
  octave: number
  freq: number
  midi: number
  cents: number
}

/** Convert MIDI note number to frequency in Hz */
export function midiToFreq(midi: number): number {
  return A4_FREQ * Math.pow(2, (midi - A4_MIDI) / 12)
}

/** Convert frequency in Hz to nearest MIDI note number */
export function freqToMidi(freq: number): number {
  return Math.round(12 * Math.log2(freq / A4_FREQ) + A4_MIDI)
}

/** Convert MIDI number to note name and octave */
export function midiToNote(midi: number): { name: NoteName; octave: number } {
  const rounded = Math.round(midi)
  const noteIndex = ((rounded % 12) + 12) % 12
  const octave = Math.floor(rounded / 12) - 1
  return { name: NOTE_NAMES[noteIndex], octave }
}

/** Convert frequency to nearest note info */
export function freqToNote(freq: number): NoteInfo {
  const midi = freqToMidi(freq)
  const exactMidi = 12 * Math.log2(freq / A4_FREQ) + A4_MIDI
  const cents = Math.round((exactMidi - midi) * 100)
  const { name, octave } = midiToNote(midi)
  return { name, octave, freq, midi, cents }
}
