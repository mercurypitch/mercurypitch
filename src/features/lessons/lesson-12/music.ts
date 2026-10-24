// ============================================================
// Lesson 12 music — a major key's seven chords, their rooms, the loop and the two tunes
// ============================================================
//
// The facts the page draws and plays, pure (WEB-SPEC, Tests 1 to 4). A key's
// chords are built on each degree of its scale by adding the scale's notes a
// third and a fifth above (FACTS 13), spelled one letter per degree (FACTS
// 10), and each takes its quality from its gaps and its numeral from its
// degree and quality (FACTS 15, 17). A room is a chord on the ring of twelve:
// its corners are pitch classes, its sides the semitones between them going
// round (FACTS 22).
//
// Every sound in G is the same sound in C five semitones lower: the chips
// sound from the key's own octave, C from C4 and G from G3 (FACTS 69), and
// the loop, its roots and the tunes move by the same five (FACTS 69a). The
// loop is I, V, vi and IV in root position, close, with V, vi and IV an
// octave under their chips (FACTS 34). A tune note's chord and whether it
// lands on a corner are worked out from its onset, never written down, so
// the counts the reveal prints (11 of 15, 10 of 12) are what the notes do.
//
// No syllables here: the page's names switch adds them, so this module
// holds degrees, MIDI and spellings only.

import { MAJOR_DEGREES } from '@/features/lessons/kit/major-scale'
import type { Letter, Spelled } from '@/features/lessons/kit/notes'
import { spellScale } from '@/features/lessons/kit/notes'

export type KeyName = 'C' | 'G'

export const KEYS: readonly KeyName[] = ['C', 'G']

/** A major key as the page plays it. */
export interface MajorKey {
  readonly name: KeyName
  readonly letter: Letter
  /** Do as the page sounds it: C4 (60) in C, G3 (55) in G. */
  readonly tonic: number
  /** Semitones from the same sound in C: 0 in C, -5 in G (FACTS 69a). */
  readonly shift: number
  /** The scale's seven pitch classes, do to ti, for the ring. */
  readonly pitchClasses: readonly number[]
}

const pc = (midi: number): number => ((midi % 12) + 12) % 12

function key(name: KeyName, tonic: number): MajorKey {
  return {
    name,
    letter: name,
    tonic,
    shift: tonic - 60,
    pitchClasses: MAJOR_DEGREES.slice(0, 7).map((d) => pc(tonic + d)),
  }
}

export const KEY: Readonly<Record<KeyName, MajorKey>> = {
  C: key('C', 60),
  G: key('G', 55),
}

export type Quality = 'major' | 'minor' | 'diminished' | 'augmented'

/** A triad's quality from its two gaps, root to third and third to fifth (FACTS 15). */
export function qualityOf(gaps: readonly [number, number]): Quality {
  const [low, high] = gaps
  if (low === 4 && high === 3) return 'major'
  if (low === 3 && high === 4) return 'minor'
  if (low === 3 && high === 3) return 'diminished'
  if (low === 4 && high === 4) return 'augmented'
  throw new Error(`lesson 12: gaps of ${low} and ${high} make no triad`)
}

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'] as const

/**
 * A chord's Roman numeral (FACTS 17): its root's degree, upper case for
 * major, lower case for minor, lower case with ° for diminished, upper case
 * with + for augmented.
 */
export function numeralOf(degree: number, quality: Quality): string {
  const upper = ROMAN[degree]
  if (quality === 'major') return upper
  if (quality === 'augmented') return `${upper}+`
  const lower = upper.toLowerCase()
  return quality === 'diminished' ? `${lower}°` : lower
}

/** A chord of the key, built on one degree of its scale. */
export interface Chord {
  /** Its root's degree: 0 do to 6 ti. */
  readonly degree: number
  /** Root, third and fifth, from the key's own octave: C4 E4 G4 up to B4 D5 F5 in C. */
  readonly midis: readonly [number, number, number]
  /** The same three, spelled one letter per degree: F♯ A C, never G♭ A C. */
  readonly spelled: readonly [Spelled, Spelled, Spelled]
  /** Root to third, third to fifth, in semitones. */
  readonly gaps: readonly [number, number]
  /** Root to fifth, in semitones: 7, or 6 for the diminished chord. */
  readonly fifth: number
  readonly quality: Quality
  readonly numeral: string
}

/** Two octaves of the scale, so a chord on ti can reach its third and fifth. */
const TWO_OCTAVES = Array.from(
  { length: 14 },
  (_, i) => MAJOR_DEGREES[i % 7] + 12 * Math.floor(i / 7),
)

/** The key's seven chords, I to vii°, in scale order (FACTS 16, 19). */
export function chordsOf(name: KeyName): Chord[] {
  const k = KEY[name]
  const spelled = spellScale(k.letter, k.tonic, TWO_OCTAVES)
  return Array.from({ length: 7 }, (_, degree) => {
    const at = [degree, degree + 2, degree + 4] as const
    const midis = at.map((i) => k.tonic + TWO_OCTAVES[i]) as [
      number,
      number,
      number,
    ]
    const gaps: [number, number] = [midis[1] - midis[0], midis[2] - midis[1]]
    const quality = qualityOf(gaps)
    return {
      degree,
      midis,
      spelled: at.map((i) => spelled[i]) as [Spelled, Spelled, Spelled],
      gaps,
      fifth: midis[2] - midis[0],
      quality,
      numeral: numeralOf(degree, quality),
    }
  })
}

