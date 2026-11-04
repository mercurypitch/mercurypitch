// ============================================================
// Page state — the lesson state this page was served with, or its build's defaults
// ============================================================
//
// The site worker writes the admin console's state into every lesson page
// it serves (`#lesson-state`, src/lesson-gate.ts). A page no worker served
// has no tag: `pnpm dev`, the e2e bundle's static server, a page saved from
// the browser. It then reads as its build says: no overrides, and drafts
// shown or held back as draft-switch.ts has it, so a production bundle on
// its own never lists a draft. A tag this code cannot read counts as none.
//
// Everything on a lesson page that links or lists a lesson asks this
// module: the explorer, the masthead's lesson menu and the next-lesson card
// take their season from `pageLessons`, the quick check asks `lessonLive`
// before it links back to another lesson, and `followPageState` settles the
// page's own markup once it boots: a link to a lesson that is not live
// loses its link (a prerequisite chip stays, as a plain chip), and each
// reading a page writes of another lesson's state (`data-if-live`,
// `data-if-planned`) keeps the true one. The worker does the same to the
// markup it serves, so on the live site this finds nothing left to do.

import { DRAFTS_SHOWN } from './draft-switch'
import type { PageState, Reading } from './publish'
import { isLive, linkedLessonOfHref, PAGE_STATE_ID, parsePageState, readingHolds, readingLesson, seasonFor, } from './publish'
import type { Lesson, Season } from './season'
import { SEASON_1 } from './season'

/**
 * The state of a page no worker served: no overrides, and this build's
 * default for drafts. Written out as the JSON a tag would hold, rather
 * than built from DRAFTS_SHOWN at run time, so that a bundle carries the
 * default it was built with as text, which scripts/assert-draft-lessons.mjs
 * reads; it goes through the same reader as a tag.
 */
const BUILD_STATE_JSON = DRAFTS_SHOWN
  ? '{"version":1,"updatedAt":null,"lessons":{},"drafts":true}'
  : '{"version":1,"updatedAt":null,"lessons":{},"drafts":false}'

function parse(text: string): PageState | null {
  try {
    return parsePageState(JSON.parse(text), DRAFTS_SHOWN)
  } catch {
    return null
  }
}

/** The state `doc` was served with; its build's defaults where it carries none this code can read. */
export function readPageState(doc: Document = document): PageState {
  const text = doc.getElementById(PAGE_STATE_ID)?.textContent
  const served = text == null ? null : parse(text)
  return served ?? (parse(BUILD_STATE_JSON) as PageState)
}

/** `lessons` as `doc` shows them (publish.ts `seasonFor`): held back with no page, each its picked hook and tease. */
export function pageLessons(
  doc: Document = document,
  lessons: readonly Lesson[] = carriedLessons(),
): Lesson[] {
  return seasonFor(lessons, readPageState(doc))
}

/** Whether lesson `n` is live on `doc`: published, with a page. */
export function lessonLive(n: number, doc: Document = document): boolean {
  return isLive(n, carriedLessons(), readPageState(doc))
}

/**
 * A link to a lesson that is not live, made no link: a prerequisite chip
 * becomes a plain chip, a link in a nav goes, and any other keeps its words.
 */
function unlink(a: HTMLAnchorElement): void {
  if (a.classList.contains('chip-link')) {
    const chip = a.ownerDocument.createElement('span')
    chip.className = a.className
    chip.classList.remove('chip-link')
    chip.append(...Array.from(a.childNodes))
    a.replaceWith(chip)
    return
  }
  if (a.closest('nav') !== null) {
    a.remove()
    return
  }
  a.replaceWith(...Array.from(a.childNodes))
}

/**
 * Settles `doc`'s own markup for its state: every link to a lesson that is
 * not live, or to its watch page, loses its link, and of each lesson-state reading the true one
 * stays, unwrapped, and the other goes. A reading whose lesson is not a
 * number is left as it is.
 */
export function followPageState(doc: Document = document): void {
  const state = readPageState(doc)
  const lessons = carriedLessons()
  for (const a of Array.from(doc.querySelectorAll('a[href]'))) {
    const n = linkedLessonOfHref(a.getAttribute('href') ?? '')
    if (n !== null && !isLive(n, lessons, state)) unlink(a as HTMLAnchorElement)
  }
  for (const el of Array.from(
    doc.querySelectorAll('[data-if-live], [data-if-planned]'),
  )) {
    const reading: Reading = el.hasAttribute('data-if-live')
      ? 'live'
      : 'planned'
    const n = readingLesson(el.getAttribute(`data-if-${reading}`))
    if (n === null) continue
    if (readingHolds(reading, n, lessons, state))
      el.replaceWith(...Array.from(el.childNodes))
    else el.remove()
  }
}

// ---------------------------------------------------------------- seasons
//
// Every page carries Season 1 (season.ts). A later season's page carries its
// own season as well, by `carrySeason` before anything draws, so its lists,
// its links and its next card know its season's lessons; every lesson the
// page carries is what `pageLessons`, `lessonLive` and `followPageState`
// read. A Season 1 page carries no other: its explorer loads Season 2 for
// its own tab only (explorer.ts), and nothing else on the page changes.

/** The seasons this page carries, in order: Season 1, and a later season's own. */
const carried: Season[] = [SEASON_1]

/** Every lesson of every season this page carries, in lesson order. */
function carriedLessons(): Lesson[] {
  return carried.flatMap((s) => s.lessons)
}

/**
 * Carries `season` on this page: a later season's page calls it once, from
 * its module, before it draws anything. Carrying one twice changes nothing.
 */
export function carrySeason(season: Season): void {
  if (carried.some((s) => s.n === season.n)) return
  carried.push(season)
  carried.sort((a, b) => a.n - b.n)
}

/** The seasons this page carries, in order. */
export function pageSeasons(): readonly Season[] {
  return carried
}

/** The season lesson `n` belongs to among the seasons this page carries; Season 1 for any other. */
export function pageSeason(n: number): Season {
  return carried.find((s) => s.lessons.some((L) => L.n === n)) ?? SEASON_1
}
