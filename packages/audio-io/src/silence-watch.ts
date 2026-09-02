// Is the microphone that opened actually hearing anything?
// ============================================================
//
// A stream can be live, permitted and completely silent -- the wrong
// channel of an audio interface, a muted input, a cable in the wrong
// socket. Nothing in the Web Audio API reports that; the frames simply
// arrive at zero. The player, meanwhile, is singing at a game that is
// not responding, with no way to tell that from "my note is wrong".
//
// So watch the level, and after a grace period say so.
//
// FLOOR is set to catch a DEAD channel, not to judge loudness. The
// silent interface channel that prompted this read 0.0001; a quiet room
// on a working microphone reads around 0.001-0.01, and a sung note is
// an order of magnitude above that again. 0.002 sits in the gap: high
// enough that dead is dead, low enough that a timid singer in a quiet
// room is never told their microphone is broken.

/** Linear RMS below which we treat the input as carrying nothing. */
export const FLOOR = 0.002

/** How long to listen before deciding. Long enough to draw a breath. */
export const GRACE_MS = 5000

export interface SilenceWatch {
  /** Feed a level reading. Returns true once the input looks dead. */
  sample(level: number, now: number): boolean
  /** Start over, e.g. after switching device. */
  reset(): void
}

export function createSilenceWatch(
  floor = FLOOR,
  graceMs = GRACE_MS,
): SilenceWatch {
  let startedAt: number | null = null
  let heard = false

  return {
    sample(level, now) {
      startedAt ??= now
      // Once a real signal has arrived the microphone is not the
      // problem, and saying so later -- during a held silence between
      // phrases -- would be noise.
      if (level > floor) heard = true
      if (heard) return false
      return now - startedAt >= graceMs
    },
    reset() {
      startedAt = null
      heard = false
    },
  }
}
