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
//
// "Steady" is the engine's own steady flag, the one that fills the top
// past the goal (the hold engine's stretch), so the chip never calls a
// voice steady that the lantern does not count as steady. The line follows
// the flag once it has held SETTLE_SECONDS: a voice at the edge of steady
// keeps one line instead of trading two.

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
/** Locked this long, and steady, before Merc says it is steady. */
const STEADY_SECONDS = 3
/** The engine's steady flag holds this long before the line follows it. */
const SETTLE_SECONDS = 1
/** The goal's own line stands this long before the top's lines. */
const FULL_SECONDS = 2.5
/**
 * Back on the note past the goal, the way back is in the window the top
 * is judged on too (everything since the goal): until the lock is this
 * long, the line only says the voice is on the note.
 */
const TOP_AFTER_LOCK = 2

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
  /** The first lock named the singer's own note. */
  let found = false
  /** When the goal was reached, clock seconds. */
  let goalAt: number | null = null
  /** The engine's steady flag, as the line follows it. */
  let steady = false
  let flag = false
  let flagFor = 0

  const settle = (now: boolean, dt: number): void => {
    if (now === flag) flagFor += dt
    else {
      flag = now
      flagFor = 0
    }
    if (flagFor >= SETTLE_SECONDS) steady = flag
  }

  /** Past the goal: the goal's line, then whether the top is filling. */
  const stretchLine = (state: HoldState, since: number): LongNoteMoment => {
    if (state.brimReached) return 'brim'
    if (state.clock - since < FULL_SECONDS) return 'full'
    if (state.lockSeconds < TOP_AFTER_LOCK) return 'lock'
    return steady ? 'topSteady' : 'topShaky'
  }

  /** The line while the voice is locked on the note. */
  const onNote = (state: HoldState): LongNoteMoment => {
    if (goalAt !== null) return stretchLine(state, goalAt)
    if (state.lockSeconds >= STEADY_SECONDS) return steady ? 'steady' : 'lock'
    return found ? 'found' : 'lock'
  }

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
    return onNote(state)
  }

  return {
    event(event, named) {
      if (event === 'lock') found = named
      else if (event === 'relock') found = false
    },
    follow(state, voiced, dt) {
      if (voiced && !state.inBand) outOfBandFor += dt
      else outOfBandFor = 0
      settle(state.steady, dt)
      if (state.goalReached) goalAt ??= state.clock
      pacer.want(situation(state, voiced))
      return pacer.take(state.clock)
    },
    reset() {
      pacer.reset()
      outOfBandFor = 0
      found = false
      goalAt = null
      steady = false
      flag = false
      flagFor = 0
    },
  }
}
