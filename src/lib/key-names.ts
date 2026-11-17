// ============================================================
// Key names — the twelve keys, major and minor, as the app names them
// ============================================================
//
// A key is stored as its do's name in ASCII ("C", "F#", "Bb") beside a scale
// type ("major", "harmonic-minor"). The key pickers offer twelve of them:
// the major keys round the circle of fifths, the sharp keys and then the
// flat ones, as Lesson 21 walks it (C, G, D, A, E, B and F sharp; F, B flat,
// E flat, A flat and D flat), and with a minor scale chosen their relative
// minors in the same order (A, E, B, F sharp, C sharp, G sharp and D sharp;
// D, G, C, F and B flat). The scale type says which list a do is on, so the
// picker never has to call A minor "C".
//
// Every pitch has one name on each list, the key with the fewer signs: A
// flat major but G sharp minor, F sharp major (the circle toy's name for
// the sixth key, with G flat its twin) and D flat major. A name from
// anywhere else, an old melody's "A#", a link's "Cb", a do chosen under the
// other kind of scale, is read as the same pitch's name on the list
// (`keyNameFor`), and nonsense as C, which is what every table keyed by a
// key name already made of it (`KEY_OFFSETS[name] ?? 0`).
//
// The parser is the one Sight-Singing reads a launch's `key` with
// (sight-key.ts imports it): "Bb" and "B♭", "F#" and "F♯", any case.
//
// Pure: no page, no store.

export type KeyLetter = 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B'

const LETTERS: readonly KeyLetter[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B']
const NATURAL_PC: Readonly<Record<KeyLetter, number>> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
}
/** Semitones above do of the major scale's notes and the natural minor's. */
const MAJOR_STEPS: readonly number[] = [0, 2, 4, 5, 7, 9, 11]
const MINOR_STEPS: readonly number[] = [0, 2, 3, 5, 7, 8, 10]

const mod = (n: number, m: number): number => ((n % m) + m) % m

/** The twelve major keys in the pickers' order: round the circle by sharps, then by flats. */
export const MAJOR_KEYS: readonly string[] = [
  'C',
  'G',
  'D',
  'A',
  'E',
  'B',
  'F#',
  'F',
  'Bb',
  'Eb',
  'Ab',
  'Db',
]

/** Their relative minors, each in its major key's place: A minor first, for C major. */
export const MINOR_KEYS: readonly string[] = [
  'A',
  'E',
  'B',
  'F#',
  'C#',
  'G#',
  'D#',
  'D',
  'G',
  'C',
  'F',
  'Bb',
]

