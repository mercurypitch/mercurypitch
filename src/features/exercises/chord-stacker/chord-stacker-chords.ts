// ============================================================
// Chord Stacker's chords: their spellings, positions, names and a run's deal
// ============================================================
//
// One table serves the setup screen's Chords picker, the chord types a
// launch may ask for (a lesson's slug, `chords` in slug-map.ts), the notes a
// round plays and asks for, and the words that name a round's chord, so the
// four cannot disagree. Pure: the controller plays and scores what these
// give.
//
// A position turns the chord over, as Lesson 27's Turn over does
// (src/features/lessons/kit/inversions.ts): each inversion moves the lowest
// note up an octave, so the bass changes and the chord's notes do not. A
// triad has root position and two inversions, a four-note chord a third.
// The notes are heard and sung from the bottom up, whatever the position.

import { midiToNoteName } from '@/lib/frequency-to-note'

/** Every chord Chord Stacker plays, triads first, in the picker's order. */
export const CHORD_STACKER_CHORDS = [
  'major',
  'minor',
  'diminished',
  'augmented',
  'maj7',
  'min7',
  'dom7',
  'dim7',
  'maj6',
] as const

export type ChordStackerChord = (typeof CHORD_STACKER_CHORDS)[number]

interface ChordSpelling {
  /** Semitones above the root, in root position. */
  readonly degrees: readonly number[]
  /** What the chord is called after its root: "C major seventh". */
  readonly quality: string
}

const SPELLINGS: Readonly<Record<ChordStackerChord, ChordSpelling>> = {
  major: { degrees: [0, 4, 7], quality: 'major' },
  minor: { degrees: [0, 3, 7], quality: 'minor' },
  diminished: { degrees: [0, 3, 6], quality: 'diminished' },
  augmented: { degrees: [0, 4, 8], quality: 'augmented' },
  maj7: { degrees: [0, 4, 7, 11], quality: 'major seventh' },
  min7: { degrees: [0, 3, 7, 10], quality: 'minor seventh' },
  dom7: { degrees: [0, 4, 7, 10], quality: 'dominant seventh' },
  dim7: { degrees: [0, 3, 6, 9], quality: 'diminished seventh' },
  maj6: { degrees: [0, 4, 7, 9], quality: 'major sixth' },
}

/** The Chords picker's three sets. Sevenths are the five a run always had. */
export type ChordSet = 'triads' | 'sevenths' | 'both'

export const CHORD_SETS: Readonly<
  Record<ChordSet, readonly ChordStackerChord[]>
> = {
  triads: ['major', 'minor', 'diminished', 'augmented'],
  sevenths: ['maj7', 'min7', 'dom7', 'dim7', 'maj6'],
  both: CHORD_STACKER_CHORDS,
}

export const CHORD_SET_OPTIONS: readonly { value: ChordSet; label: string }[] =
  [
    { value: 'triads', label: 'Triads' },
    { value: 'sevenths', label: 'Sevenths' },
    { value: 'both', label: 'Both' },
  ]

/** The set a run deals from when nothing has been chosen: today's five. */
export const DEFAULT_CHORD_SET: ChordSet = 'sevenths'

export const isChordSet = (value: unknown): value is ChordSet =>
  value === 'triads' || value === 'sevenths' || value === 'both'

export const isChordStackerChord = (
  value: unknown,
): value is ChordStackerChord =>
  (CHORD_STACKER_CHORDS as readonly unknown[]).includes(value)

/** A run is five rounds, one chord each, whatever the set. */
export const CHORD_STACKER_ROUNDS = 5

/** A chord's positions by the note in its bass, root position first. */
const POSITION_NAMES = [
  'root position',
  'first inversion',
  'second inversion',
  'third inversion',
] as const

/** How many notes the chord has: 3 for a triad, 4 for the others. */
export function chordSize(chord: ChordStackerChord): number {
  return SPELLINGS[chord].degrees.length
}

/**
 * The notes a round plays and asks for, low to high: the chord on `rootMidi`
 * in root position, turned over `position` times, each turn taking the
 * lowest note up an octave.
 */
export function chordNotes(
  rootMidi: number,
  chord: ChordStackerChord,
  position = 0,
): number[] {
  const notes = SPELLINGS[chord].degrees.map((d) => rootMidi + d)
  const turns = Math.max(0, Math.min(position, notes.length - 1))
  for (let i = 0; i < turns; i++) {
    const lowest = notes.shift()!
    notes.push(lowest + 12)
  }
  return notes
}

/** "major seventh": the chord's quality, as a sentence says it. */
export function chordQuality(chord: ChordStackerChord): string {
  return SPELLINGS[chord].quality
}

/** "first inversion": a position's name, as a sentence says it. */
export function positionName(position: number): string {
  return POSITION_NAMES[position] ?? POSITION_NAMES[0]
}

/** "C#" for any C#: a note's name without its octave. */
export function rootLetter(rootMidi: number): string {
  return midiToNoteName(rootMidi).replace(/-?\d+$/, '')
}

/**
 * What a round's chord is called: "C major", and with its position once
 * the run turns chords over, "C major, first inversion" or "C dominant
 * seventh, root position".
 */
