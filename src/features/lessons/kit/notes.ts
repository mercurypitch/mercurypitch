// ============================================================
// Lesson notes — frequencies, names and the series colour code
// ============================================================
//
// Every drawing and every sound on a lesson page reads the same numbers:
// A4 = 440 Hz, twelve equal steps to the octave, octave numbers that go up
// at C (B3, then C4). Colours follow the series code: blue is Merc's
// note (A3), orange is Tavi's (A4), gold means "fits" and nothing
// else, violet is a contrast note, chrome any other note.
//
// A note can be spelled on more than one letter: the black key above C is
// C♯ or D♭, and F can be E♯. A spelled name comes three ways: in signs for
// the eye ("C♯4"), in words for a screen reader ("C sharp 4"), and as
// markup that shows the sign and speaks the word (the sign aria-hidden, a
// visually hidden word after it in `.sr`), because a screen reader reads
// "♯" as nothing at all, or as "number sign".

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
  /** The app's target amber: a sung model, only while it plays (--amber). */
  amber: '#f59e0b',
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

export type Letter = 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B'

/** A note spelled on a letter: the letter, its sharps or flats, and its octave number. */
export interface Spelled {
  readonly letter: Letter
  /** Sharps (1, 2) or flats (-1, -2) on the letter; 0 for the plain letter. */
  readonly alter: number
  /** The octave number of the letter as written: B♯3 sounds as C4. */
  readonly octave: number
}

const NATURAL: Readonly<Record<Letter, number>> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
}
const LETTER_ORDER: readonly Letter[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B']
const SHARP_LETTER: readonly Letter[] = [
  'C',
  'C',
  'D',
  'D',
  'E',
  'F',
  'F',
  'G',
  'G',
  'A',
  'A',
  'B',
]
const FLAT_LETTER: readonly Letter[] = [
  'C',
  'D',
  'D',
  'E',
  'E',
  'F',
  'G',
  'G',
  'A',
  'A',
  'B',
  'B',
]
const SIGN: Readonly<Record<number, string>> = {
  [-2]: '𝄫',
  [-1]: '♭',
  0: '',
  1: '♯',
  2: '𝄪',
}
const SIGN_WORD: Readonly<Record<number, string>> = {
  [-2]: 'double flat',
  [-1]: 'flat',
  0: '',
  1: 'sharp',
  2: 'double sharp',
}

const pitchClass = (midi: number): number => ((midi % 12) + 12) % 12

/** True for the five notes with no letter of their own: the black keys. */
export const isBlack = (midi: number): boolean => letterOf(midi) === null

/**
 * `midi` spelled on `letter`, by the nearest way round: C4 on B is B♯3, E4
 * on F is F♭4, C♯4 on D is D♭4.
 */
export function spellOn(midi: number, letter: Letter): Spelled {
  let alter = (pitchClass(midi) - NATURAL[letter] + 12) % 12
  if (alter > 6) alter -= 12
  return { letter, alter, octave: octaveOf(midi - alter) }
}

/** A white key's own letter, or a black key's sharp: C♯4 for MIDI 61. */
export const sharpOf = (midi: number): Spelled =>
  spellOn(midi, SHARP_LETTER[pitchClass(midi)])

/** A white key's own letter, or a black key's flat: D♭4 for MIDI 61. */
export const flatOf = (midi: number): Spelled =>
  spellOn(midi, FLAT_LETTER[pitchClass(midi)])

/**
 * A scale spelled one letter per step from a tonic on `letter`: from D♭
 * (61 on D) the major steps give D♭ E♭ F G♭ A♭ B♭ C D♭. `steps` are
 * semitones above the tonic, one per letter in turn.
 */
export function spellScale(
  letter: Letter,
  tonic: number,
  steps: readonly number[],
): Spelled[] {
  const first = LETTER_ORDER.indexOf(letter)
  return steps.map((s, i) => spellOn(tonic + s, LETTER_ORDER[(first + i) % 7]))
}

export interface NameOptions {
  /** Print the octave number (default true): "C♯4", or "C♯" without it. */
  readonly octave?: boolean
}

/** In signs, for the eye: "C♯4", "D♭", "E". */
export function signName(s: Spelled, o: NameOptions = {}): string {
  return `${s.letter}${SIGN[s.alter]}${o.octave === false ? '' : s.octave}`
}

/**
 * In words, for a screen reader: "C sharp 4", "D flat", and a plain letter
 * as it is printed, "A3", as `nameHtml` reads.
 */
export function wordName(s: Spelled, o: NameOptions = {}): string {
  const octave = o.octave === false ? '' : String(s.octave)
  if (s.alter === 0) return `${s.letter}${octave}`
  return `${s.letter} ${SIGN_WORD[s.alter]}${octave === '' ? '' : ` ${octave}`}`
}

/** The sign for the eye and its word for a screen reader, as markup. */
function speakableSign(alter: number, before: string): string {
  return `<span aria-hidden="true">${SIGN[alter]}</span><span class="sr"> ${SIGN_WORD[alter]}${before}</span>`
}

/**
 * As markup that shows "C♯4" and is read "C sharp 4": the sign is
 * aria-hidden and its word follows in a visually hidden `.sr` span.
 */
export function nameHtml(s: Spelled, o: NameOptions = {}): string {
  const octave = o.octave === false ? '' : String(s.octave)
  if (s.alter === 0) return `${s.letter}${octave}`
  return `${s.letter}${speakableSign(s.alter, octave === '' ? '' : ' ')}${octave}`
}

const escapeHtml = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/**
 * Text with every ♯ and ♭ made speakable, as markup: "Play: A to A♯" is
 * read "Play: A to A sharp", and "C♯4" "C sharp 4". The text is escaped.
 */
export function signsHtml(text: string): string {
  return escapeHtml(text).replace(
    /([♯♭])(\d?)/g,
    (_all: string, sign: string, digit: string) =>
      `${speakableSign(sign === '♯' ? 1 : -1, digit === '' ? '' : ' ')}${digit}`,
  )
}

/** Whole hertz at 100 Hz and up, one decimal below. */
export const fmtHz = (f: number): string =>
  f >= 100 ? Math.round(f).toString() : f.toFixed(1)

/** Position of `f` between lo and hi on a log scale, 0..1: octaves equally spaced. */
export const logPos = (f: number, lo = 110, hi = 880): number =>
  Math.log2(f / lo) / Math.log2(hi / lo)
