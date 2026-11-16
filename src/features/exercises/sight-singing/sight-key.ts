// ============================================================
// Sight-Singing's key: its do, its scale, its signature and its spelling
// ============================================================
//
// A line is read in a key: the Singing tab's key and scale, or a launch's
// (`key` and `scale`, slug-map.ts). The key decides what the staff shows:
// the key signature after the clef, the letter each note is written on and
// the sign before it, and the syllable under it.
//
// The signature is the major key's on the same do, or the minor key's where
// the scale's third is minor (natural, harmonic and melodic minor, dorian,
// phrygian, locrian, the minor pentatonic and the blues), as the sheet
// music view writes a minor scale with its relative major's signature
// (`notationKeySignature`, src/lib/sheet-music-renderer.ts). A do whose
// signature would need a double sharp or a double flat is written as the
// same pitch's other name: D♯ major as E♭ major, G♭ minor as F♯ minor.
//
// A scale of seven notes is spelled a letter a step from do, so A harmonic
// minor's seventh is G♯ on the G line, never A♭, and its sign is drawn. A
// scale of more or fewer notes takes the key's own letters where it shares
// them, and otherwise a black key's sharp, or its flat in a key with flats.
//
// Syllables are movable do, and do-based in minor, as the lessons sing it
// (Lesson 25 FACTS 10; kit/names-modes.ts): A harmonic minor is do re me fa
// so le ti. A note between two of the key's letters takes its letter's
// raised or lowered syllable: fi, si, ra, te.
//
// Pure: no page, no sound.

import { parseCustomScaleDegrees, SCALE_DEFINITIONS } from '@/lib/scale-data'
import type { KeySig, Letter, Spelled } from '../note-reading/staff-kit'
import { diatonicOf, keyOfScale, midiOf, SOLFA, spellOn, spellScale, } from '../note-reading/staff-kit'

const LETTERS: readonly Letter[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B']
const NATURAL_PC: Readonly<Record<Letter, number>> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
}
/** Semitones above do of each letter of the major scale: do re mi fa so la ti. */
const MAJOR_STEPS: readonly number[] = [0, 2, 4, 5, 7, 9, 11]
const MINOR_STEPS: readonly number[] = [0, 2, 3, 5, 7, 8, 10]
/** A letter's syllable lowered a semitone (me, le, te) and raised (fi, si). */
const LOWERED = ['de', 'ra', 'me', 'fe', 'se', 'le', 'te'] as const
const RAISED = ['di', 'ri', 'my', 'fi', 'si', 'li', 'ty'] as const

/** The names Scale Runner gives two scales (scale-runner-scales.ts), as the app's. */
const SCALE_ALIASES: Readonly<Record<string, string>> = {
  minor: 'natural-minor',
  pentatonic: 'pentatonic-major',
}

/** A scale in words, for Merc and the sheet's label: "harmonic minor". */
const SCALE_WORDS: Readonly<Record<string, string>> = {
  major: 'major',
  'natural-minor': 'minor',
  'harmonic-minor': 'harmonic minor',
  'melodic-minor': 'melodic minor',
  'pentatonic-major': 'major pentatonic',
  'pentatonic-minor': 'minor pentatonic',
  blues: 'blues',
  chromatic: 'chromatic',
  dorian: 'dorian',
  phrygian: 'phrygian',
  lydian: 'lydian',
  mixolydian: 'mixolydian',
  locrian: 'locrian',
}

const mod = (n: number, m: number): number => ((n % m) + m) % m

export interface SightKey {
  /** Do's name as the staff writes it: "B♭", "F♯", "A". */
  readonly name: string
  /** Do as written (its octave is 4; only its letter and sign matter). */
  readonly tonic: Spelled
  /** Do's pitch class, 0 for C to 11 for B. */
  readonly pc: number
  /** The scale's notes, in semitones above do, do first. */
  readonly steps: readonly number[]
  /** Whether the signature is the minor key's: the scale's third is minor. */
  readonly minor: boolean
  readonly sig: KeySig
  /** The scale in words: "major", "harmonic minor". */
  readonly scaleWords: string
  /**
   * For each of the twelve semitones above do, how many letters above do's
   * letter a note there is written: 0 do's own, 6 ti's.
   */
  readonly letters: readonly number[]
}

