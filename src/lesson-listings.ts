// ============================================================
// Lesson listings — the sitemap and llms.txt as the admin console has them
// ============================================================
//
// /sitemap.xml and /llms.txt list the released lessons as built. The lesson
// gate (src/lesson-gate.ts) answers each with its lesson entries settled for
// the lesson state: a lesson that is not live taken out, and a published
// draft put in, in its file's own form. The hub follows the same live
// lessons (`liveLessons`).

import type { PageState } from './features/lessons/kit/publish'
import { isLive, seasonFor } from './features/lessons/kit/publish'
import type { Lesson } from './features/lessons/kit/season'
import { LESSONS } from './features/lessons/kit/season'

/** The site's address, as the sitemap and llms.txt write it. */
export const SITE_ORIGIN = 'https://mercurypitch.com'

/** Where a listed address leads: its site and lesson, for a lesson page; null otherwise. */
function lessonAt(address: string): { origin: string; n: number } | null {
  const m = /^(https?:\/\/[^/\s]+)\/learn\/(\d{2})$/.exec(address.trim())
  return m === null ? null : { origin: m[1], n: Number(m[2]) }
}

/** The lessons a listing should hold for `state`, as the page shows the season: live, with a page. */
export function liveLessons(state: PageState): Lesson[] {
  return seasonFor(LESSONS, state).filter(
    (L) => L.page !== undefined && isLive(L.n, LESSONS, state),
  )
}

interface Entry {
  readonly n: number
  readonly text: string
}

/**
 * A listing with its lesson entries settled: each lesson that is not live
 * taken out, and each live one it lacks put in, all in lesson order where
 * the first lesson entry stood. `at` is where the entries go when it has
 * none; null leaves such a listing as it is.
 */
function settleEntries(
  text: string,
  entry: RegExp,
  state: PageState,
  added: (L: Lesson, origin: string, lead: string) => string,
  at: (rest: string) => number | null,
): string {
  const kept: Entry[] = []
  let first = -1
  let origin = SITE_ORIGIN
  let lead = ''
  const live = liveLessons(state)
  const rest = text.replace(
    entry,
    (block: string, indent: string, address: string, offset: number) => {
      const where = lessonAt(address)
      if (where === null) return block
      if (first === -1) [first, origin, lead] = [offset, where.origin, indent]
      if (live.some((L) => L.n === where.n))
        kept.push({ n: where.n, text: block })
      return ''
    },
  )
  const insertAt = first !== -1 ? first : at(rest)
  if (insertAt === null) return text
  const entries = [
    ...kept,
    ...live
      .filter((L) => !kept.some((e) => e.n === L.n))
      .map((L) => ({ n: L.n, text: added(L, origin, lead) })),
  ].sort((a, b) => a.n - b.n)
  return (
    rest.slice(0, insertAt) +
    entries.map((e) => e.text).join('') +
    rest.slice(insertAt)
  )
}

/** A sitemap `<url>` entry, with the indentation before it and the line break after it. */
const SITEMAP_ENTRY =
  /([ \t]*)<url>\s*<loc>\s*([^<\s]+)\s*<\/loc>[\s\S]*?<\/url>[ \t]*\r?\n?/g

/** The day an override last changed, as a `<lastmod>`; null while none has. */
function lastmod(state: PageState): string | null {
  const day = /^\d{4}-\d{2}-\d{2}/.exec(state.updatedAt ?? '')
  return day === null ? null : day[0]
}

/** The sitemap with its lesson entries settled for `state`. */
export function editSitemap(xml: string, state: PageState): string {
  const day = lastmod(state)
  return settleEntries(
    xml,
    SITEMAP_ENTRY,
    state,
    (L, origin, lead) =>
      `${lead}<url>\n${lead}  <loc>${origin}${L.page ?? ''}</loc>\n${
        day === null ? '' : `${lead}  <lastmod>${day}</lastmod>\n`
      }${lead}</url>\n`,
    (rest) => {
      const end = rest.lastIndexOf('</urlset>')
      return end === -1 ? null : end
    },
  )
}

/**
 * An llms.txt list item, `- [Lesson N: Title](address): line`, with its
 * indented continuation lines. Its first group, the indentation, is always
 * empty: an item starts its line.
 */
const LLMS_ENTRY = /^()- \[[^\]\n]*\]\(([^)\s]+)\)[^\n]*(?:\n {2}[^\n]*)*\n?/gm

/** Words wrapped at `width` columns, continuation lines indented two spaces, as llms.txt is written. */
export function wrapItem(words: readonly string[], width = 80): string {
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    if (line !== '' && line.length + 1 + word.length > width) {
      lines.push(line)
      line = `  ${word}`
    } else line = line === '' ? word : `${line} ${word}`
  }
  return `${[...lines, line].join('\n')}\n`
}

/** llms.txt with its lesson items settled for `state`; an added item's line is its picked hook. */
export function editLlms(text: string, state: PageState): string {
  return settleEntries(
    text,
    LLMS_ENTRY,
    state,
    (L, origin) =>
      wrapItem([
        `- [Lesson ${L.n}: ${L.title}](${origin}${L.page ?? ''}):`,
        ...L.hook.split(/\s+/),
      ]),
    () => null,
  )
}