export function chordName(
  rootMidi: number,
  chord: ChordStackerChord,
  position: number | null,
): string {
  const name = `${rootLetter(rootMidi)} ${chordQuality(chord)}`
  return position === null ? name : `${name}, ${positionName(position)}`
}

/** The set whose chips cover these chords: Triads, Sevenths, or Both. */
export function chordSetFor(chords: readonly ChordStackerChord[]): ChordSet {
  if (chords.every((c) => chordSize(c) === 3)) return 'triads'
  if (chords.every((c) => chordSize(c) === 4)) return 'sevenths'
  return 'both'
}

/** Whether `chords` are exactly a set's, in any order. */
function wholeSet(chords: readonly ChordStackerChord[]): ChordSet | null {
  const given = new Set(chords)
  for (const set of ['triads', 'sevenths', 'both'] as const) {
    const all = CHORD_SETS[set]
    if (all.length === given.size && all.every((c) => given.has(c))) {
      return set
    }
  }
  return null
}

const SET_WORDS: Readonly<Record<ChordSet, string>> = {
  triads: 'Triads',
  sevenths: 'Seventh chords',
  both: 'Triads and seventh chords',
}

function andList(words: readonly string[]): string {
  if (words.length <= 2) return words.join(' and ')
  return `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`
}

/**
 * The chords a run deals from, in words: a whole set by its name
 * ("Triads"), and a launch's own few by theirs ("Major and minor triads",
 * "Dominant seventh").
 */
export function chordsInWords(chords: readonly ChordStackerChord[]): string {
  const set = wholeSet(chords)
  if (set !== null) return SET_WORDS[set]
  const names = andList(
    CHORD_STACKER_CHORDS.filter((c) => chords.includes(c)).map(chordQuality),
  )
  const words = names.charAt(0).toUpperCase() + names.slice(1)
  return chordSetFor(chords) === 'triads' ? `${words} triads` : words
}

/** "Root position" or "With inversions": the run's positions, in words. */
export function positionsInWords(inversions: boolean): string {
  return inversions ? 'With inversions' : 'Root position'
}

/** One round: a chord, and the position it is played and sung in. */
export interface ChordRound {
  readonly chord: ChordStackerChord
  readonly position: number
}

function shuffled<T>(items: readonly T[], random: () => number): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/** The run's chords in order: the pool shuffled, again and again, never
 *  the same chord twice running where the pool has two or more. */
function dealChords(
  pool: readonly ChordStackerChord[],
  count: number,
  random: () => number,
): ChordStackerChord[] {
  const out: ChordStackerChord[] = []
  while (out.length < count) {
    const cycle = shuffled(pool, random)
    if (cycle.length > 1 && cycle[0] === out[out.length - 1]) {
      ;[cycle[0], cycle[cycle.length - 1]] = [cycle[cycle.length - 1], cycle[0]]
    }
    out.push(...cycle)
  }
  return out.slice(0, count)
}

/**
 * A run's rounds. Each chord in the pool comes once before any comes again,
 * so a run on the five sevenths plays each of them once, as it always has.
 * With inversions, each chord's positions, root position among them, are
 * dealt the same way, so a run on one chord meets every position of it.
 */
export function dealChordRounds(
  chords: readonly ChordStackerChord[],
  inversions: boolean,
  count = CHORD_STACKER_ROUNDS,
  random: () => number = Math.random,
): ChordRound[] {
  const pool = CHORD_STACKER_CHORDS.filter((c) => chords.includes(c))
  if (pool.length === 0) return []
  const positions = new Map<ChordStackerChord, number[]>()
  const nextPosition = (chord: ChordStackerChord): number => {
    if (!inversions) return 0
    let bag = positions.get(chord) ?? []
    if (bag.length === 0) {
      bag = shuffled(
        Array.from({ length: chordSize(chord) }, (_, i) => i),
        random,
      )
    }
    const position = bag.pop()!
    positions.set(chord, bag)
    return position
  }
  return dealChords(pool, count, random).map((chord) => ({
    chord,
    position: nextPosition(chord),
  }))
}

/**
 * The chords as a number a result's metrics can carry (they hold numbers
 * only): one bit per chord, in the table's order.
 */
export function chordMask(chords: readonly ChordStackerChord[]): number {
  return CHORD_STACKER_CHORDS.reduce(
    (mask, chord, i) => (chords.includes(chord) ? mask | (1 << i) : mask),
    0,
  )
}

/** The chords a mask names, in the table's order. */
export function chordsOfMask(mask: number): ChordStackerChord[] {
  return CHORD_STACKER_CHORDS.filter((_, i) => (mask & (1 << i)) !== 0)
}

/**
 * Which record a run belongs to. A run on the five sevenths in root
 * position is the drill every run before the picker was, so its key is
 * empty and its scores keep their thread; every other choice of chords or
 * positions is its own record, its score on another ruler.
 */
export function chordStackerRecord(
  chords: readonly ChordStackerChord[],
  inversions: boolean,
): { key: string; words: string } {
  const set = wholeSet(chords)
  const key =
    set ?? CHORD_STACKER_CHORDS.filter((c) => chords.includes(c)).join('+')
  if (set === 'sevenths' && !inversions) return { key: '', words: '' }
  const words = chordsInWords(chords)
  return inversions
    ? { key: `${key}-inversions`, words: `${words}, with inversions` }
    : { key, words }
}
