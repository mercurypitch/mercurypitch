// ============================================================
// What First note's stage shows: the countdown, the line, the chip
// ============================================================
//
// Pure readings of a round for the room to draw, shared by a run and its
// demo (demo/useFirstNoteDemo.ts), which lead in on different clocks: a
// run's band is the song player's, on its element's own clock, and the
// demo's is its clip, on the take's. Both say where the band is on the
// song's clock, and the countdown is read from that.

import type { Countdown } from './first-note-controller-contract'
import type { EntryHeard, FirstNotePhase } from './first-note-machine'
import type { LineShows } from './first-note-rules'
import type { FirstNoteEntry } from './first-note-songs'

/** The lead-in's countdown with the band at `at` on the song's clock, s. */
export function countdownAt(entry: FirstNoteEntry, at: number): Countdown {
  const span = entry.at - entry.from
  const progress =
    span > 0 ? Math.min(1, Math.max(0, (at - entry.from) / span)) : 0
  const lit = entry.beats.filter((beat) => at >= beat).length
  return { progress, beats: entry.beats.length, lit }
}

/** Near enough to the countdown shown not to draw it again. */
export function sameCountdown(
  shown: Countdown | null,
  next: Countdown,
): boolean {
  return (
    shown !== null &&
    shown.lit === next.lit &&
    shown.beats === next.beats &&
    Math.abs(shown.progress - next.progress) < 0.005
  )
}

/**
 * The note's line shows: by the level in the turn (`shows`), and always
 * once the round is over.
 */
export function lineShows(
  shows: LineShows,
  phase: FirstNotePhase,
  entered: boolean,
): boolean {
  switch (phase) {
    case 'band':
      return shows === 'always'
    case 'sing':
      return shows === 'always' || (shows === 'afterEntry' && entered)
    case 'landed':
    case 'missed':
      return true
    default:
      return false
  }
}

/** The chip once the singer has come in. */
export function entryChip(entry: EntryHeard): string {
  if (entry.onNote) return 'On the note'
  return entry.cents < 0 ? 'Came in low' : 'Came in high'
}
