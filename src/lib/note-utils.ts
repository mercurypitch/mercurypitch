// Shared note utilities — used by piano and guitar features

export const NOTE_COLORS: Record<string, string> = {
  C: '#e74c3c',
  'C#': '#e67e22',
  D: '#f1c40f',
  'D#': '#2ecc71',
  E: '#1abc9c',
  F: '#3498db',
  'F#': '#9b59b6',
  G: '#e91e63',
  'G#': '#ff6f00',
  A: '#00bcd4',
  'A#': '#4caf50',
  B: '#8bc34a',
}

export const NOTE_NAMES = [
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

export function midiToNoteName(midi: number): string {
  return NOTE_NAMES[((midi % 12) + 12) % 12]
}

/** Note name with scientific-pitch octave, e.g. 60 -> "C4", 48 -> "C3". */
export function midiToNoteNameOctave(midi: number): string {
  return `${NOTE_NAMES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`
}

export function noteColor(midi: number): string {
  return NOTE_COLORS[midiToNoteName(midi)] ?? '#8b949e'
}
