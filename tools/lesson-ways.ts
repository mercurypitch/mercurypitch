// ============================================================
// Lesson ways — each lesson page's trail back to the hub and its links to the lessons either side, written at build time
// ============================================================
//
// A lesson page is a hand-written document (learn/NN.html), and its
// BreadcrumbList tells a search engine the page sits under the home page and
// the series' hub, /learn/ (docs/plans/find-your-pitch/SEARCH.md § 3.2).
// Google asks that structured data describe what the page shows, and a
// reader, a crawler that runs no script and an answer engine all need the
// way back to the hub, and on to the next lesson, in the markup itself
// (§ 3.3). So both are written here, on the dev server and in every build,
// and no document carries a copy, so a lesson page joins with no edit.
//
// The trail is written from the page's own BreadcrumbList: the same names,
// in the same order, each step with an address a link to it, and the last
// one, the lesson itself, the current page, so the two cannot disagree. It
// goes between the masthead and the lesson, outside <main>, so "Skip to the
// lesson" passes it. MercuryPitch is a link to the home page because the
// structured data names it first and the masthead does not link home: its
// logo goes back to the top of the lesson (lesson-sections.css styles both).
//
// The lessons either side go in the page's foot, as a nav: the lesson before
// this one and the lesson after it, each that has a page, by its number and
// its name as the hub names it (tools/learn-hub.ts), the next one under the
// next-lesson card's own "Next lesson" (kit/next-card.ts). Not in the Wrap:
// its next-lesson card is drawn by the page's script from the season and
// the viewer's place ("Start lesson", "Continue", "Coming later"), so a
// reader meets the next lesson there once, and the foot is where a crawler
// that runs no script finds it. Every lesson with a page is linked, drafts
// too, since which lessons are live is answered per request: a link to a
// lesson that is not live goes from a nav, by the site worker
// (src/lesson-gate.ts `followState`) and by the page's own script for a
// page no worker served (kit/page-state.ts `followPageState`). So on
// mercurypitch.com, where drafts are held back, Lesson 2's foot keeps
// Lesson 1 and loses Lesson 3; where drafts are shown it keeps both.

import { resolve } from 'node:path'
import type { Plugin } from 'vite'
import { lessonDocument, lessonPages } from './draft-lessons'
import { hubLessons } from './learn-hub'

/** The site the structured data names, whichever environment serves the page. */
const SITE_ORIGIN = 'https://mercurypitch.com'

/** One step of a page's trail: its name, and its same-site address unless it is the page itself. */
export interface TrailStep {
  readonly name: string
  readonly href?: string
}

/** Where the trail goes in a lesson document: just before the lesson, after the masthead. */
const TRAIL_BEFORE = '<main id="top">'

const LD_JSON = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g

const esc = (s: string): string =>
  s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`)

/** A structured-data address as this site links it: `https://mercurypitch.com/learn/` is `/learn/`. */
function sitePath(url: string): string {
  if (!url.startsWith(`${SITE_ORIGIN}/`))
    throw new Error(
      `A lesson's BreadcrumbList names ${url}, which is not on ${SITE_ORIGIN}: the trail links only this site.`,
    )
  return url.slice(SITE_ORIGIN.length)
}

interface ListItem {
  readonly position?: unknown
  readonly name?: unknown
  readonly item?: unknown
}

/** The steps of `node` if it is a BreadcrumbList, in its positions' order; null for any other node. */
function stepsOf(node: unknown): TrailStep[] | null {
  const list = node as { '@type'?: unknown; itemListElement?: unknown }
  if (list['@type'] !== 'BreadcrumbList') return null
  const items = Array.isArray(list.itemListElement)
    ? (list.itemListElement as ListItem[])
    : []
  return [...items]
    .sort((a, b) => Number(a.position) - Number(b.position))
    .map((item) => ({
      name: String(item.name),
      ...(typeof item.item === 'string' ? { href: sitePath(item.item) } : {}),
    }))
}

/**
 * The trail a document's BreadcrumbList describes, home first; throws when
 * the document has none, or when a step but the last has no address or the
 * last has one, since the page itself is the trail's end.
 */
export function trailSteps(html: string): TrailStep[] {
  for (const match of html.matchAll(LD_JSON)) {
    let node: unknown
    try {
      node = JSON.parse(match[1])
    } catch {
      continue // malformed markup is src/tests/lesson-pages.test.ts's to report
    }
    const steps = stepsOf(node)
    if (steps === null) continue
    const linked = steps.slice(0, -1).every((s) => s.href !== undefined)
    if (steps.length < 2 || !linked || steps.at(-1)?.href !== undefined)
      throw new Error(
        "A lesson's BreadcrumbList must lead from the home page to the lesson: every step an address but the last, the lesson itself.",
      )
    return steps
  }
  throw new Error(
    'A lesson document must carry a BreadcrumbList: its visible trail is written from it.',
  )
}

