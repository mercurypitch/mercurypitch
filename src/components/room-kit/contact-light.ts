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
// nor stacks rings.

export type ContactState = 'hidden' | 'off' | 'on'

/** Off at least this long before coming on: a catch, s. */
export const CATCH_AFTER_OFF_SEC = 0.15
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
  return {
    step: (now, state) => {
      let caught = false
      if (state === 'on' && last === 'off' && offSince !== null) {
        caught =
          now - offSince >= CATCH_AFTER_OFF_SEC - EPS &&
          now - caughtAt >= CATCH_EVERY_SEC - EPS
        if (caught) caughtAt = now
      }
      if (state === 'off') offSince = last === 'off' ? offSince : now
      else offSince = null
      last = state
      return caught
    },
    reset: () => {
      last = 'hidden'
      offSince = null
      caughtAt = Number.NEGATIVE_INFINITY
    },
  }
}
