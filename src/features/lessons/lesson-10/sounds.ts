// ============================================================
// Lesson 10 sounds — the notes of the page's fixed sounds, at FACTS 72 to 81
// ============================================================
//
// Every fixed sound on the page as timed notes, the kit's run notes
// (kit/run.ts), so the page's stoppable runs play them as they are. Times
// are seconds from the press, each note its own voice. Notes that sound
// together are a chord's voices, each at 0.075, so three sound at about
// 1.7 times one tapped note under the master's compressor (FACTS 81); a
// note on its own carries no level and takes the run's, the soft tone's
// 0.13. The page plays them all in the soft tone (WEB-SPEC, Audio).
//
// The cold open's chord is C4, E4 and G4 for 1.6 s (FACTS 72); each move
// holds two of them for 3.1 s while the third glides down a semitone, one
// voice along a contour, after 1.2 s, in 0.4 s (FACTS 73). A third is its
// two notes, 0.6 s each, then together for 1.0 s, and a triad its three at
// 0.55 s, then together for 1.2 s (FACTS 75). The pattern is root, fifth,
// third, fifth, four times over in quavers, each sounding nine tenths of
// its length, then the chord for 1.0 s: 7.857 s at Slow's 70 crotchets a
// minute, 4.0 s at Fast's 160 (FACTS 76). A scale is 0.45 s a note, the
// last 0.9 s (FACTS 77). Slow doubles every onset and length (FACTS 75,
// 77). Every note is a MIDI number and sounds at hz(m), so every frequency
// is FACTS 70's.

import { hz } from '@/features/lessons/kit/notes'
import type { RunNote } from '@/features/lessons/kit/run'
import type { ContourPoint } from '@/features/lessons/kit/sound'
import { contourLength, contourOf } from '@/features/lessons/kit/sound'
import type { Quality, Role } from './chords'
import { DEGREES, ROLES, THIRD_OF, triad } from './chords'

/** A chord's voices, each (FACTS 81). */
export const CHORD_GAIN = 0.075
/** Slow: every onset and length twice as long (FACTS 75, 77). */
export const SLOW = 2

/** The cold open's chord, C4, E4 and G4 together (FACTS 72). */
export const CHORD_C_SEC = 1.6
/** A move: the chord held, the glide down a semitone, and the chord held again (FACTS 73). */
export const MOVE = { hold: 1.2, glide: 0.4, rest: 1.5 } as const
/** A move's length: 3.1 s. */
export const MOVE_SEC = MOVE.hold + MOVE.glide + MOVE.rest
/** A third: each note, then the two together (FACTS 75). */
export const THIRD = { each: 0.6, together: 1 } as const
/** A triad: each note, then the three together (FACTS 74, 75). */
export const TRIAD = { each: 0.55, together: 1.2 } as const
/** The Four words' Third: C4, then E4 (FACTS 74). */
export const WORD_PAIR = { first: 0.6, second: 0.8, gap: 0.15 } as const
/** The Four words' Quality: each chord together, and the silence between (FACTS 74). */
export const WORD_QUALITY = { each: 1.4, gap: 0.4 } as const
/** A scale: each note, and the last (FACTS 74, 77). */
export const SCALE = { each: 0.45, last: 0.9 } as const
/** Quick check question 2's chord, D4, F4 and A4 together (FACTS 79). */
export const QUIZ_CHORD_SEC = 1.4

/** Step 4's two tempos. */
export type Tempo = 'slow' | 'fast'

/** A quaver at each tempo: 70 and 160 crotchets a minute (FACTS 76). */
export const QUAVER: Readonly<Record<Tempo, number>> = {
  slow: 30 / 70,
  fast: 30 / 160,
}
/** How much of its quaver each note of the pattern sounds (FACTS 76). */
export const PATTERN_HELD = 0.9
/** The chord that ends the pattern (FACTS 76). */
export const PATTERN_CHORD_SEC = 1
/** The pattern's sixteen quavers, by chord tone: root, fifth, third, fifth, four times (FACTS 42). */
export const PATTERN: readonly Role[] = Array.from(
  { length: 16 },
  (_, i) => (['root', 'fifth', 'third', 'fifth'] as const)[i % 4],
)

/** Notes one after another from `from` seconds, `dur` each, at the run's level. */
const inTurn = (midis: readonly number[], dur: number, from = 0): RunNote[] =>
  midis.map((midi, i) => ({ t: from + i * dur, midi, dur }))

/** Notes together at `t`, for `dur`, each at a chord voice's level. */
const together = (
  midis: readonly number[],
  t: number,
  dur: number,
): RunNote[] => midis.map((midi) => ({ t, midi, dur, gain: CHORD_GAIN }))

const triadMidis = (root: number, quality: Quality): number[] =>
  triad(root, quality).map((n) => n.midi)

/** Seconds from a sound's start to the end of its last note. */
export const lengthOf = (notes: readonly RunNote[]): number =>
  notes.reduce((end, n) => Math.max(end, n.t + n.dur), 0)

/** Slow: every onset and length `by` times as long, every pitch and level as it was. */
export const slow = (notes: readonly RunNote[], by = SLOW): RunNote[] =>
  notes.map((n) => ({ ...n, t: n.t * by, dur: n.dur * by }))

/** A triad's three notes together for `dur` seconds. */
export const chordSound = (
  root: number,
  quality: Quality,
  dur: number,
): RunNote[] => together(triadMidis(root, quality), 0, dur)

/** `chord-c`, the cold open's Play the chord (FACTS 72). */
export const CHORD_C: readonly RunNote[] = chordSound(60, 'major', CHORD_C_SEC)

// -------------------------------------------------------------- the moves

/** The cold open's two moves: mi or so, down a semitone. */
export type MoveId = 'mi' | 'so'

