// ============================================================
// Lesson notes — frequencies, names and the series colour code
// ============================================================
//
// Every drawing and every sound on a lesson page reads the same numbers:
// A4 = 440 Hz, twelve equal steps to the octave, octave numbers that go up
// at C (B3, then C4). Colours follow the series code: blue is blue Merc's
// note (A3), orange is orange Merc's (A4), gold means "fits" and nothing
// else, violet is a contrast note, chrome any other note.

export const COLOR = {
  blue: '#58a6ff',
  orange: '#ff7448',
  gold: '#ffd84d',
  violet: '#bc8cff',
  chrome: '#c3ccd6',
  aqua: '#2dd4bf',
  ink: '#e6edf3',
  ink2: '#a8b3bf',
  ink3: '#8d97a3',
  bg: '#0d1117',
  card: '#12171e',
} as const

export const A3 = 57
export const A4 = 69

export function rgba(hex: string, alpha: number): string {
  const v = parseInt(hex.slice(1), 16)
  return `rgba(${(v >> 16) & 255},${(v >> 8) & 255},${v & 255},${alpha})`
}

/** Equal-tempered frequency of a MIDI note, A4 (69) = 440 Hz. */
export const hz = (midi: number): number => 440 * 2 ** ((midi - 69) / 12)

const LETTERS = [
  'C',
  null,
  'D',
  null,
  'E',
  'F',
  null,
  'G',
  null,
  'A',
  null,
  'B',
] as const

/** The note's letter, or null for the five notes Lesson 1 leaves unnamed. */
export const letterOf = (midi: number): string | null =>
  LETTERS[((midi % 12) + 12) % 12]

/** Octave numbers go up at C: MIDI 60 is C4. */
export const octaveOf = (midi: number): number => Math.floor(midi / 12) - 1

export function nameOf(midi: number): string | null {
  const letter = letterOf(midi)
  return letter === null ? null : `${letter}${octaveOf(midi)}`
}

export function noteColor(midi: number): string {
  if (midi === A3) return COLOR.blue
  if (midi === A4) return COLOR.orange
  return COLOR.chrome
}

/** Whole hertz at 100 Hz and up, one decimal below. */
export const fmtHz = (f: number): string =>
  f >= 100 ? Math.round(f).toString() : f.toFixed(1)

/** Position of `f` between lo and hi on a log scale, 0..1: octaves equally spaced. */
export const logPos = (f: number, lo = 110, hi = 880): number =>
  Math.log2(f / lo) / Math.log2(hi / lo)
