// ============================================================
// Home note's rounds — the keys, and the band's chords in them
// ============================================================
//
// Each round is a key, named by its home note, picked in the singer's own
// window so the note to sing sits where the voice sings. The window is the
// singer's (Echo's: the voiceprint's range, else the voice type's), cut to
// what a phone's speaker carries well: below D3 a phone plays mostly
// overtones, and the band's chords would lose the note they are built on.
// No key repeats the round before it.
//
// The chords are close triads around home, so the band moves as little as
// a pianist's hand does and the leading tone sits a semitone under home:
// I is home's root position, IV its second inversion and V a first
// inversion under it. Each has its root an octave or so below as a bass.
// Pure: the controller passes its random source in, a test a seeded one.

import type { Chord } from './home-note-rules'

/** One round: the key, by its home note. */
export interface HomeRound {
  /** 0 for the first round. */
  readonly index: number
  /** Home, MIDI (whole): the note to sing, in any octave. */
  readonly home: number
}

/** The notes home may be, MIDI, inclusive. */
export interface NoteWindow {
  readonly low: number
  readonly high: number
}

/** The lowest and highest home: D3 and D5. */
export const AUDIBLE_LOW = 50
export const AUDIBLE_HIGH = 74
/** With nothing known of the singer: G3 to G4. */
const DEFAULT_WINDOW: NoteWindow = { low: 55, high: 67 }
/** A window narrower than this many semitones is widened about its middle. */
const MIN_SPAN = 5

/**
 * The window a run draws its keys from: the singer's, inside the audible
 * band, at least MIN_SPAN wide.
 */
export function roundWindow(
  singer: { readonly low: number; readonly high: number } | null,
): NoteWindow {
  if (
    singer === null ||
    !Number.isFinite(singer.low) ||
    !Number.isFinite(singer.high) ||
    singer.high < singer.low
  ) {
    return DEFAULT_WINDOW
  }
  const low = Math.max(AUDIBLE_LOW, Math.ceil(singer.low))
  const high = Math.min(AUDIBLE_HIGH, Math.floor(singer.high))
  if (high - low >= MIN_SPAN) return { low, high }
  // Too narrow, or outside the band altogether: the middle, widened.
  const middle = Math.min(
    AUDIBLE_HIGH - MIN_SPAN / 2,
    Math.max(AUDIBLE_LOW + MIN_SPAN / 2, (singer.low + singer.high) / 2),
  )
  const from = Math.round(middle - MIN_SPAN / 2)
  return { low: from, high: from + MIN_SPAN }
}

/** A whole note in the window, never the one before it. */
export function pickHome(
  window: NoteWindow,
  previous: number | null,
  random: () => number,
): number {
  const count = window.high - window.low + 1
  const first = window.low + Math.min(count - 1, Math.floor(random() * count))
  if (previous === null || first !== previous || count < 2) return first
  // Uniform over the other notes: a step of 1 to count-1, round the window.
  const step = 1 + Math.min(count - 2, Math.floor(random() * (count - 1)))
  return window.low + ((first - window.low + step) % count)
}

/** The run's rounds, each a key. */
export function planRounds(
  count: number,
  window: NoteWindow,
  random: () => number,
): HomeRound[] {
  const rounds: HomeRound[] = []
  for (let index = 0; index < count; index++) {
    const previous = rounds[index - 1]?.home ?? null
    rounds.push({ index, home: pickHome(window, previous, random) })
  }
  return rounds
}

/** A chord as the band plays it: its bass, then its triad, MIDI. */
export interface VoicedChord {
  readonly bass: number
  readonly triad: readonly [number, number, number]
}

/** The chord in the key of `home`, close around home. */
export function voiceChord(home: number, chord: Chord): VoicedChord {
  switch (chord) {
    case 'I':
      return { bass: home - 12, triad: [home, home + 4, home + 7] }
    case 'IV':
      // Second inversion: home stays, the sixth and the fourth above it.
      return { bass: home - 7, triad: [home, home + 5, home + 9] }
    case 'V':
      // First inversion: the leading tone a semitone under home.
      return { bass: home - 5, triad: [home - 1, home + 2, home + 7] }
  }
}
