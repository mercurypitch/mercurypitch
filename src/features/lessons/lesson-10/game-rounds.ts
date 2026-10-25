// ============================================================
// Lesson 10 game rounds — Major or minor?, on thirds and on chords
// ============================================================
//
// The deals the kit's ear game takes as `deal(random)` (kit/ear-game.ts),
// pure, so a fixed seed deals a known game (WEB-SPEC, Toys 5; Tests 7). On
// thirds, eight rounds: a root from C4 to G4, then the note 3 or 4
// semitones above it, 0.6 s and 0.8 s, 0.15 s apart. On chords, ten
// rounds, as the Royal Conservatory's 2019 voice syllabus sets its chord
// test: the first five notes of a major or minor scale on a root from C4 to
// G4 at 0.32 s each, 0.25 s of silence, then its triad together for 1.2 s
// (FACTS 21, 43, 78). Every note lies between C4 and D5, G4's so (FACTS
// 70a). Each answer gets half the rounds, shuffled, so a short run cannot
// lean to one answer. The roots take any of the eight keys, black ones
// too: the feedback names no letters, since the point is the gap.
//
// Each round's line names the interval or the chord and the sound, never
// the listener (playbook rule 21). The kit prints "Yes." or "Here it is
// again, slower." before it, so no line starts with "Yes". A round's notes
// carry no level: the page's play sounds the chord's three together at a
// chord voice's level (lesson-10/sounds.ts).

import type { EarNote, EarRound } from '@/features/lessons/kit/ear-game'
import type { Quality } from './chords'
import { DEGREES, FIFTH, QUALITIES, THIRD_OF } from './chords'

/** The answers, in key order: 1 is Major, 2 is Minor. */
export const ANSWERS: readonly Quality[] = QUALITIES

/** Every round's root: C4 to G4 (FACTS 78). */
export const ROOT_LO = 60
export const ROOT_HI = 67

/** How many rounds each game deals (FACTS 78). */
export const THIRDS_ROUNDS = 8
export const CHORDS_ROUNDS = 10

/** A thirds round: the root, then the note above, and the silence between (FACTS 78). */
export const THIRD_ROUND = { first: 0.6, second: 0.8, gap: 0.15 } as const
/** A chords round: each scale note, the silence after them, and the triad (FACTS 78). */
export const CHORD_ROUND = { each: 0.32, silence: 0.25, chord: 1.2 } as const
/** How many of the scale's notes a chords round plays before its triad (FACTS 21). */
export const SCALE_NOTES = 5

/** How much slower a missed round plays again, as Lesson 6's games replay a missed pair (FACTS 78). */
export const MISS_SLOWER = 1.5

/** Each thirds round's line, after "Yes." or "Here it is again, slower." (WEB-SPEC, Toys 5). */
export const THIRD_WORDS: Readonly<Record<Quality, string>> = {
  major: 'A major third: 4 semitones up.',
  minor: 'A minor third: 3 semitones up.',
}

/** Each chords round's line (WEB-SPEC, Toys 5). */
export const CHORD_WORDS: Readonly<Record<Quality, string>> = {
  major: 'Major: its third sat 4 semitones above the root, do-mi-so.',
  minor: 'Minor: its third sat 3 semitones above the root, do-me-so.',
}

/** A thirds round's notes on `root`: the root, then the third above it. */
export const thirdRoundNotes = (root: number, quality: Quality): EarNote[] => [
  { midi: root, at: 0, dur: THIRD_ROUND.first },
  {
    midi: root + THIRD_OF[quality],
    at: THIRD_ROUND.first + THIRD_ROUND.gap,
    dur: THIRD_ROUND.second,
  },
]

/** A chords round's notes on `root`: the scale's first five, a silence, then the triad together. */
export function chordRoundNotes(root: number, quality: Quality): EarNote[] {
  const scale = DEGREES[quality].slice(0, SCALE_NOTES).map((d, i) => ({
    midi: root + d,
    at: i * CHORD_ROUND.each,
    dur: CHORD_ROUND.each,
  }))
  const at = SCALE_NOTES * CHORD_ROUND.each + CHORD_ROUND.silence
  const chord = [0, THIRD_OF[quality], FIFTH].map((d) => ({
    midi: root + d,
    at,
    dur: CHORD_ROUND.chord,
  }))
  return [...scale, ...chord]
}

const rootOf = (random: () => number): number =>
  ROOT_LO + Math.floor(random() * (ROOT_HI - ROOT_LO + 1))

/** Each answer for half of `count` rounds, in a Fisher-Yates shuffle. */
export function halfEach(random: () => number, count: number): Quality[] {
  const out = Array.from({ length: count }, (_, i) =>
    i < count / 2 ? ANSWERS[0] : ANSWERS[1],
  )
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/** Eight rounds of Major or minor? on thirds, four of each. */
export function dealThirds(random: () => number): EarRound<Quality>[] {
  return halfEach(random, THIRDS_ROUNDS).map((answer) => ({
    events: thirdRoundNotes(rootOf(random), answer),
    answer,
    words: THIRD_WORDS[answer],
  }))
}

/** Ten rounds of Major or minor? on chords, five of each. */
export function dealChords(random: () => number): EarRound<Quality>[] {
  return halfEach(random, CHORDS_ROUNDS).map((answer) => ({
    events: chordRoundNotes(rootOf(random), answer),
    answer,
    words: CHORD_WORDS[answer],
  }))
}
