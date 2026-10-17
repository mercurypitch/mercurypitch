// ============================================================
// Quiet watch: a premium room's quiet minute
// ============================================================
//
// Nobody sang for a minute (QUIET_LIMIT_SECONDS, room-constants.ts): the
// room stops and the mic closes. Each room counts that minute on a clock
// of its own, named where its watch is made: Echo and the glide rooms on
// the wall clock (performance.now(), in ms), Long note on its take's own
// clock (now(), in s), the one its frames are dated on.

/** A clock a quiet watch counts on. */
export interface QuietClock {
  /** Now, on this clock. */
  readonly now: () => number
  /** This clock's units in one second. */
  readonly perSecond: number
}

/** The wall clock: performance.now(), in milliseconds. */
export const WALL_CLOCK: QuietClock = {
  now: () => performance.now(),
  perSecond: 1000,
}

/** A clock in seconds: a take's own, say. */
export function secondsClock(now: () => number): QuietClock {
  return { now, perSecond: 1 }
}

export interface QuietWatchSetup {
  /** Longer than this with no voice is quiet. */
  readonly limitSeconds: number
  /** The clock the watch counts on. */
  readonly clock: QuietClock
}

export interface QuietWatch {
  /** The singer was heard: now, or at `at` on the watch's clock. */
  readonly heard: (at?: number) => void
  /** Nobody was heard for longer than the limit. */
  readonly quiet: () => boolean
}

export function createQuietWatch(setup: QuietWatchSetup): QuietWatch {
  const { clock } = setup
  const limit = setup.limitSeconds * clock.perSecond
  let heardAt = 0
  return {
    heard: (at = clock.now()) => {
      heardAt = at
    },
    quiet: () => clock.now() - heardAt > limit,
  }
}
