// ============================================================
// Leap's rules — each level's leaps, its help and its timing
// ============================================================
//
// A run is LEAP_ROUNDS leaps. In each, Merc sings his note on the near
// ledge and names the leap; the singer sings his note, then leaps to the
// second, the target faint on the far ledge. The levels are the ones the
// owner approved with the room's mock-ups (1 Nov 2026,
// docs/plans/ear-rooms.md, Room 3):
//
//   Learning      fourths and fifths up; Merc sings both notes first and
//                 names the song that opens on the leap, and the singer
//                 matches him
//   Singer        fourths, fifths and sixths up; Merc sings his note and
//                 names the song, and the singer finds the second
//   Professional  thirds to the octave, up and down, named by the
//                 interval alone
//
// The leap is the sequence engine's (src/lib/sequence): a two-note phrase,
// Merc's note then the target, in free time. The leap lands when the
// target does. A voice that leaves out Merc's note and goes straight to
// the target has still found it by ear from his, and the engine lands it
// (the note it skipped misses). Never folded to an octave: a fourth down
// is a fifth up an octave away, and the fold would land it.

import type { SequencePreset } from '@/lib/sequence/sequence-engine'
import type { ExerciseLevel } from '@/stores/exercise-level'

/** Leaps in a run. */
export const LEAP_ROUNDS = 6

/** A leap's size, semitones: thirds, the fourth, the fifth, sixths, the octave. */
export type LeapSize = 3 | 4 | 5 | 7 | 8 | 9 | 12

/** One kind of leap: its size and its way. */
export interface LeapKind {
  readonly size: LeapSize
  readonly up: boolean
}

/** Merc's notes in his call, and in his answer after a miss, s. */
export const MERC_NOTE_SECONDS = 0.9
/** The breath between Merc's two notes, s. */
export const MERC_GAP_SECONDS = 0.15
/** A call is scheduled this far ahead of now, s. */
export const SOUND_LEAD_SECONDS = 0.1
/** A landing is cheered this long before the next leap, ms. */
export const BETWEEN_ROUNDS_MS = 1900
/** After Merc's answer to a miss, this long before the next leap, ms. */
export const AFTER_ANSWER_MS = 700

export interface LeapLevel extends SequencePreset {
  /** The leaps a run draws from, each as often as the others. */
  readonly leaps: readonly LeapKind[]
  /** Merc sings the target after his note: the singer matches both. */
  readonly mercSingsBoth: boolean
  /** Merc names the song that opens on the leap. */
  readonly namesSong: boolean
  /** "Hear Merc again": at any time in the singer's turn, once a leap, never. */
  readonly hearAgain: 'anyTime' | 'oncePerRound' | 'never'
}

const up = (size: LeapSize): LeapKind => ({ size, up: true })
const down = (size: LeapSize): LeapKind => ({ size, up: false })

/** The sizes Professional draws, each up and down. */
const PRO_SIZES: readonly LeapSize[] = [3, 4, 5, 7, 8, 9, 12]

/** Each level's leaps and how strictly it hears the target. */
export const LEAP_LEVELS: Readonly<Record<ExerciseLevel, LeapLevel>> = {
  learning: {
    leaps: [up(5), up(7)],
    mercSingsBoth: true,
    namesSong: true,
    hearAgain: 'anyTime',
    tolCents: 50,
    landMs: 300,
    octaveFold: false,
    timing: { mode: 'free', deadlineMs: 5000, endSilenceMs: 2500 },
  },
  singer: {
    leaps: [up(5), up(7), up(9)],
    mercSingsBoth: false,
    namesSong: true,
    hearAgain: 'oncePerRound',
    tolCents: 35,
    landMs: 300,
    octaveFold: false,
    timing: { mode: 'free', deadlineMs: 4500, endSilenceMs: 2200 },
  },
  professional: {
    leaps: PRO_SIZES.flatMap((size) => [up(size), down(size)]),
    mercSingsBoth: false,
    namesSong: false,
    hearAgain: 'never',
    tolCents: 25,
    landMs: 250,
    octaveFold: false,
    timing: { mode: 'free', deadlineMs: 4000, endSilenceMs: 2000 },
  },
}

/** Each size as a musician names it. */
const SIZE_NAME: Readonly<Record<LeapSize, string>> = {
  3: 'minor third',
  4: 'major third',
  5: 'fourth',
  7: 'fifth',
  8: 'minor sixth',
  9: 'sixth',
  12: 'octave',
}

/**
 * The size's name: "fifth", "octave". `precise` says "major sixth" for the
 * sixth, at a level that asks for the minor one too.
 */
export function sizeName(size: LeapSize, precise = false): string {
  return precise && size === 9 ? 'major sixth' : SIZE_NAME[size]
}

/** The leap as a phrase: "Up a fifth", "Down an octave". */
export function leapName(kind: LeapKind, precise = false): string {
  const name = sizeName(kind.size, precise)
  const article = name === 'octave' ? 'an' : 'a'
  return `${kind.up ? 'Up' : 'Down'} ${article} ${name}`
}

/** The level asks for the minor sixth too: its sixth is named "major". */
export function namesPrecisely(level: LeapLevel): boolean {
  return level.leaps.some((kind) => kind.size === 8)
}

/** A public-domain song that opens on a leap, as Merc names it. */
export interface LeapSong {
  /** Its title in full, on the result's rows. */
  readonly title: string
  /** As Merc says it in a line. */
  readonly short: string
}

/**
 * The songs that open on the leaps Learning and Singer ask for, all up:
 * Wagner's Bridal Chorus (a fourth), the nursery tune (a fifth) and the
 * Scottish song (a sixth). Public domain, every one.
 */
const SONGS: Partial<Record<LeapSize, LeapSong>> = {
  5: { title: 'Here Comes the Bride', short: 'Here Comes the Bride' },
  7: { title: 'Twinkle, Twinkle, Little Star', short: 'Twinkle, Twinkle' },
  9: { title: 'My Bonnie Lies over the Ocean', short: 'My Bonnie' },
}

/** The song that opens on this leap, or null: only these three, upward. */
export function leapSong(kind: LeapKind): LeapSong | null {
  return kind.up ? (SONGS[kind.size] ?? null) : null
}

/** Two kinds are the same leap. */
export function sameLeap(a: LeapKind, b: LeapKind): boolean {
  return a.size === b.size && a.up === b.up
}
