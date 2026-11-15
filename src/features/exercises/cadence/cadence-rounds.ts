// ============================================================
// Name the Cadence: the four cadences, and the rounds of a run
// ============================================================
//
// A cadence is the two chords a phrase ends on. Lesson 28 names four, by
// their British names, with the American ones beside them in the help:
//
//   perfect      V to I    the phrase comes home       (authentic)
//   plagal       IV to I   home by the softer road     (the "Amen")
//   imperfect    ... to V  it stops on V, and waits    (half)
//   interrupted  V to vi   vi, where I was due         (deceptive)
//
// A round is one cadence in one major key: the key's own chord first, so
// the ear has a home to measure from, then the two chords. This file is the
// drill's arithmetic: which cadences a level asks for, the rounds of a run,
// the notes of each chord, and the words for each cadence. No sound.

import { degreeChordMidis, romanOf } from '@/lib/ear/progressions'

export type CadenceType = 'perfect' | 'plagal' | 'imperfect' | 'interrupted'

/** The four, in the order a learner meets them. */
export const CADENCE_TYPES: readonly CadenceType[] = [
  'perfect',
  'imperfect',
  'plagal',
  'interrupted',
]

export const isCadenceType = (value: string): value is CadenceType =>
  (CADENCE_TYPES as readonly string[]).includes(value)

export const CADENCE_NAME: Readonly<Record<CadenceType, string>> = {
  perfect: 'Perfect',
  imperfect: 'Imperfect',
  plagal: 'Plagal',
  interrupted: 'Interrupted',
}

/** What each does, in a clause Merc says after its two chords. */
export const CADENCE_SAYS: Readonly<Record<CadenceType, string>> = {
  perfect: 'it comes home',
  imperfect: 'it stops there, and waits',
  plagal: 'home by the softer road',
  interrupted: 'where I was due',
}

/**
 * The two chords of each cadence, as degrees of a major scale. An imperfect
 * cadence is any approach to V; these three are the ones a song uses most.
 */
const CADENCE_CHORDS: Readonly<
  Record<CadenceType, readonly (readonly [number, number])[]>
> = {
  perfect: [[5, 1]],
  plagal: [[4, 1]],
  imperfect: [
    [1, 5],
    [4, 5],
    [2, 5],
  ],
  interrupted: [[5, 6]],
}

/** The rounds of a run. Eight is about a minute and a half of listening. */
export const CADENCE_ROUNDS = 8

/** The lowest and highest tonic a round may be in: G3 to E4. */
const TONIC_LOW = 55
const TONIC_HIGH = 64
const KEYS = TONIC_HIGH - TONIC_LOW + 1

/**
 * The cadences a level asks for: finished against unfinished first, which
 * is the ear's first cut, then the plagal, then the interrupted.
 */
export function typesFor(difficulty: number): readonly CadenceType[] {
  // The adaptive level is 1 to 10; anything else is read as its nearest end.
  const level = Math.min(10, Math.max(1, Math.round(difficulty)))
  if (level <= 3) return CADENCE_TYPES.slice(0, 2)
  if (level <= 6) return CADENCE_TYPES.slice(0, 3)
  return CADENCE_TYPES
}

/** The types of a run in the setup screen's words: "Perfect, Imperfect and Plagal". */
export function typesLabel(types: readonly CadenceType[]): string {
  const names = types.map((t) => CADENCE_NAME[t])
  if (names.length <= 1) return names.join('')
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

/** One cadence to name: its type, its key, and its two chords as degrees. */
export interface CadenceRound {
  type: CadenceType
  /** The key's tonic, as a MIDI note. */
  tonicMidi: number
  degrees: readonly [number, number]
}

export interface CadencePlan {
  difficulty: number
  /** How many rounds; a run's eight unless a test asks otherwise. */
  rounds?: number
  /** A number in [0, 1); `Math.random` unless a test wants its own. */
  random?: () => number
}

/**
 * The rounds of one run.
 *
 * The level's types are dealt like a pack of cards, so each comes up as
 * often as the others and none more than twice running. Each round takes a
 * key of its own, never the last round's: the same cadence in the same key
 * twice would be answered by memory of the sound, not by its shape.
 */
export function planCadences(plan: CadencePlan): CadenceRound[] {
  const random = plan.random ?? Math.random
  const total = plan.rounds ?? CADENCE_ROUNDS
  const types = typesFor(plan.difficulty)
  const pick = <T>(items: readonly T[]): T =>
    items[Math.min(items.length - 1, Math.floor(random() * items.length))]

  const rounds: CadenceRound[] = []
  let pack: CadenceType[] = []
  let lastTonic = -1
  while (rounds.length < total) {
    if (pack.length === 0) {
      pack = [...types]
      for (let i = pack.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1))
        ;[pack[i], pack[j]] = [pack[j], pack[i]]
      }
    }
    const type = pack.shift()!
    // Any key for the first round; for each one after it, one of the keys
    // the last round was not in, counted on from it.
    const tonicMidi =
      lastTonic < 0
        ? TONIC_LOW + Math.min(KEYS - 1, Math.floor(random() * KEYS))
        : TONIC_LOW +
          ((lastTonic -
            TONIC_LOW +
            1 +
            Math.min(KEYS - 2, Math.floor(random() * (KEYS - 1)))) %
            KEYS)
    lastTonic = tonicMidi
    rounds.push({ type, tonicMidi, degrees: pick(CADENCE_CHORDS[type]) })
  }
  return rounds
}

/** A chord of a round's playback: which chord it is, and its notes. */
export interface CadenceStep {
  /** `home` is the key's own chord, played first; the cadence is the other two. */
  role: 'home' | 'first' | 'last'
  degree: number
  midis: readonly number[]
}

/**
 * What a round plays, in order: the key's own chord, then the cadence's
 * two. Always three, struck one after another, even where the cadence opens
 * on the key's chord itself (I to V): a round of two chords among rounds of
 * three would name itself before it was heard.
 */
export function stepsOf(round: CadenceRound): CadenceStep[] {
  const chord = (role: CadenceStep['role'], degree: number): CadenceStep => ({
    role,
    degree,
    midis: degreeChordMidis(round.tonicMidi, degree),
  })
  const [first, last] = round.degrees
  return [chord('home', 1), chord('first', first), chord('last', last)]
}

/** A round's two chords in Roman numerals: "V to I". */
export const chordsOf = (round: CadenceRound): string =>
  `${romanOf(round.degrees[0])} to ${romanOf(round.degrees[1])}`

export const cadenceIsRight = (
  round: CadenceRound,
  answer: CadenceType,
): boolean => round.type === answer