/** A key name's letter and sign: "Bb" and "B♭" are B and -1; null for nonsense. */
function parseTonic(name: string): { letter: Letter; alter: number } | null {
  const m = /^\s*([A-Ga-g])\s*(#|♯|b|♭)?\s*$/.exec(name)
  if (m === null) return null
  const letter = m[1].toUpperCase() as Letter
  const sign = m[2]
  const alter = sign === '#' || sign === '♯' ? 1 : sign === undefined ? 0 : -1
  return { letter, alter }
}

/** A scale's notes in semitones above do, from the app's scale type or Scale Runner's name. */
export function scaleSteps(scaleType: string): number[] {
  const id = SCALE_ALIASES[scaleType] ?? scaleType
  const degrees = parseCustomScaleDegrees(id) ??
    SCALE_DEFINITIONS[id]?.degrees ?? [...MAJOR_STEPS]
  const steps = [...new Set(degrees.map((d) => mod(d, 12)))].sort(
    (a, b) => a - b,
  )
  return steps.includes(0) ? steps : [0, ...steps]
}

/** A scale in words: "harmonic minor"; a scale the singer built, by its name. */
export function scaleWordsOf(scaleType: string): string {
  const id = SCALE_ALIASES[scaleType] ?? scaleType
  const known = SCALE_WORDS[id]
  if (known !== undefined) return known
  if (id.startsWith('custom:')) return id.split(':')[1] || 'own scale'
  return 'major'
}

/** Whether a scale's signature is the minor key's: a minor third and no major one. */
const isMinorSet = (steps: readonly number[]): boolean =>
  steps.includes(3) && !steps.includes(4)

/** Do and its home scale, the major or natural minor one, spelled from `letter`. */
function homeOf(letter: Letter, alter: number, minor: boolean): Spelled[] {
  const tonicMidi = 60 + NATURAL_PC[letter] + alter
  return spellScale(letter, tonicMidi, minor ? MINOR_STEPS : MAJOR_STEPS)
}

/** The other name of a sharp or flat do: D♯ is E♭, G♭ is F♯. */
function otherName(
  letter: Letter,
  alter: number,
): { letter: Letter; alter: number } {
  const i = LETTERS.indexOf(letter)
  const pc = mod(NATURAL_PC[letter] + alter, 12)
  const next = LETTERS[mod(i + (alter > 0 ? 1 : -1), 7)]
  return { letter: next, alter: mod(pc - NATURAL_PC[next] + 6, 12) - 6 }
}

/** Do by its key name, renamed where its home scale would need a double sign (D♯ major is E♭ major). */
function tonicOf(
  keyName: string,
  minor: boolean,
): { letter: Letter; alter: number; home: Spelled[] } {
  const named = parseTonic(keyName) ?? { letter: 'C' as Letter, alter: 0 }
  const home = homeOf(named.letter, named.alter, minor)
  if (named.alter === 0 || !home.some((s) => Math.abs(s.alter) > 1)) {
    return { ...named, home }
  }
  const other = otherName(named.letter, named.alter)
  return { ...other, home: homeOf(other.letter, other.alter, minor) }
}

/**
 * Every semitone's letter, as steps up from do's: the scale's own, a letter
 * a step, where it has seven notes; then the home scale's; then, between two
 * of the home scale's notes, the letter below raised or the letter above
 * lowered, whichever needs the lesser sign (B natural, not C flat, in F
 * major), a sharp where both need one, or a flat in a key with flats.
 */
function lettersOf(
  tonic: { letter: Letter; alter: number },
  steps: readonly number[],
  ownLetters: boolean,
  minor: boolean,
  flats: boolean,
): number[] {
  const letters: (number | undefined)[] = Array.from({ length: 12 })
  if (ownLetters) {
    steps.forEach((step, i) => {
      letters[step] = i
    })
  }
  const homeSteps = minor ? MINOR_STEPS : MAJOR_STEPS
  homeSteps.forEach((step, i) => {
    letters[step] ??= i
  })
  const pc = mod(NATURAL_PC[tonic.letter] + tonic.alter, 12)
  const first = LETTERS.indexOf(tonic.letter)
  const signOn = (d: number, step: number): number =>
    Math.abs(spellOn(60 + pc + d, LETTERS[(first + step) % 7]).alter)
  for (let d = 0; d < 12; d++) {
    if (letters[d] !== undefined) continue
    const below = homeSteps.indexOf(mod(d - 1, 12))
    const above = homeSteps.indexOf(mod(d + 1, 12))
    if (below === -1 || above === -1) {
      letters[d] = below === -1 ? above : below
      continue
    }
    const up = signOn(d, below)
    const down = signOn(d, above)
    letters[d] = down < up || (down === up && flats) ? above : below
  }
  return letters.map((l) => l ?? 0)
}

/**
 * The key a line is read in: do from the app's key name ("C", "F#", "Bb";
 * C when it cannot be read) and the scale from its type ("harmonic-minor",
 * Scale Runner's "minor", or a built scale's "custom:" id; major when
 * unknown).
 */
export function sightKey(keyName: string, scaleType: string): SightKey {
  const steps = scaleSteps(scaleType)
  const minor = isMinorSet(steps)
  const { home, ...tonic } = tonicOf(keyName, minor)
  const sig = keyOfScale(home)
  const ownLetters = steps.length === 7 && !scaleType.startsWith('custom:')
  const sign = tonic.alter > 0 ? '♯' : tonic.alter < 0 ? '♭' : ''
  return {
    name: `${tonic.letter}${sign}`,
    tonic: { letter: tonic.letter, alter: tonic.alter, octave: 4 },
    pc: mod(NATURAL_PC[tonic.letter] + tonic.alter, 12),
    steps,
    minor,
    sig,
    scaleWords: scaleWordsOf(scaleType),
    letters: lettersOf(
      tonic,
      steps,
      ownLetters,
      minor,
      sig.sign === 'flat' && sig.count > 0,
    ),
  }
}

/** The key in words: "A harmonic minor", "B♭ major". */
export const keyLabel = (key: SightKey): string =>
  `${key.name} ${key.scaleWords}`

/** How a note is written in the key: its letter by the key, its sign, its octave. */
export function spellIn(key: SightKey, midi: number): Spelled {
  const above = key.letters[mod(midi - key.pc, 12)]
  const letter = LETTERS[mod(LETTERS.indexOf(key.tonic.letter) + above, 7)]
  return spellOn(midi, letter)
}

/**
 * A written note's syllable in the key: its letter counted from do's, then
 * raised or lowered with its sign, so G♯ in A minor is ti and B♭ in C is
 * te. A doubly raised or lowered note keeps its letter's plain syllable.
 */
export function syllableIn(key: SightKey, s: Spelled): string {
  const step = mod(diatonicOf(s) - diatonicOf(key.tonic), 7)
  const alter = mod(midiOf(s) - key.pc - MAJOR_STEPS[step] + 6, 12) - 6
  if (alter === -1) return LOWERED[step]
  if (alter === 1) return RAISED[step]
  return SOLFA[step]
}

/**
 * Do's triad in semitones: do, the scale's own third and fifth. Its third is
 * minor where the scale has a minor third and no major one; its fifth is
 * perfect unless the scale has only a diminished one (locrian).
 */
export function triadOf(key: SightKey): readonly [number, number, number] {
  const third = isMinorSet(key.steps) ? 3 : 4
  const fifth = !key.steps.includes(7) && key.steps.includes(6) ? 6 : 7
  return [0, third, fifth]
}

/** The twelve major keys by the fewest signs: C, G, F, D, B♭, A, E♭… F♯. */
const MAJOR_KEYS: readonly string[] = [
  'C',
  'G',
  'F',
  'D',
  'Bb',
  'A',
  'Eb',
  'E',
  'Ab',
  'B',
  'Db',
  'F#',
]

/**
 * The key to read a launched phrase in when its launch names none. A
 * phrase is written in a key that holds every one of its notes: the app's
 * own where it does, and otherwise the major key that does, do on the
 * phrase's last note first, then on its first, then by the fewest signs. A
 * phrase no key holds is read in the app's key, its strangers signed.
 */
export function keyForPhrase(
  midis: readonly number[],
  appKey: SightKey,
): SightKey {
  const holds = (key: SightKey): boolean =>
    midis.every((m) => key.steps.includes(mod(m - key.pc, 12)))
  if (midis.length === 0 || holds(appKey)) return appKey
  const last = mod(midis[midis.length - 1], 12)
  const first = mod(midis[0], 12)
  const rank = (key: SightKey): number =>
    (key.pc === last ? 0 : key.pc === first ? 1 : 2) * 100 + key.sig.count
  const fits = MAJOR_KEYS.map((name) => sightKey(name, 'major')).filter(holds)
  if (fits.length === 0) return appKey
  return fits.reduce((best, key) => (rank(key) < rank(best) ? key : best))
}
