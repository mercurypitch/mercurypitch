// ============================================================
// Staff pitch line switch — "See it on the pitch line", one choice for the visit
// ============================================================
//
// The staff toy's "See it on the pitch line" switch (staff.ts,
// `[data-staff-lanes]`, off at first) is one choice for the visit, in
// memory: every staff toy on the page follows it, and so does a page's own
// figure that draws the lanes (Lesson 23's interval state,
// staff-interval.ts). Apart from the toy so that file stays one a reader
// can hold; the toy hands it on as its own export.

const listeners = new Set<(on: boolean) => void>()
let lanesOn = false

/** "See it on the pitch line": one choice for the visit, in memory, which every staff toy on the page follows. */
export const PitchLine = {
  get on(): boolean {
    return lanesOn
  },
  set(on: boolean): void {
    if (on === lanesOn) return
    lanesOn = on
    listeners.forEach((fn) => fn(on))
  },
  /** Calls `fn` now and after every change. */
  subscribe(fn: (on: boolean) => void): void {
    listeners.add(fn)
    fn(lanesOn)
  },
}
