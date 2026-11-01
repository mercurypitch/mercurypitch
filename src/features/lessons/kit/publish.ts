// ============================================================
// Lesson publishing — which lessons are live, for the state a page was served with
// ============================================================
//
// Every lesson page is built in every mode (tools/draft-lessons.ts), so a
// build no longer decides what is live: the admin console does, at run
// time. Its overrides (src/lib/lesson-state.ts) reach a page one of two
// ways. The site worker reads them from the db-worker, answers an
// unpublished lesson's address with the 404 page, and writes the state into
// every lesson page it serves as `<script type="application/json"
// id="lesson-state">`, with its environment's default for drafts
// (src/lesson-gate.ts). A page no worker served has no tag and reads as its
// build says (page-state.ts). Either way, this is the one place that turns
// a state into what a learner meets:
//
// - published: the console's override where it set one; otherwise true for
//   a released lesson, and the environment's default for a draft
//   (drafts.ts), which is held back on mercurypitch.com and shown on the
//   dev site and previews;
// - live: published, with a page (season.ts `page`). A lesson with no page
//   is coming later whatever the console says;
// - the season as the page shows it (`seasonFor`): a lesson held back has
//   no page and no reading time, so every list draws it exactly as a lesson
//   not written yet, and each lesson carries the hook and tease the console
//   picked, through lesson-copy.ts's resolvers.
//
// The site worker reads this module as the pages do, so it is pure: no DOM
// and no `import.meta`.

import type { LessonState } from '@/lib/lesson-state'
import { parseLessonState } from '@/lib/lesson-state'
import { DRAFT_LESSONS } from './drafts'
import { hookFor, teaseFor } from './lesson-copy'
import type { Lesson } from './season'
import { watchOfHref } from './watch-pages'

/** The id of the tag that carries a page's state. */
export const PAGE_STATE_ID = 'lesson-state'

/** A lesson state as a page reads it: the overrides, and its environment's default for drafts. */
export interface PageState extends LessonState {
  /** Whether a draft with no override of its own is published where this page is served. */
  readonly drafts: boolean
}

/** A page's state with no overrides: the site as built, drafts as `drafts` says. */
export function defaultPageState(drafts: boolean): PageState {
  return { version: 1, updatedAt: null, lessons: {}, drafts }
}

/**
 * Read a page's state (the parsed JSON of its tag), as tolerantly as
 * parseLessonState reads the API's. A tag that does not say whether drafts
 * are shown takes `drafts`; null for anything that is not a version 1 state.
 */
export function parsePageState(
  json: unknown,
  drafts: boolean,
): PageState | null {
  const state = parseLessonState(json)
  if (state === null) return null
  const said = (json as { drafts?: unknown }).drafts
  return { ...state, drafts: typeof said === 'boolean' ? said : drafts }
}

/**
 * A page's state as its tag's text: JSON with every `<` escaped, so no
 * value can close the script element it sits in.
 */
export function pageStateJson(state: PageState): string {
  const { version, updatedAt, lessons, drafts } = state
  return JSON.stringify({ version, updatedAt, lessons, drafts }).replace(
    /</g,
    '\\u003c',
  )
}

/** Whether lesson `n` is published: its override, else true for a released lesson and the environment's default for a draft. */
export function isPublished(n: number, state: PageState): boolean {
  const set = state.lessons[String(n)]?.published
  if (typeof set === 'boolean') return set
  return DRAFT_LESSONS[n] === undefined || state.drafts
}

/** Whether lesson `n` is live: published, with a page. */
export function isLive(
  n: number,
  lessons: readonly Lesson[],
  state: PageState,
): boolean {
  const L = lessons.find((x) => x.n === n)
  return L?.page !== undefined && isPublished(n, state)
}

/** A lesson with its page and reading time taken away: one held back, drawn as a lesson coming later. */
function heldBack(L: Lesson): Lesson {
  const out: { -readonly [K in keyof Lesson]?: Lesson[K] } = { ...L }
  delete out.page
  delete out.minutes
  return out as Lesson
}

/**
 * The season as a page with this state shows it: a lesson held back has no
 * page and no reading time, and each lesson carries the hook and tease its
 * override picked (lesson-copy.ts `hookFor` and `teaseFor`: an id a lesson
 * lacks keeps its default). A lesson nothing changes is the same object.
 */
export function seasonFor(
  lessons: readonly Lesson[],
  state: PageState,
): Lesson[] {
  return lessons.map((L) => {
    const set = state.lessons[String(L.n)]
    const hook = hookFor(L, set?.hook).text
    const tease = teaseFor(L, set?.tease)?.text
    const held = L.page !== undefined && !isPublished(L.n, state)
    if (!held && hook === L.hook && tease === L.tease) return L
    return {
      ...(held ? heldBack(L) : L),
      hook,
      ...(tease === undefined ? {} : { tease }),
    }
  })
}

// A lesson page's address as a page links it: `/learn/03`, `/learn/03.html`
// or `/learn/03/`, with any query or fragment (`/learn/03#step-4`).
const LESSON_HREF = /^\/learn\/(\d{2})(?:\.html|\/)?(?:[?#].*)?$/

/** The lesson a same-site link or path leads to; null for any other address. */
export function lessonOfHref(href: string): number | null {
  const m = LESSON_HREF.exec(href.trim())
  return m === null ? null : Number(m[1])
}

/**
 * The lesson a same-site link leads to, at its own page or at its film's
 * watch page (watch-pages.ts), which is live exactly while the lesson is;
 * null for any other address. What a page's links are settled by.
 */
export function linkedLessonOfHref(href: string): number | null {
  return lessonOfHref(href) ?? watchOfHref(href)
}

/** One of the two readings a page writes of another lesson's state. */
export type Reading = 'live' | 'planned'

/** A reading's lesson, from its attribute's value: one or two digits, else null. */
export function readingLesson(value: string | null): number | null {
  return value !== null && /^\d{1,2}$/.test(value) ? Number(value) : null
}

/**
 * Whether a page's `data-if-live` or `data-if-planned` reading of lesson
 * `n` is true for this state: live while the lesson is, planned otherwise.
 */
export function readingHolds(
  reading: Reading,
  n: number,
  lessons: readonly Lesson[],
  state: PageState,
): boolean {
  return isLive(n, lessons, state) === (reading === 'live')
}
