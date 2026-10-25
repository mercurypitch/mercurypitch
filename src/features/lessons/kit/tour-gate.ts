// ============================================================
// Lesson tour gate — whether this visit is offered the welcome tour
// ============================================================
//
// The only part of the tour on first paint: every lesson page runs it from
// the masthead (page-chrome.ts), and the tour itself loads as a chunk of
// its own when it starts (tour.ts). Every byte here is on every lesson
// page, and Lesson 3's ceiling has the least room. The tour imports nothing
// from here, since that would add files to every page's list of what to
// fetch with it: it keeps its own copy of the record and the top rule, and
// the tests hold the two copies together (tour.ts says more).
//
// Offered once per browser, on the first lesson page opened at the top with
// no address after the #: a deep link (/learn/03#sing, a share, a practice
// link back) skips it this time, and the next page opened at the top offers
// it. Closing the tour any way writes `TOUR_VERSION` under `TOUR_KEY`; a
// later tour with more to show raises the version and asks again. The
// record is written as the offer is made too, as "0", so a browser whose
// storage reads but will not write never sees the tour: it could never
// record a close, and the tour would come back on every page. Storage that
// throws, as blocked site data does, means no tour.
//
// On Lessons 1 and 2 a first visit's tour waits for the opening shot, Merc
// and Tavi landing, with the page held still (opening-hold.ts, `holdTour`).
// The chunk loads as the page starts all the same, so the card comes up as
// the shot ends.

/** The record's name, in the lesson pages' own run of keys (`fyp-pos`, `fyp-motion`). */
export const TOUR_KEY = 'fyp-tour'
export const TOUR_VERSION = '1'

/** Whether the page is at the top with nothing after the #. */
export const atTop = (): boolean =>
  window.location.hash.length < 2 && window.scrollY < 40

/**
 * Whether this visit gets the tour: at the top, with storage that reads and
 * writes and no record of this tour's version.
 */
export function tourDue(): boolean {
  try {
    const s = window.localStorage
    if (!atTop() || s.getItem(TOUR_KEY) === TOUR_VERSION) return false
    s.setItem(TOUR_KEY, '0')
    return true
  } catch {
    return false
  }
}

/** Whether this page has started a first visit's tour. */
let first = false
/** What a first visit's tour waits for, and what to call once it has run. */
let ahead: unknown
let after = (): void => undefined

/**
 * Holds a first visit's tour until `until` settles, and calls `done` once
 * the tour has opened, given up or failed to load (opening-hold.ts); false,
 * holding nothing, on a visit that offers no tour. Call it in the same
 * task as the masthead's start.
 */
export function holdTour(until: Promise<unknown>, done: () => void): boolean {
  if (first) {
    ahead = until
    after = done
  }
  return first
}

/**
 * Loads the tour and runs it, a first visit's once anything it is held for
 * has settled; `replay` (the lesson menu's "Tour this page", the question
 * mark) runs it at once.
 */
export function startTour(lesson: number, replay: boolean): void {
  first ||= !replay
  void Promise.all([
    import('./tour'),
    Promise.resolve().then(() => replay || ahead),
  ])
    .then(([t]) => t.runTour(lesson, replay))
    .then(
      () => after(),
      () => after(),
    )
}
