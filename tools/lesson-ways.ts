// ============================================================
// Lesson ways — each lesson page's visible breadcrumb, written from its own structured data at build time
// ============================================================
//
// A lesson page is a hand-written document (learn/NN.html), and its
// BreadcrumbList tells a search engine the page sits under the home page and
// the series' hub, /learn/ (docs/plans/find-your-pitch/SEARCH.md § 3.2).
// Google asks that structured data describe what the page shows, and a
// reader, a crawler that runs no script and an answer engine all need the
// way back to the hub in the markup itself (§ 3.3). So the trail a reader
// sees is written here, on the dev server and in every build, from that same
// BreadcrumbList: the same names, in the same order, each step with an
// address a link to it, and the last one, the lesson itself, the current
// page. Nothing here names a lesson, and no document carries a copy of the
// trail, so a lesson page joins with no edit and the two cannot disagree.
//
// It goes between the masthead and the lesson, outside <main>, so "Skip to
// the lesson" passes it. MercuryPitch is a link to the home page because the
// structured data names it first and the masthead does not link home: its
// logo goes back to the top of the lesson (lesson-base.css styles the trail).

import { resolve } from 'node:path'
import type { Plugin } from 'vite'
import { lessonDocument, lessonPages } from './draft-lessons'

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

/** A lesson document with its trail written in, before its <main>; throws unless it has exactly one. */
export function fillLessonWays(html: string): string {
  if (html.split(TRAIL_BEFORE).length !== 2)
    throw new Error(
      `A lesson document must hold ${TRAIL_BEFORE} exactly once: tools/lesson-ways.ts writes its trail before it.`,
    )
  return html.replace(
    TRAIL_BEFORE,
    () => trailMarkup(trailSteps(html)) + TRAIL_BEFORE,
  )
}

/** Writes each lesson page's trail on the dev server as in a build. */
export function lessonWaysPlugin(root: string): Plugin {
  const documents = new Set(
    lessonPages(root).map((n) => resolve(root, lessonDocument(n))),
  )
  return {
    name: 'mercurypitch:lesson-ways',
    transformIndexHtml: {
      order: 'pre',
      handler: (html, ctx) =>
        documents.has(resolve(ctx.filename)) ? fillLessonWays(html) : html,
    },
  }
}
