// ============================================================
// Chip pacer: one line per situation under the timer, never a flicker
// ============================================================
//
// A premium room works out the take's situation on every captured frame
// (in Long note: on the note, steady, sharp, flat, off the note, or nothing
// certain yet) from the same engine state its picture follows, and hands
// it here, as one of the exercise's moments (`M`, the keys of its lines).
// The pacer puts a situation on screen only when it differs from the one
// shown and that one has stood for `holdSeconds`. Until then the newest
// situation waits, and an uncertain frame (null) drops the wait, so a line
// that finally shows is true on the frame it shows. The same situation is
// never re-worded while it lasts: a voice that stays sharp keeps one line.

/** Clock sums of 1/60 drift by 1e-15; the hold compares with this slack. */
const EPS = 1e-6

export interface ChipPacer<M extends string = string> {
  /** The situation on screen now; null when the chip is empty. */
  readonly shown: M | null
  /**
   * The situation on this frame; null when nothing is certain yet (the
   * line on screen stays, and nothing waits behind it).
   */
  want: (moment: M | null) => void
  /**
   * The situation to put on screen at this clock (seconds), once; null to
   * leave the chip as it is.
   */
  take: (clock: number) => M | null
  /** An empty chip, with nothing waiting. */
  reset: () => void
}

export function createChipPacer<M extends string = string>(
  holdSeconds: number,
): ChipPacer<M> {
  let shown: M | null = null
  let shownAt = Number.NEGATIVE_INFINITY
  let wanted: M | null = null
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
