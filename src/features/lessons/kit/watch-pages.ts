// ============================================================
// Watch pages — each lesson film's own page, /learn/NN/watch, and the facts its VideoObject states
// ============================================================
//
// Google lists a video in its video results only when the video is the main
// content of its page (a "watch page"). On a lesson page the film supports
// the text, so Search Console calls it supplementary and does not index it.
// So each published film also has a page of its own: learn/NN/watch.html,
// served at /learn/NN/watch, the film first and the lesson one link away.
// The lesson keeps its film as before and links its watch page (maff's
// decision of 1 November 2026).
//
// A watch page is a lesson's, and lives and dies with it: the site worker
// answers it exactly as it answers the lesson's own page (src/lesson-gate.ts),
// the 404 page wherever the lesson is not published, and the listings add
// or drop it with the lesson (src/lesson-listings.ts).
//
// The facts below are what the page's VideoObject states and the page cannot
// read off films.ts: `duration`, measured from the published MP4's own
// metadata (ffprobe over a range read, rounded to the second), and
// `uploadDate`, when the film first went live on mercurypitch.com (the
// release tag that first shipped its sources). A fixed cut that goes up as a
// new version (films.ts) changes `duration` here in the same commit; its
// `uploadDate` stays the first one. src/tests/lesson-watch-pages.test.ts
// holds each document's structured data to these and to films.ts.
//
// Pure data, read by the site worker, the build and the tests: nothing here
// may touch the DOM or `import.meta`.

import type { FilmRegistry } from './films'
import { FILMS, filmState } from './films'

/** What a film's VideoObject states that films.ts does not hold. */
export interface WatchFacts {
  /** ISO 8601 duration of the published MP4, measured: `PT5M36S`. */
  readonly duration: string
  /** ISO 8601 date and time, with its offset, that the film went live. */
  readonly uploadDate: string
}

/** Lesson number to its watch page's facts: a lesson listed here has a watch page. */
export type WatchRegistry = Readonly<Partial<Record<number, WatchFacts>>>

export const WATCH_PAGES: WatchRegistry = {
  // v1/lesson-01-1080p.mp4: 335.53 s. Live with v0.9.22.
  1: { duration: 'PT5M36S', uploadDate: '2026-10-26T14:03:38+01:00' },
  // v1/lesson-02-1080p.mp4: 439.10 s. Live with v0.9.22.
  2: { duration: 'PT7M19S', uploadDate: '2026-10-26T14:03:38+01:00' },
}

const pad = (n: number): string => String(n).padStart(2, '0')

/** A watch page's clean path: `/learn/01/watch`. */
export const watchPath = (n: number): string => `/learn/${pad(n)}/watch`

/** A watch page's document, relative to the repository root and to dist: `learn/01/watch.html`. */
export const watchDocument = (n: number): string => `learn/${pad(n)}/watch.html`

/** Whether lesson `n` has a watch page: its film is published (films.ts) and its facts are listed here. */
export function hasWatchPage(
  n: number,
  pages: WatchRegistry = WATCH_PAGES,
  films: FilmRegistry = FILMS,
): boolean {
  return pages[n] !== undefined && filmState(n, films) === 'published'
}

/** The lessons with a watch page, in lesson order. */
export function watchLessons(
  pages: WatchRegistry = WATCH_PAGES,
  films: FilmRegistry = FILMS,
): number[] {
  return Object.keys(pages)
    .map(Number)
    .filter((n) => Number.isInteger(n) && hasWatchPage(n, pages, films))
    .sort((a, b) => a - b)
}

// A watch page's address as a page links it: `/learn/01/watch`,
// `/learn/01/watch.html` or `/learn/01/watch/`, with any query or fragment.
const WATCH_HREF = /^\/learn\/(\d{2})\/watch(?:\.html|\/)?(?:[?#].*)?$/

/** The lesson whose watch page a same-site link or path leads to; null for any other address. */
export function watchOfHref(href: string): number | null {
  const m = WATCH_HREF.exec(href.trim())
  return m === null ? null : Number(m[1])
}
