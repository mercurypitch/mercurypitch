// ============================================================
// The contact light's states: where the voice meets the path, now
// ============================================================
//
// What the glide rooms show at the point of contact (ContactLight.tsx),
// one screen frame at a time: nothing outside an arch's sung part; the
// room's lit colour while the engine has the voice on the path (its
// `onPath`, the same test that lights the arch); a neutral cool colour
// off it. Coming on from off fires one catch, a ring, when the voice was
// off for a moment and the last catch is not too recent. A tracker's
// one-frame flicker on a step (17 ms, measured on Ng slides) neither rings
// nor stacks rings. As an arch starts, the light shows off until the
// engine hears the note even when the singer is on time; that onset does
// not ring, and a late start does.

export type ContactState = 'hidden' | 'off' | 'on'

/** Off at least this long before coming on: a catch, s. */
export const CATCH_AFTER_OFF_SEC = 0.15
/**
 * Before the light has been on, off at least this long: a late start, s.
 * The engine's own onset as an arch starts is 0.11 to 0.17 s in the built
 * app's takes with a singer on time, so CATCH_AFTER_OFF_SEC would ring on
 * some starts and not others.
 */
export const CATCH_LATE_START_SEC = 0.3
/** At most one catch this often, s. */
export const CATCH_EVERY_SEC = 0.4
/** Float sums of frame times drift; the thresholds compare with this slack. */
const EPS = 1e-9

export interface ContactTracker {
  /** One screen frame at `now` (s): true when it catches. */
  step: (now: number, state: ContactState) => boolean
  /** A new run: nothing shown, nothing caught. */
  reset: () => void
}

export function createContactTracker(): ContactTracker {
  let last: ContactState = 'hidden'
  let offSince: number | null = null
  let caughtAt = Number.NEGATIVE_INFINITY
  /** The light has been on since it last showed. */
  let wasOn = false
  return {
    step: (now, state) => {
      let caught = false
      if (state === 'on' && last === 'off' && offSince !== null) {
        const spell = wasOn ? CATCH_AFTER_OFF_SEC : CATCH_LATE_START_SEC
        caught =
          now - offSince >= spell - EPS &&
          now - caughtAt >= CATCH_EVERY_SEC - EPS
        if (caught) caughtAt = now
      }
      if (state === 'off') offSince = last === 'off' ? offSince : now
      else offSince = null
      if (state === 'on') wasOn = true
      else if (state === 'hidden') wasOn = false
      last = state
      return caught
    },
    reset: () => {
      last = 'hidden'
      offSince = null
      caughtAt = Number.NEGATIVE_INFINITY
      wasOn = false
    },
  }
}