/** A key name's letter and sign: "Bb" and "B♭" are B and -1; null for nonsense. */
export function parseKeyName(
  name: string,
): { letter: KeyLetter; alter: number } | null {
  const m = /^\s*([A-Ga-g])\s*(#|♯|b|♭)?\s*$/.exec(name)
  if (m === null) return null
  const letter = m[1].toUpperCase() as KeyLetter
  const sign = m[2]
  const alter = sign === '#' || sign === '♯' ? 1 : sign === undefined ? 0 : -1
  return { letter, alter }
}

/** A key name's pitch class, 0 for C to 11 for B; null for nonsense. */
export function keyPitchClass(name: string): number | null {
  const parsed = parseKeyName(name)
  return parsed === null
    ? null
    : mod(NATURAL_PC[parsed.letter] + parsed.alter, 12)
}

/**
 * Whether a scale type is a minor key's: natural, harmonic and melodic
 * minor and the minor pentatonic. The sheet music view writes those with
 * their relative major's signature, and the pickers name their do's from
 * the minor list. Every other scale, a mode or a built one, is read on the
 * major key of its do.
 */
export function isMinorScaleType(scaleType: string): boolean {
  return scaleType.toLowerCase().includes('minor')
}

/** The twelve keys a picker offers under a scale type, in its order. */
export function keysFor(scaleType: string): readonly string[] {
  return isMinorScaleType(scaleType) ? MINOR_KEYS : MAJOR_KEYS
}

/**
 * A key name as the twelve keys of its scale type write it: the name on the
 * list for the same pitch ("A#" is "Bb" in major, "Ab" is "G#" in minor),
 * and "C" for a name that cannot be read.
 */
export function keyNameFor(name: string, scaleType: string): string {
  const pc = keyPitchClass(name) ?? 0
  const keys = keysFor(scaleType)
  return keys.find((key) => keyPitchClass(key) === pc) ?? keys[0]
}

/** A key or note name for the eye, its sign a real one: "Bb" is "B♭", "F#" is "F♯". */
export function keyDisplayName(name: string): string {
  const parsed = parseKeyName(name)
  if (parsed === null) return name
  const sign = parsed.alter > 0 ? '♯' : parsed.alter < 0 ? '♭' : ''
  return `${parsed.letter}${sign}`
}

/**
 * The major key whose signature a key takes, by its name on the major list:
 * a major key's own, a minor key's relative major's.
 */
export function signatureKeyFor(name: string, scaleType: string): string {
  const key = keyNameFor(name, scaleType)
  return isMinorScaleType(scaleType) ? MAJOR_KEYS[MINOR_KEYS.indexOf(key)] : key
}

/** Whether a key's signature is written in flats: F, B flat… and D minor, G minor… */
export function keyUsesFlats(name: string, scaleType: string): boolean {
  return MAJOR_KEYS.indexOf(signatureKeyFor(name, scaleType)) > 6
}

/** How a key writes one pitch class: on which letter, with how many sharps (flats below zero). */
export interface KeySpelledPitch {
  readonly letter: KeyLetter
  readonly alter: number
}

/** Each pitch class's letter as a white key, as a black key's sharp, and as its flat. */
const WHITE: readonly (KeyLetter | null)[] = [
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
]
const BLACK_AS_SHARP: readonly (KeyLetter | null)[] = [
  null,
  'C',
  null,
  'D',
  null,
  null,
  'F',
  null,
  'G',
  null,
  'A',
  null,
]
const BLACK_AS_FLAT: readonly (KeyLetter | null)[] = [
  null,
  'D',
  null,
  'E',
  null,
  null,
  'G',
  null,
  'A',
  null,
  'B',
  null,
]

/**
 * How a key writes each of the twelve pitch classes, C's first. The key's
 * own seven notes sit a letter apart from do, so F sharp major's seventh is
 * E sharp and never F; a minor key's raised sixth and seventh keep their
 * letters too, so D minor's leading note is C sharp, never D flat, and G
 * sharp minor's is F double sharp. Any other note is a white key by its own
 * letter, or a black key as a flat in a key with flats and as a sharp
 * otherwise.
 */
export function keySpelling(
  name: string,
  scaleType: string,
): readonly KeySpelledPitch[] {
  const minor = isMinorScaleType(scaleType)
  const tonic = parseKeyName(keyNameFor(name, scaleType)) ?? {
    letter: 'C' as KeyLetter,
    alter: 0,
  }
  const tonicPc = mod(NATURAL_PC[tonic.letter] + tonic.alter, 12)
  const first = LETTERS.indexOf(tonic.letter)
  const flats = keyUsesFlats(name, scaleType)
  const out: (KeySpelledPitch | undefined)[] = Array.from({ length: 12 })
  const write = (step: number, degree: number): void => {
    const pc = mod(tonicPc + step, 12)
    if (out[pc] !== undefined) return
    const letter = LETTERS[(first + degree) % 7]
    out[pc] = { letter, alter: mod(pc - NATURAL_PC[letter] + 6, 12) - 6 }
  }
  ;(minor ? MINOR_STEPS : MAJOR_STEPS).forEach(write)
  if (minor) {
    write(9, 5)
    write(11, 6)
  }
  return out.map((spelled, pc) => {
    if (spelled !== undefined) return spelled
    const black = (flats ? BLACK_AS_FLAT : BLACK_AS_SHARP)[pc]
    if (black !== null) return { letter: black, alter: flats ? -1 : 1 }
    return { letter: WHITE[pc] ?? 'C', alter: 0 }
  })
}