export const MOVE_IDS: readonly MoveId[] = ['mi', 'so']

/** A move: two notes held throughout, and the moving note, one voice along a contour. */
export interface MoveSound {
  readonly held: readonly RunNote[]
  /** The moving note's path, from its own pitch to a semitone below. */
  readonly line: readonly ContourPoint[]
  /** The moving note's level, a chord voice's. */
  readonly gain: number
  /** The moving note before and after, MIDI. */
  readonly from: number
  readonly to: number
}

/** The note each move takes down: mi is C major's third, so its fifth. */
const MOVING_ROLE: Readonly<Record<MoveId, Role>> = { mi: 'third', so: 'fifth' }

/**
 * `move-mi` or `move-so` (FACTS 73): C4, E4 and G4 together; after 1.2 s
 * the moving note glides down a semitone in 0.4 s while the other two
 * hold, and the three hold 1.5 s more.
 */
export function moveSound(move: MoveId): MoveSound {
  const notes = triadMidis(60, 'major')
  const k = ROLES.indexOf(MOVING_ROLE[move])
  const from = notes[k]
  const to = from - 1
  return {
    held: together(
      notes.filter((_, i) => i !== k),
      0,
      MOVE_SEC,
    ),
    line: contourOf(hz(from), [
      { hold: MOVE.hold },
      { glide: MOVE.glide, to: hz(to) },
      { hold: MOVE.rest },
    ]),
    gain: CHORD_GAIN,
    from,
    to,
  }
}

/** A move's length: its held notes' and its line's, 3.1 s. */
export const moveLength = (m: MoveSound): number =>
  Math.max(lengthOf(m.held), contourLength(m.line))

// -------------------------------------------------------------- Steps 1 to 5

/**
 * Two notes a third apart, `lo` then `hi`, 0.6 s each, then together for
 * 1.0 s (FACTS 75): Step 1's Play the third, and a gap button's play.
 */
export const gapSound = (lo: number, hi: number): RunNote[] => [
  ...inTurn([lo, hi], THIRD.each),
  ...together([lo, hi], 2 * THIRD.each, THIRD.together),
]

/** Step 1's third on `root`: the root and the note 4 or 3 semitones above. */
export const thirdSound = (root: number, quality: Quality): RunNote[] =>
  gapSound(root, root + THIRD_OF[quality])

/** Play the triad: its notes at 0.55 s each, then together for 1.2 s (FACTS 75). */
export function triadSound(root: number, quality: Quality): RunNote[] {
  const midis = triadMidis(root, quality)
  return [
    ...inTurn(midis, TRIAD.each),
    ...together(midis, midis.length * TRIAD.each, TRIAD.together),
  ]
}

/**
 * Step 4's pattern at a tempo (FACTS 76): its quavers from quaver `from`
 * (0 to 16) to the last, each sounding nine tenths of its length, then the
 * chord for 1.0 s, timed from the first quaver it plays. A switch while the
 * pattern plays takes effect from the next quaver (WEB-SPEC, Toys 1): the
 * page plays the rest from there, `from` the quavers already heard.
 */
export function patternSound(
  root: number,
  quality: Quality,
  tempo: Tempo,
  from = 0,
): RunNote[] {
  const q = QUAVER[tempo]
  const [r, t, f] = triadMidis(root, quality)
  const midi: Readonly<Record<Role, number>> = { root: r, third: t, fifth: f }
  const quavers = PATTERN.slice(from).map((role, i) => ({
    t: i * q,
    midi: midi[role],
    dur: q * PATTERN_HELD,
  }))
  return [
    ...quavers,
    ...together([r, t, f], quavers.length * q, PATTERN_CHORD_SEC),
  ]
}

/** Step 5's scale on `root`, do to do: 0.45 s a note, the last 0.9 s (FACTS 77). */
export function scaleSound(root: number, quality: Quality): RunNote[] {
  const midis = DEGREES[quality].map((d) => root + d)
  const notes = inTurn(midis, SCALE.each)
  const last = notes[notes.length - 1]
  return [...notes.slice(0, -1), { ...last, dur: SCALE.last }]
}

// -------------------------------------------------------------- the Four words

/** The Four words, in the page's order. */
export type WordId = 'third' | 'triad' | 'quality' | 'natural-minor'

export const WORD_IDS: readonly WordId[] = [
  'third',
  'triad',
  'quality',
  'natural-minor',
]

/**
 * Each word's play (FACTS 74): Third, C4 then E4, 0.6 s and 0.8 s, 0.15 s
 * apart; Triad, C, E and G at 0.55 s each, then together for 1.2 s;
 * Quality, C major, then C minor, each together for 1.4 s, 0.4 s apart;
 * Natural minor, its scale on C4.
 */
export function wordSounds(): Readonly<Record<WordId, RunNote[]>> {
  const [c, e] = triadMidis(60, 'major')
  return {
    third: [
      { t: 0, midi: c, dur: WORD_PAIR.first },
      {
        t: WORD_PAIR.first + WORD_PAIR.gap,
        midi: e,
        dur: WORD_PAIR.second,
      },
    ],
    triad: triadSound(60, 'major'),
    quality: [
      ...chordSound(60, 'major', WORD_QUALITY.each),
      ...together(
        triadMidis(60, 'minor'),
        WORD_QUALITY.each + WORD_QUALITY.gap,
        WORD_QUALITY.each,
      ),
    ],
    'natural-minor': scaleSound(60, 'minor'),
  }
}

/** Quick check question 2's chord: D4, F4 and A4 together, a D minor triad (FACTS 79). */
export const QUIZ_CHORD: readonly RunNote[] = chordSound(
  62,
  'minor',
  QUIZ_CHORD_SEC,
)
