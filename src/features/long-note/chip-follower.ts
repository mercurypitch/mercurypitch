// ============================================================
// Chip follower — what the chip under the timer says, frame by frame
// ============================================================
//
// The chip's situation is read off the same engine state the trace colours
// itself by, so the words and the colour agree: off the note once the
// engine has broken the lock (or, before any lock, after FIND_SECONDS off
// the band), and the on-note line while it is locked. Nothing is certain
// for a moment off the band the engine has not called yet, a gap, or a
// lock only just won back; then the line on screen stays. The pacer
// (chip-pacer.ts) keeps each line up long enough to read.

import type { HoldEventType, HoldState } from '@/lib/hold/hold-engine'
import { createChipPacer } from './chip-pacer'
import type { LongNoteMoment } from './merc-lines'
import { offMoment } from './merc-lines'

/**
 * A chip line stands at least this long before the next one (chip-pacer),
 * which is also the longest its words can trail the trace's colour.
 */
const CHIP_HOLD_SECONDS = 0.7
/**
 * Off the band this long before the first lock to name the side: until
 * then the singer is still finding the note. After a lock the engine's own
 * break (200 ms off the band) is the moment.
 */
const FIND_SECONDS = 0.9
/**
 * Back on the note after a break, the lock holds this long before the chip
 * says so (0.7 s in the band, with the lock's own 250 ms): a voice hovering
 * at the band's edge keeps its one off line instead of trading it.
 */
const RETURN_SECONDS = 0.45
/** Locked this long before Merc says it is steady. */
const STEADY_SECONDS = 3

export interface ChipFollower {
  /**
   * A hold event sets the line for while the voice is on the note. `found`
   * says the singer's own note was just named, for the first lock.
   */
  event: (event: HoldEventType, found: boolean) => void
  /**
   * The engine after this frame (`voiced`: the frame had a pitch, `dt`:
   * seconds since the last one): the moment to put on the chip now, or
   * null to leave it as it is.
   */
  follow: (
    state: HoldState,
    voiced: boolean,
    dt: number,
  ) => LongNoteMoment | null
  /** A new take: an empty chip, nothing waiting. */
  reset: () => void
}

export function createChipFollower(): ChipFollower {
  const pacer = createChipPacer(CHIP_HOLD_SECONDS)
  let outOfBandFor = 0
  /** The chip's line while the voice is on the note, set by its events. */
  let onLine: LongNoteMoment = 'lock'

  const situation = (
    state: HoldState,
    voiced: boolean,
  ): LongNoteMoment | null => {
    const needle = state.needleCents
    if (!voiced || needle === null) return null
    if (!state.inBand) {
      const off =
        state.firstLockAt === null
          ? outOfBandFor >= FIND_SECONDS
          : state.phase === 'broken'
      return off ? offMoment(needle) : null
    }
    if (state.phase !== 'locked') return null
    if (state.breaks > 0 && state.lockSeconds < RETURN_SECONDS) return null
    return onLine
  }

  return {
    event(event, found) {
      if (event === 'lock') onLine = found ? 'found' : 'lock'
      else if (event === 'relock') onLine = 'lock'
      else if (event === 'goal') onLine = 'full'
    },
    follow(state, voiced, dt) {
      if (voiced && !state.inBand) outOfBandFor += dt
      else outOfBandFor = 0
      const settled = onLine === 'lock' || onLine === 'found'
      if (settled && state.lockSeconds >= STEADY_SECONDS) onLine = 'steady'
      pacer.want(situation(state, voiced))
      return pacer.take(state.clock)
    },
    reset() {
      pacer.reset()
      outOfBandFor = 0
      onLine = 'lock'
    },
  }
}
