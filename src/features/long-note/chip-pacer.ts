// ============================================================
// Chip pacer — one line per situation under the timer, never a flicker
// ============================================================
//
// The room works out the hold's situation on every captured frame (on the
// note, steady, sharp, flat, off the note, or nothing certain yet) from
// the same engine state the trace colours itself by, and hands it here.
// The pacer puts a situation on screen only when it differs from the one
// shown and that one has stood for `holdSeconds`. Until then the newest
// situation waits, and an uncertain frame (null) drops the wait, so a line
// that finally shows is true on the frame it shows. The same situation is
// never re-worded while it lasts: a voice that stays sharp keeps one line.

import type { LongNoteMoment } from './merc-lines'

/** Clock sums of 1/60 drift by 1e-15; the hold compares with this slack. */
const EPS = 1e-6

export interface ChipPacer {
  /** The situation on screen now; null when the chip is empty. */
  readonly shown: LongNoteMoment | null
  /**
   * The situation on this frame; null when nothing is certain yet (the
   * line on screen stays, and nothing waits behind it).
   */
  want: (moment: LongNoteMoment | null) => void
  /**
   * The situation to put on screen at this clock (seconds), once; null to
   * leave the chip as it is.
   */
  take: (clock: number) => LongNoteMoment | null
  /** An empty chip, with nothing waiting. */
  reset: () => void
}

export function createChipPacer(holdSeconds: number): ChipPacer {
  let shown: LongNoteMoment | null = null
  let shownAt = Number.NEGATIVE_INFINITY
  let wanted: LongNoteMoment | null = null
  return {
    get shown() {
      return shown
    },
    want(moment) {
      wanted = moment
    },
    take(clock) {
      if (wanted === null) return null
      if (wanted === shown) {
        wanted = null
        return null
      }
      if (clock - shownAt < holdSeconds - EPS) return null
      shown = wanted
      shownAt = clock
      wanted = null
      return shown
    },
    reset() {
      shown = null
      shownAt = Number.NEGATIVE_INFINITY
      wanted = null
    },
  }
}
