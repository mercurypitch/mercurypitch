// ============================================================
// Home note's rules — each level's intro, its band and its timing
// ============================================================
//
// A run is HOME_NOTE_ROUNDS rounds, each in a new key. The band plays a
// short intro in the key, the band stops, and the singer sings the note the
// intro calls home. The level decides how much help the intro gives:
//
//   Learning      I IV V I, and Merc sings home after it: the singer hears
//                 the note and matches it, in its key
//   Singer        I IV V, ending on the chord that pulls home: the singer
//                 finds home with no one singing it first
//   Professional  IV V only: the key is never stated, only implied
//
// Home is home in any octave, so every level folds the voice to the
// nearest octave of the note (the sequence engine's octave fold). The
// band is silent while the singer sings: the phone's speaker would reach
// the microphone, as Merc's call does in Echo.
//
// The landing is the sequence engine's (src/lib/sequence): a one-note
// phrase that lands when the voice holds in the band for `landMs`, and
// misses at its deadline or once the voice has started and then gone quiet
// for `endSilenceMs`.

import type { SequencePreset } from '@/lib/sequence/sequence-engine'
import type { ExerciseLevel } from '@/stores/exercise-level'

/** Rounds in a run. */
export const HOME_NOTE_ROUNDS = 6

/** A chord of the intro, by its degree in the key. */
export type Chord = 'I' | 'IV' | 'V'

/** Each chord of the intro, s. */
export const CHORD_SECONDS = 0.72
/** A breath between the band's last chord and Merc singing home, s. */
export const MERC_GAP_SECONDS = 0.18
/** Merc's home note, at Learning, s. */
export const MERC_HOME_SECONDS = 1.0
/** The intro's sound is scheduled this far ahead of now, s. */
export const SOUND_LEAD_SECONDS = 0.1
/** The band resolving under a landed note, or under Merc's answer, s. */
export const RESOLVE_SECONDS = 1.5
/** The resolution plays out before the next round's intro, ms. */
export const BETWEEN_ROUNDS_MS = 1900

export interface HomeNoteLevel extends SequencePreset {
  /** The band's intro, in order. */
  readonly intro: readonly Chord[]
  /** Merc sings home after the intro: the singer matches it. */
  readonly mercSingsHome: boolean
  /** "Hear it again": at any time in the singer's turn, once a round, never. */
  readonly hearAgain: 'anyTime' | 'oncePerRound' | 'never'
}

/** Each level's intro and how strictly it hears home. */
export const HOME_NOTE_LEVELS: Readonly<Record<ExerciseLevel, HomeNoteLevel>> =
  {
    learning: {
      intro: ['I', 'IV', 'V', 'I'],
      mercSingsHome: true,
      hearAgain: 'anyTime',
      tolCents: 50,
      landMs: 300,
      octaveFold: true,
      timing: { mode: 'free', deadlineMs: 9000, endSilenceMs: 3500 },
    },
    singer: {
      intro: ['I', 'IV', 'V'],
      mercSingsHome: false,
      hearAgain: 'oncePerRound',
      tolCents: 35,
      landMs: 300,
      octaveFold: true,
      timing: { mode: 'free', deadlineMs: 8000, endSilenceMs: 3000 },
    },
    professional: {
      intro: ['IV', 'V'],
      mercSingsHome: false,
      hearAgain: 'never',
      tolCents: 25,
      landMs: 250,
      octaveFold: true,
      timing: { mode: 'free', deadlineMs: 7000, endSilenceMs: 2500 },
    },
  }

/** The intro's length, from its first chord to Merc's last moment, s. */
export function introSeconds(level: HomeNoteLevel): number {
  const band = level.intro.length * CHORD_SECONDS
  return level.mercSingsHome
    ? band + MERC_GAP_SECONDS + MERC_HOME_SECONDS
    : band
}