/** A chord on the ring of twelve: its three corners and the sides between them. */
export interface Room {
  /** Root, third and fifth as pitch classes, C = 0. */
  readonly corners: readonly [number, number, number]
  /** Going round: root to third, third to fifth, fifth back to root. Major 4, 3, 5. */
  readonly sides: readonly [number, number, number]
}

/** A chord's room (FACTS 22). */
export function roomOf(chord: Pick<Chord, 'midis'>): Room {
  const corners = chord.midis.map(pc) as [number, number, number]
  const round = (from: number, to: number): number => (to - from + 12) % 12
  return {
    corners,
    sides: [
      round(corners[0], corners[1]),
      round(corners[1], corners[2]),
      round(corners[2], corners[0]),
    ],
  }
}

/** True when `midi`, in any octave, is a corner of the chord's room. */
export const onCorner = (midi: number, chord: Pick<Chord, 'midis'>): boolean =>
  roomOf(chord).corners.includes(pc(midi))

/** The loop, I–V–vi–IV, by degree (FACTS 24, 26). */
export const LOOP_DEGREES: readonly number[] = [0, 4, 5, 3]

/** One chord of the loop, two seconds a chord (FACTS 34, 68). */
export const BAR_SEC = 2
/** The loop's four bars (FACTS 68). */
export const LOOP_SEC = BAR_SEC * LOOP_DEGREES.length

/**
 * The loop's four chords as the page voices them (FACTS 34): in C, C4 E4 G4;
 * G3 B3 D4; A3 C4 E4; F3 A3 C4. I is its chip; V, vi and IV are theirs an
 * octave down, so the roots move by the smaller way round.
 */
export function loopOf(name: KeyName): Chord[] {
  const chords = chordsOf(name)
  return LOOP_DEGREES.map((degree, bar) => {
    const chord = chords[degree]
    const down = bar === 0 ? 0 : 12
    return {
      ...chord,
      midis: chord.midis.map((m) => m - down) as [number, number, number],
    }
  })
}

/** The loop's roots, then do again: C4 G3 A3 F3 C4 in C (FACTS 26), Sing it's line. */
export function rootLine(name: KeyName): number[] {
  const roots = loopOf(name).map((chord) => chord.midis[0])
  return [...roots, roots[0]]
}

export type TuneId = 'tune-1' | 'tune-2' | 'even'

export const TUNE_IDS: readonly TuneId[] = ['tune-1', 'tune-2', 'even']

/** A crotchet, half a second (FACTS 35, 36). */
export const BEAT_SEC = 0.5

/** One note of a tune over the loop. */
export interface TuneNote {
  /** Its onset from the play's start, seconds. */
  readonly t: number
  readonly dur: number
  readonly midi: number
  /** Which of the loop's four chords sounds under it, 0 to 3. */
  readonly bar: number
  /** True when it is a note of that chord: a corner of the lit room. */
  readonly corner: boolean
}

/** A tune as written, in C: each note's MIDI number and its length in crotchets. */
type Written = readonly (readonly [midi: number, beats: number])[]

/** Tune 1 (FACTS 35): E5 D5 C5 E5 | D5 C5 B4 D5 | C5 B4 A4 C5 | A4 G4 F4, the last a minim. */
const TUNE_1: Written = [
  [76, 1],
  [74, 1],
  [72, 1],
  [76, 1],
  [74, 1],
  [72, 1],
  [71, 1],
  [74, 1],
  [72, 1],
  [71, 1],
  [69, 1],
  [72, 1],
  [69, 1],
  [67, 1],
  [65, 2],
]

/** Tune 2 (FACTS 36): G4 C5 E5 | C5 B4 G4 | A4 C5 E5 | F5 D5 C5, long-short-long. */
const TUNE_2: Written = [
  [67, 1.5],
  [72, 0.5],
  [76, 2],
  [72, 1.5],
  [71, 0.5],
  [67, 2],
  [69, 1.5],
  [72, 0.5],
  [76, 2],
  [77, 1.5],
  [74, 0.5],
  [72, 2],
]

/** Tune 2's twelve notes in even lengths, 0.667 s each, 8.0 s in all (FACTS 37). */
const EVEN: Written = TUNE_2.map(
  ([midi]) => [midi, LOOP_SEC / BEAT_SEC / TUNE_2.length] as const,
)

const WRITTEN: Readonly<Record<TuneId, Written>> = {
  'tune-1': TUNE_1,
  'tune-2': TUNE_2,
  even: EVEN,
}

/**
 * The bar sounding at `t` seconds. Even notes of 0.667 s add up to 3.9999…
 * at the third bar's start, so an onset within a microsecond of a bar line
 * belongs to the bar it opens.
 */
const barAt = (t: number): number => Math.floor(t / BAR_SEC + 1e-6)

/** A tune over the key's loop, each note timed from the play's start (FACTS 35 to 37, 69a). */
export function tuneOf(id: TuneId, name: KeyName): TuneNote[] {
  const loop = loopOf(name)
  const shift = KEY[name].shift
  let t = 0
  return WRITTEN[id].map(([written, beats]) => {
    const midi = written + shift
    const bar = barAt(t)
    const note = {
      t,
      dur: beats * BEAT_SEC,
      midi,
      bar,
      corner: onCorner(midi, loop[bar]),
    }
    t += note.dur
    return note
  })
}