/** The trail as markup: a list in a labelled nav, each step a link but the page itself, marked as the current page. */
export function trailMarkup(steps: readonly TrailStep[]): string {
  const items = steps.map((s) =>
    s.href === undefined
      ? `<li><span aria-current="page">${esc(s.name)}</span></li>`
      : `<li><a href="${esc(s.href)}">${esc(s.name)}</a></li>`,
  )
  return `<nav class="wrap trail" aria-label="Breadcrumb">\n      <ol>\n        ${items.join('\n        ')}\n      </ol>\n    </nav>\n    `
}

/** A lesson beside this one, as its page's foot links it: its number, its name as the hub names it, and its page. */
export interface LessonWay {
  readonly n: number
  readonly name: string
  readonly href: string
}

/** The lessons either side of a lesson that have a page; either is absent where there is none. */
export interface LessonWays {
  readonly prev?: LessonWay
  readonly next?: LessonWay
}

/** Lesson `n`'s neighbours with a page, as the repository at `root` has them, named as the hub names them. */
export function lessonWays(root: string, n: number): LessonWays {
  const lessons = hubLessons(root)
  const way = (m: number): LessonWay | undefined => {
    const L = lessons.find((x) => x.n === m)
    return L?.page === undefined
      ? undefined
      : { n: L.n, name: L.name, href: L.page }
  }
  const prev = way(n - 1)
  const next = way(n + 1)
  return {
    ...(prev === undefined ? {} : { prev }),
    ...(next === undefined ? {} : { next }),
  }
}

/** Where the lessons either side go in a lesson document: first in its foot. */
const WAYS_AFTER = '<footer class="foot">'

/** The words the lesson menu's list of them goes by (kit/lesson-menu.ts). */
const WAYS_LABEL = 'Season 1 lessons'

const icon = (id: string): string =>
  `<svg class="ico" aria-hidden="true"><use href="#${id}" /></svg>`

/** One lesson beside this one as a link: its number, the next one's under "Next lesson", and its name. */
function wayMarkup(way: LessonWay, rel: 'prev' | 'next'): string {
  const frame = rel === 'next' ? '<b>Next lesson</b> ' : ''
  const words = `<span><small>${frame}Lesson ${way.n}</small> <span>${esc(way.name)}</span></span>`
  const [before, after] =
    rel === 'prev' ? [icon('i-left'), ''] : ['', icon('i-right')]
  return `<a class="foot-way" rel="${rel}" href="${esc(way.href)}">${before}${words}${after}</a>`
}

/** The lessons either side as a nav for the foot; nothing when there are none. */
export function waysMarkup(ways: LessonWays): string {
  const links = [
    ways.prev === undefined ? '' : wayMarkup(ways.prev, 'prev'),
    ways.next === undefined ? '' : wayMarkup(ways.next, 'next'),
  ].filter(Boolean)
  if (links.length === 0) return ''
  return `\n      <nav class="wrap foot-ways" aria-label="${WAYS_LABEL}">\n        ${links.join('\n        ')}\n      </nav>`
}

/** Throws unless `html` holds `mark` exactly once, as the ways written at it need. */
function once(html: string, mark: string, what: string): void {
  if (html.split(mark).length !== 2)
    throw new Error(
      `A lesson document must hold ${mark} exactly once: tools/lesson-ways.ts writes ${what} at it.`,
    )
}

/**
 * A lesson document with its trail written in before its <main>, and the
 * lessons either side, when it has any, first in its foot; throws unless it
 * holds each place exactly once.
 */
export function fillLessonWays(html: string, ways: LessonWays = {}): string {
  once(html, TRAIL_BEFORE, 'its trail')
  const trailed = html.replace(
    TRAIL_BEFORE,
    () => trailMarkup(trailSteps(html)) + TRAIL_BEFORE,
  )
  const foot = waysMarkup(ways)
  if (foot === '') return trailed
  once(trailed, WAYS_AFTER, 'the lessons either side')
  return trailed.replace(WAYS_AFTER, () => WAYS_AFTER + foot)
}

/** Writes each lesson page's ways on the dev server as in a build. */
export function lessonWaysPlugin(root: string): Plugin {
  const documents = new Map(
    lessonPages(root).map((n) => [resolve(root, lessonDocument(n)), n]),
  )
  return {
    name: 'mercurypitch:lesson-ways',
    transformIndexHtml: {
      order: 'pre',
      handler: (html, ctx) => {
        const n = documents.get(resolve(ctx.filename))
        return n === undefined
          ? html
          : fillLessonWays(html, lessonWays(root, n))
      },
    },
  }
}
