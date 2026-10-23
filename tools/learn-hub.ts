// ============================================================
// Learn hub — the season's map on /learn/, read off season.ts and the lesson documents
// ============================================================
//
// learn/index.html is Find Your Pitch's hub, served at /learn/: a plain
// document with no script, whose words about the series are written by
// hand. What it says of each lesson is not. The season map, the span of
// reading times and the series' `hasPart` are written into it here, on the
// dev server and in every build, from season.ts and the lesson documents,
// as tools/lesson-links.ts fills the entry documents' navs. So no lesson's
// name or hook is copied into the document, and a lesson page joins the
// map with no edit to it.
//
// A lesson is named by its document's structured-data headline, which is
// what every nav calls it, or by its season title while it has no
// document. Each lesson with a document writes both readings of its state
// (tools/draft-lessons.ts): its reading time and "Start lesson" in
// `<span data-if-live="N">`, "Coming" in `<span data-if-planned="N">`. Its
// reading time goes with its link, since a lesson held back is drawn as one
// not written yet, as publish.ts `seasonFor` has it. lessonStatesPlugin,
// which runs after this, marks hidden the reading that is false under the
// build's defaults; the site worker keeps the true one where it serves the
// page (src/lesson-gate.ts). A lesson with no document is "Coming" in every
// environment.
//
// `hasPart` is the build's default as well: the released lessons in a
// production build, and the drafts with them where the build shows drafts,
// so that a page no worker served lists the lessons it links. The site
// worker settles it to the lessons live where it serves the page.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Plugin } from 'vite'
import type { Lane, Lesson } from '../src/features/lessons/kit/season'
import { LESSONS } from '../src/features/lessons/kit/season'
import { lessonDocument, lessonPages, lessonPath } from './draft-lessons'
import { lessonHeadline } from './lesson-links'

/** The hub's document, relative to the repository root and to dist. */
export const HUB_DOCUMENT = 'learn/index.html'

/** The site the structured data names, whichever environment serves it. */
const SITE_ORIGIN = 'https://mercurypitch.com'

/** Where the document asks for what this fills in, each exactly once. */
const MARKS = {
  minutes: '<!-- hub:minutes -->',
  season: '<!-- hub:season -->',
  parts: '"hasPart": []',
} as const

/** A Season 1 lesson as the hub lists it. */
export interface HubLesson {
  readonly n: number
  readonly lane: Lane
  /** Its document's headline, or its season title while it has none. */
  readonly name: string
  /** Its default hook (season.ts). */
  readonly hook: string
  /** Its reading time, as season.ts gives it. */
  readonly minutes?: number
  /** Its clean path, for a lesson with a document: `/learn/03`. */
  readonly page?: string
}

/** Every Season 1 lesson, the trailer left out, as the repository at `root` has it. */
export function hubLessons(
  root: string,
  lessons: readonly Lesson[] = LESSONS,
): HubLesson[] {
  const written = lessonPages(root)
  return lessons
    .filter((L) => L.n >= 1)
    .map((L) => {
      const page = written.includes(L.n)
      const headline = page
        ? lessonHeadline(
            readFileSync(resolve(root, lessonDocument(L.n)), 'utf8'),
          )
        : undefined
      return {
        n: L.n,
        lane: L.lane,
        name: headline ?? L.title,
        hook: L.hook,
        ...(L.minutes === undefined ? {} : { minutes: L.minutes }),
        ...(page ? { page: lessonPath(L.n) } : {}),
      }
    })
}

/** The shortest and longest reading time among the lessons that have one: "10 to 17". */
export function minutesSpan(lessons: readonly HubLesson[]): string {
  const times = lessons.flatMap((L) =>
    L.minutes === undefined ? [] : [L.minutes],
  )
  if (times.length === 0)
    throw new Error('No Season 1 lesson has a reading time (season.ts).')
  const [least, most] = [Math.min(...times), Math.max(...times)]
  return least === most ? String(least) : `${least} to ${most}`
}

const esc = (s: string): string =>
  s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`)

/** The lanes in the order the map draws them; the finale, in both, closes it. */
const LANES: readonly (readonly [Lane, string])[] = [
  ['theory', 'Theory'],
  ['voice', 'Voice'],
  ['both', 'Voice and theory'],
]

/** Where a lesson stands: its reading time and link while it is live, "Coming" otherwise. */
function statusMarkup(L: HubLesson, name: string): string {
  const coming = `<span data-if-planned="${L.n}">Coming</span>`
  if (L.page === undefined) return coming
  const time =
    L.minutes === undefined
      ? ''
      : `<span data-if-live="${L.n}">${L.minutes} minutes</span>`
  const link = `<span data-if-live="${L.n}"><a class="btn sm" href="${L.page}" aria-describedby="${name}">Start lesson</a></span>`
  return [time, link, coming].filter(Boolean).join(' ')
}

function lessonMarkup(L: HubLesson): string {
  const name = `lesson-${String(L.n).padStart(2, '0')}`
  return `<li class="hub-lesson"><p class="kicker">Lesson ${L.n}</p><h4 id="${name}">${esc(L.name)}</h4><p class="hub-hook">${esc(L.hook)}</p><p class="hub-go">${statusMarkup(L, name)}</p></li>`
}

/** The season map: one list a lane, each lesson once, in lesson order. */
export function seasonMarkup(lessons: readonly HubLesson[]): string {
  const lanes = LANES.map(([lane, title]) => {
    const own = lessons.filter((L) => L.lane === lane)
    if (own.length === 0) return ''
    const items = own.map(lessonMarkup).join('\n')
    return `<section class="hub-lane ${lane}" aria-labelledby="lane-${lane}">\n<h3 class="kicker" id="lane-${lane}">${title}</h3>\n<ol class="hub-list">\n${items}\n</ol>\n</section>`
  })
  return `<div class="hub-lanes">\n${lanes.filter(Boolean).join('\n')}\n</div>`
}

/** The series' parts as its structured data lists them: each live lesson's `#lesson` node. */
export function seriesParts(live: readonly number[]): { '@id': string }[] {
  return [...live]
    .sort((a, b) => a - b)
    .map((n) => ({ '@id': `${SITE_ORIGIN}${lessonPath(n)}#lesson` }))
}

/**
 * The hub's document with the season map, the reading times and the
 * series' parts written in; `live` is the lessons live by the build's
 * default. Throws when the document lacks a mark, or holds one twice.
 */
export function fillHub(
  html: string,
  lessons: readonly HubLesson[],
  live: readonly number[],
): string {
  for (const mark of Object.values(MARKS))
    if (html.split(mark).length !== 2)
      throw new Error(
        `${HUB_DOCUMENT} must hold ${mark} exactly once: tools/learn-hub.ts fills it in.`,
      )
  return html
    .replace(MARKS.minutes, () => minutesSpan(lessons))
    .replace(MARKS.season, () => seasonMarkup(lessons))
    .replace(
      MARKS.parts,
      () => `"hasPart": ${JSON.stringify(seriesParts(live))}`,
    )
}

/**
 * Fills the hub in on the dev server as in a build. It must come before
 * lessonStatesPlugin, which marks the readings this writes.
 */
export function learnHubPlugin(root: string, live: readonly number[]): Plugin {
  const hub = resolve(root, HUB_DOCUMENT)
  return {
    name: 'mercurypitch:learn-hub',
    transformIndexHtml: {
      order: 'pre',
      handler: (html, ctx) =>
        resolve(ctx.filename) === hub
          ? fillHub(html, hubLessons(root), live)
          : html,
    },
  }
}
