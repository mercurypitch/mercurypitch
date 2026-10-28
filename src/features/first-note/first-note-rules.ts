// ============================================================
// First note's rules — what each level shows, and its timing
// ============================================================
//
// A run is FIRST_NOTE_ROUNDS entries: ENTRIES_PER_SONG from each of the
// example songs, or shared out over the singer's own songs or a mix of the
// two (first-note-songs.ts). In each, the band plays the song's
// lead-in and stops where its singer comes in, and the singer sings that
// first note. Their entry is judged by ear first: the first note their
// voice sits on (ENTRY_MS of it, steady inside ENTRY_STEADY_CENTS) is
// where they came in. Then they can find the note and hold it to land.
//
// The level decides when the note's line shows, and how close is close:
//
//   Learning      the line shows from the start: come in and slide onto it
//   Singer        the line shows once the singer has come in, so the entry
//                 is theirs alone, and the correction is guided
//   Professional  no line until the voice lands: the trail moves, and only
//                 the light around it says it is there
//
// Any octave counts, at every level: many singers sing a song an octave
// from its singer. The band is silent while the singer sings: the phone's
// speaker would reach the microphone, as the band does in Home note.
//
// The landing is the sequence engine's (src/lib/sequence): a one-note
// phrase that lands when the voice holds in the band for `landMs`, and
// misses at its deadline or once the voice has started and then gone quiet
// for `endSilenceMs`.

import type { SequencePreset } from '@/lib/sequence/sequence-engine'
import type { ExerciseLevel } from '@/stores/exercise-level'

/** Entries from each example song in a run. */
export const ENTRIES_PER_SONG = 2
/** Entries in a run: two from each of the three examples. */
export const FIRST_NOTE_ROUNDS = 6
/**
 * A song of the singer's own with fewer clean entries than this sits out
 * its runs, and the room says so: a song with one place to come in would
 * ask the same thing every run.
 */
export const OWN_SONG_MIN_ENTRIES = 2

/** The singer's entry: the first note held this long, ms ... */
export const ENTRY_MS = 200
/** ... inside this much of its centre either way, cents. */
export const ENTRY_STEADY_CENTS = 40
/**
 * ... on one run of voice: no gap between readings longer than this, s. A
 * breath splits it; a phone whose pitch tracker reads only a few times a
 * second does not (the landing counts time between readings the same way).
 */
export const ENTRY_RUN_GAP_SEC = 0.3

/** The band fades out over this, ending where the singer comes in, s. */
export const BAND_RELEASE_SECONDS = 0.12
/** Merc's note after a miss, s. */
export const MERC_NOTE_SECONDS = 1.0
/** A breath between Merc's note and the singer coming in, s. */
export const MERC_GAP_SECONDS = 0.3
/** After the line, a breath before the next lead-in, ms. */
export const BETWEEN_ROUNDS_MS = 900

/** When the note's line shows in the singer's turn. */
export type LineShows = 'always' | 'afterEntry' | 'onLanding'

export interface FirstNoteLevel extends SequencePreset {
  readonly line: LineShows
  /** "Hear the band again": at any time in the turn, once a round, never. */
  readonly hearAgain: 'anyTime' | 'oncePerRound' | 'never'
}

/** Each level's line and how strictly it hears the note. */
export const FIRST_NOTE_LEVELS: Readonly<
  Record<ExerciseLevel, FirstNoteLevel>
> = {
  learning: {
    line: 'always',
    hearAgain: 'anyTime',
    tolCents: 50,
    landMs: 300,
    octaveFold: true,
    timing: { mode: 'free', deadlineMs: 9000, endSilenceMs: 3500 },
  },
  singer: {
    line: 'afterEntry',
    hearAgain: 'oncePerRound',
    tolCents: 35,
    landMs: 300,
    octaveFold: true,
    timing: { mode: 'free', deadlineMs: 8000, endSilenceMs: 3000 },
  },
  professional: {
    line: 'onLanding',
    hearAgain: 'never',
    tolCents: 25,
    landMs: 250,
    octaveFold: true,
    timing: { mode: 'free', deadlineMs: 7000, endSilenceMs: 2500 },
  },
}
