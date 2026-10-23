// ============================================================
// Lesson gate — the lesson pages, sitemap and llms.txt as the admin console has them
// ============================================================
//
// Every build carries every Find Your Pitch lesson page (tools/draft-lessons.ts),
// so whether one is live is answered here, per request, from the lesson state
// the admin console keeps on the db-worker (src/lib/lesson-state.ts,
// GET /api/lessons/state). src/worker.ts routes four kinds of request here:
//
// - a lesson page, /learn/NN, /learn/NN.html or /learn/NN/ (GET or HEAD). A
//   lesson that is not published answers with the 404 page: status 404,
//   `X-Robots-Tag: noindex`, never stored. A published one is the asset
//   layer's answer, which a redirect (the .html and slash spellings) or any
//   answer that is not a whole HTML page passes through as it came. A whole
//   page is rewritten: the state goes into its head as
//   `<script type="application/json" id="lesson-state">`, which the page's
//   script reads (src/features/lessons/kit/page-state.ts); the picked hook
//   replaces the h1's words and the head's copies of them (the og: and
//   twitter: descriptions, the structured data); every link to a lesson that
//   is not live loses its link; and of each `data-if-live` and
//   `data-if-planned` reading the true one stays.
// - /sitemap.xml and /llms.txt, which list the released lessons as built.
//   Each answers with a lesson that is not live taken out, and a published
//   draft put in, in its file's own form.
// - the series' hub, /learn/ or /learn/index.html (GET or HEAD), which no
//   state holds back. A whole page is rewritten as a lesson page's markup
//   is, each link to a lesson that is not live unlinked and the true
//   reading of each lesson's state kept; its span of reading times and its
//   series' `hasPart` follow the lessons live here, and each lesson asks
//   the hook the console picked (tools/learn-hub.ts writes the defaults).
//
// Published, live and the season as a page shows it are publish.ts's rules,
// read by the pages too, so the worker and a page never disagree. A draft
// with no override of its own takes this environment's default,
// `LESSON_DRAFTS` in wrangler.jsonc: held back on mercurypitch.com, shown on
// the dev site, on previews and under a local `wrangler dev`.
//
// The state is read at most every 30 s per data centre: the Cache API holds
// it under a key of its own. On a miss it is fetched with a 1.5 s timeout,
// and the last good copy is kept in KV, written only when it changes. When
// the db-worker cannot answer, the KV copy stands in, and with none the
// state is empty: the site as built, which is safe to serve. A fallback is
// cached for 10 s, so an outage costs one wait per data centre in that time
// rather than one per request.
//
// A rewritten page's validators belong to the file on disk, not to what goes
// out, which changes with the state; they are dropped, conditional requests
// are not passed on (a 304 would vouch for whichever copy a browser kept),
// and the page is revalidated on every visit, as the asset layer has it.

import type { KVNamespace } from '@cloudflare/workers-types'
import type { CuriosityCopy } from './features/lessons/kit/lesson-copy'
import { hookFor, hookMarkup, isHookMarkup, LESSON_COPY, } from './features/lessons/kit/lesson-copy'
import type { PageState, Reading } from './features/lessons/kit/publish'
import { isLive, isPublished, lessonOfHref, PAGE_STATE_ID, pageStateJson, readingHolds, readingLesson, seasonFor, } from './features/lessons/kit/publish'
import type { Lesson } from './features/lessons/kit/season'
import { LESSONS, minutesSpan } from './features/lessons/kit/season'
import type { LessonState } from './lib/lesson-state'
import { parseLessonState } from './lib/lesson-state'

// `HTMLRewriter` is a Workers runtime global with no value export, and the
// repo takes Cloudflare types as `import type` only, so the surface used
// here is declared here (as src/og-voiceprint-meta.ts does). Verified under
// `wrangler dev`: getAttribute returns the value as written, entities and
// all; setAttribute escapes `"` and nothing else; renaming an element renames
// its end tag; a script's text can arrive in several chunks.
interface ContentOptions {
  html: boolean
}
export interface RewriterElement {
  readonly removed: boolean
  tagName: string
  getAttribute(name: string): string | null
  setAttribute(name: string, value: string): void
  removeAttribute(name: string): void
  append(content: string, options?: ContentOptions): void
  setInnerContent(content: string, options?: ContentOptions): void
  remove(): void
  removeAndKeepContent(): void
}
export interface RewriterText {
  readonly text: string
  readonly lastInTextNode: boolean
  replace(content: string, options?: ContentOptions): void
  remove(): void
}
interface Handlers {
  element?(element: RewriterElement): void
  text?(text: RewriterText): void
}
interface Rewriter {
  on(selector: string, handlers: Handlers): Rewriter
  transform(response: Response): Response
}
declare const HTMLRewriter: { new (): Rewriter }

/** What the gate reads of the site worker's env (src/worker.ts `Env`). */
export interface LessonGateEnv {
  ASSETS: { fetch(request: Request): Promise<Response> }
  /** Holds the last good state. Absent under a plain local `wrangler dev`. */
  SHARE_STORE?: KVNamespace
  DB_API_URL?: string
  /** This environment's default for a draft: "1" or "true" publishes it. */
  LESSON_DRAFTS?: string
}

/** The part of the Workers execution context the gate uses. */
export interface WaitUntil {
  waitUntil(promise: Promise<unknown>): void
}

/** How long a data centre keeps the state it read: the db-worker's own max-age. */
export const STATE_TTL_S = 30
/** How long a data centre keeps a fallback before it asks the db-worker again. */
export const FALLBACK_TTL_S = 10
/** How long a lesson page waits on the db-worker before it falls back. */
export const STATE_TIMEOUT_MS = 1500

const EMPTY_STATE: LessonState = { version: 1, updatedAt: null, lessons: {} }

/** What every rewritten answer is cached as: kept, and revalidated each visit. */
const REVALIDATE = 'public, max-age=0, must-revalidate'

/** Where the asset layer serves the 404 page from (404.html). */
const NOT_FOUND_PATH = '/404'

/** The site's address, as the sitemap and llms.txt write it. */
const SITE_ORIGIN = 'https://mercurypitch.com'

const LESSON_PAGE = /^\/learn\/(\d{2})(?:\.html|\/)?$/

/** The hub, at its address and as its document; the asset layer redirects the second. */
const HUB_PAGE = /^\/learn\/(?:index\.html)?$/

// ── Routing ──────────────────────────────────────────────────────────

/**
 * The answer for a lesson page, the hub, /sitemap.xml or /llms.txt; null
 * for any other request, which src/worker.ts serves as before.
 */
export async function handleLessonRequest(
  request: Request,
  env: LessonGateEnv,
  ctx?: WaitUntil,
): Promise<Response | null> {
  if (request.method !== 'GET' && request.method !== 'HEAD') return null
  const { pathname } = new URL(request.url)
  const page = LESSON_PAGE.exec(pathname)
  if (page !== null) return lessonPage(Number(page[1]), request, env, ctx)
  if (HUB_PAGE.test(pathname)) return hubPage(request, env, ctx)
  if (pathname === '/sitemap.xml')
    return listing(request, env, ctx, editSitemap)
  if (pathname === '/llms.txt') return listing(request, env, ctx, editLlms)
  return null
}

// ── The state ────────────────────────────────────────────────────────

/** Whether this environment publishes a draft the console has not set: "1" or "true", as the build's switch reads it. */
export function draftsShownBy(value: string | undefined): boolean {
  const normalized = (value ?? '').trim().toLowerCase()
  return normalized === '1' || normalized === 'true'
}

interface EdgeCache {
  match(key: Request): Promise<Response | undefined>
  put(key: Request, response: Response): Promise<void>
}

/** The data centre's cache: the Workers runtime's `caches.default`, absent elsewhere. */
function edgeCache(): EdgeCache | null {
  const store = (globalThis as { caches?: { default?: EdgeCache } }).caches
  return store?.default ?? null
}

/** The cache's key for the state: never a page's own address, and one per db-worker. */
function stateKey(requestUrl: string, api: string): Request {
  const key = new URL('/__lesson-state/v1', requestUrl)
  key.searchParams.set('api', api)
  return new Request(key.toString())
}

/** The KV key of the last good state read from this db-worker. */
const lastGoodKey = (api: string): string => `lesson-state:last-good:${api}`

async function readJson(response: Response): Promise<LessonState | null> {
  try {
    return parseLessonState(await response.json())
  } catch {
    return null
  }
}

async function fromCache(
  cache: EdgeCache | null,
  key: Request,
): Promise<LessonState | null> {
  if (cache === null) return null
  try {
    const hit = await cache.match(key)
    return hit === undefined ? null : await readJson(hit)
  } catch {
    return null
  }
}

async function fromApi(api: string): Promise<LessonState | null> {
  if (api === '') return null
  try {
    const response = await fetch(
      new URL('/api/lessons/state', api).toString(),
      {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(STATE_TIMEOUT_MS),
      },
    )
    return response.ok ? await readJson(response) : null
  } catch {
    return null
  }
}

async function fromKv(
  kv: KVNamespace | undefined,
  key: string,
): Promise<LessonState | null> {
  if (kv === undefined) return null
  try {
    const text = await kv.get(key)
    return text === null ? null : parseLessonState(JSON.parse(text))
  } catch {
    return null
  }
}

/** Writes the last good state to KV only when it differs from what is there. */
async function keepLastGood(
  kv: KVNamespace | undefined,
  key: string,
  json: string,
): Promise<void> {
  if (kv === undefined) return
  if ((await kv.get(key)) !== json) await kv.put(key, json)
}

function cacheEntry(state: LessonState, seconds: number): Response {
  return new Response(JSON.stringify(state), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': `max-age=${seconds}`,
    },
  })
}

/** Work that may finish after the answer goes; its failure costs nothing but the copy. */
function later(ctx: WaitUntil | undefined, work: Promise<unknown>): void {
  const settled = work.catch(() => undefined)
  if (ctx !== undefined) ctx.waitUntil(settled)
}

/**
 * The lesson state for this request: the data centre's copy while it is
 * fresh, else the db-worker's, else the last good copy in KV, else empty.
 */
export async function resolveLessonState(
  request: Request,
  env: LessonGateEnv,
  ctx?: WaitUntil,
): Promise<LessonState> {
  const api = env.DB_API_URL ?? ''
  const cache = edgeCache()
  const key = stateKey(request.url, api)
  const cached = await fromCache(cache, key)
  if (cached !== null) return cached

  const fresh = await fromApi(api)
  const kvKey = lastGoodKey(api)
  if (fresh !== null) {
    later(
      ctx,
      Promise.all([
        cache?.put(key, cacheEntry(fresh, STATE_TTL_S)),
        keepLastGood(env.SHARE_STORE, kvKey, JSON.stringify(fresh)),
      ]),
    )
    return fresh
  }
  const fallback = (await fromKv(env.SHARE_STORE, kvKey)) ?? EMPTY_STATE
  if (cache !== null)
    later(ctx, cache.put(key, cacheEntry(fallback, FALLBACK_TTL_S)))
  return fallback
}

async function pageStateFor(
  request: Request,
  env: LessonGateEnv,
  ctx: WaitUntil | undefined,
): Promise<PageState> {
  const state = await resolveLessonState(request, env, ctx)
  return { ...state, drafts: draftsShownBy(env.LESSON_DRAFTS) }
}

// ── Answers ──────────────────────────────────────────────────────────

const CONDITIONAL_HEADERS = [
  'If-None-Match',
  'If-Modified-Since',
  'If-Match',
  'If-Unmodified-Since',
  'If-Range',
  'Range',
]

/**
 * The request as the asset layer is asked it: no conditions, so a whole
 * answer, at `path` if given. Its redirects come back as they are, as the
 * incoming request's do: a Request built without `redirect` follows them,
 * and a lesson's other spellings would then answer with the page and a 200
 * instead of the asset layer's 307 to its address.
 */
function unconditional(request: Request, path?: string): Request {
  const headers = new Headers(request.headers)
  for (const name of CONDITIONAL_HEADERS) headers.delete(name)
  const url = path === undefined ? request.url : new URL(path, request.url)
  return new Request(url.toString(), {
    method: request.method,
    headers,
    redirect: 'manual',
  })
}

/** An asset's headers for an answer made from it: no validators, no length, `cacheControl`. */
function answerHeaders(asset: Response, cacheControl: string): Headers {
  const headers = new Headers(asset.headers)
  headers.delete('ETag')
  headers.delete('Last-Modified')
  headers.delete('Content-Length')
  headers.set('Cache-Control', cacheControl)
  return headers
}

const isHtml = (response: Response): boolean =>
  (response.headers.get('Content-Type') ?? '').startsWith('text/html')

/** A page the asset layer answered whole: a 200 with HTML in it, which is the one answer rewritten. */
const isWholePage = (response: Response): boolean =>
  response.status === 200 && isHtml(response)

/** `page` rewritten, with its validators dropped, as `status`; only headers for a HEAD. */
function rewrite(
  page: Response,
  rewriter: Rewriter,
  method: string,
  init: { status: number; cacheControl: string; noindex?: boolean },
): Response {
  const headers = answerHeaders(page, init.cacheControl)
  if (init.noindex === true) headers.set('X-Robots-Tag', 'noindex')
  const body =
    method === 'HEAD' || !isHtml(page) ? null : rewriter.transform(page).body
  return new Response(body, { status: init.status, headers })
}

async function lessonPage(
  n: number,
  request: Request,
  env: LessonGateEnv,
  ctx: WaitUntil | undefined,
): Promise<Response> {
  const state = await pageStateFor(request, env, ctx)
  if (!isPublished(n, state)) {
    // The 404 page whatever the asset layer's status for it, which is a
    // 200 at its own address and a 404 anywhere else.
    const page = await env.ASSETS.fetch(unconditional(request, NOT_FOUND_PATH))
    return rewrite(
      page,
      followState(new HTMLRewriter(), state),
      request.method,
      {
        status: 404,
        cacheControl: 'no-store',
        noindex: true,
      },
    )
  }
  const asset = await env.ASSETS.fetch(unconditional(request))
  if (!isWholePage(asset)) return asset
  return rewrite(asset, lessonRewriter(n, state), request.method, {
    status: 200,
    cacheControl: REVALIDATE,
  })
}

async function listing(
  request: Request,
  env: LessonGateEnv,
  ctx: WaitUntil | undefined,
  edit: (text: string, state: PageState) => string,
): Promise<Response> {
  const state = await pageStateFor(request, env, ctx)
  const asset = await env.ASSETS.fetch(unconditional(request))
  if (asset.status !== 200) return asset
  const headers = answerHeaders(asset, REVALIDATE)
  if (request.method === 'HEAD') return new Response(null, { headers })
  return new Response(edit(await asset.text(), state), { headers })
}

// ── The page ─────────────────────────────────────────────────────────

const NAMED_ENTITIES: Readonly<Record<string, string>> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
  ndash: '–',
  mdash: '—',
  hellip: '…',
}

function codePoint(all: string, code: number): string {
  return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : all
}

/** An attribute's text as a browser reads it: numeric entities and the common named ones decoded. */
export function decodeHtml(text: string): string {
  return text.replace(
    /&(?:#(\d+)|#x([0-9a-f]+)|([a-z]+));/gi,
    (all: string, dec?: string, hex?: string, name?: string) => {
      if (dec !== undefined) return codePoint(all, Number(dec))
      if (hex !== undefined) return codePoint(all, parseInt(hex, 16))
      return NAMED_ENTITIES[name ?? ''] ?? all
    },
  )
}

/** Text as an attribute value: setAttribute escapes `"` alone, so this does the rest. */
export function escapeAttribute(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/** The tag that carries a page's state; its text cannot close it (pageStateJson). */
export const stateTag = (state: PageState): string =>
  `<script type="application/json" id="${PAGE_STATE_ID}">${pageStateJson(state)}</script>`

/** The head's copies of a lesson's hook. */
const HOOK_COPIES = new Set([
  'description',
  'og:title',
  'og:description',
  'twitter:title',
  'twitter:description',
])

/** A head copy with its lesson's hook `from` told as `to`; untouched when it does not quote it. */
function retellMeta(meta: RewriterElement, from: string, to: string): void {
  const key = meta.getAttribute('property') ?? meta.getAttribute('name')
  if (key === null || !HOOK_COPIES.has(key)) return
  const content = decodeHtml(meta.getAttribute('content') ?? '')
  if (!content.includes(from)) return
  meta.setAttribute('content', escapeAttribute(content.split(from).join(to)))
}

function retold(value: unknown, from: string, to: string): unknown {
  if (typeof value === 'string') return value.split(from).join(to)
  if (Array.isArray(value)) return value.map((v) => retold(v, from, to))
  if (typeof value !== 'object' || value === null) return value
  return Object.fromEntries(
    Object.entries(value).map(([k, v]) => [k, retold(v, from, to)]),
  )
}

/**
 * Structured data with every quote of the hook `from` told as `to`, `<`
 * escaped so it cannot close its script; the text as it came when it
 * quotes no hook or is not JSON.
 */
export function retellJson(text: string, from: string, to: string): string {
  if (!text.includes(from)) return text
  try {
    const value: unknown = JSON.parse(text)
    return JSON.stringify(retold(value, from, to), null, 2).replace(
      /</g,
      '\\u003c',
    )
  } catch {
    return text
  }
}

/** Gathers a script's text, which can arrive in chunks, and writes it back as `edit` has it. */
function scriptsAs(edit: (text: string) => string): Handlers {
  let text = ''
  return {
    text(chunk) {
      text += chunk.text
      if (!chunk.lastInTextNode) {
        chunk.remove()
        return
      }
      chunk.replace(edit(text), { html: true })
      text = ''
    },
  }
}

/** Link-only attributes a chip loses with its link. */
const LINK_ATTRIBUTES = [
  'href',
  'target',
  'rel',
  'download',
  'hreflang',
  'ping',
]

/** A link made no link: a prerequisite chip stays as a plain chip, and any other keeps its words. */
function unlink(a: RewriterElement): void {
  const classes = (a.getAttribute('class') ?? '').split(/\s+/).filter(Boolean)
  if (!classes.includes('chip-link')) {
    a.removeAndKeepContent()
    return
  }
  a.tagName = 'span'
  for (const name of LINK_ATTRIBUTES) a.removeAttribute(name)
  a.setAttribute('class', classes.filter((c) => c !== 'chip-link').join(' '))
}

function reading(kind: Reading, state: PageState): Handlers {
  return {
    element(el) {
      if (el.removed) return
      const n = readingLesson(el.getAttribute(`data-if-${kind}`))
      if (n === null) return
      if (readingHolds(kind, n, LESSONS, state)) el.removeAndKeepContent()
      else el.remove()
    },
  }
}

/**
 * Settles a page's markup for `state`, as page-state.ts `followPageState`
 * does in the browser: a link to a lesson that is not live goes from a nav
 * and loses its link anywhere else, and the true reading of each lesson's
 * state stays.
 */
export function followState(rewriter: Rewriter, state: PageState): Rewriter {
  const dead = (a: RewriterElement): boolean => {
    const n = lessonOfHref(decodeHtml(a.getAttribute('href') ?? ''))
    return n !== null && !isLive(n, LESSONS, state)
  }
  return rewriter
    .on('nav a[href]', {
      element: (a) => (dead(a) ? a.remove() : undefined),
    })
    .on('a[href]', {
      element: (a) => (!a.removed && dead(a) ? unlink(a) : undefined),
    })
    .on('[data-if-live]', reading('live', state))
    .on('[data-if-planned]', reading('planned', state))
}

/**
 * Lesson `n`'s page for `state`: its state in its head, the hook its
 * override picks from `copy` (lesson-copy.ts), and its markup settled.
 */
export function lessonRewriter(
  n: number,
  state: PageState,
  copy: Readonly<Partial<Record<number, CuriosityCopy>>> = LESSON_COPY,
): Rewriter {
  let rewriter = new HTMLRewriter()
    .on(`script#${PAGE_STATE_ID}`, { element: (el) => el.remove() })
    .on('head', {
      element: (head) => head.append(stateTag(state), { html: true }),
    })
  const lesson = LESSONS.find((L) => L.n === n)
  const picked = state.lessons[String(n)]?.hook
  const markup = hookMarkup(n, picked, copy)
  if (lesson !== undefined && markup !== null && isHookMarkup(markup)) {
    const from = lesson.hook
    const to = hookFor({ ...lesson, ...copy[n] }, picked).text
    rewriter = rewriter
      .on('#hook', {
        element: (h1) => h1.setInnerContent(markup, { html: true }),
      })
      .on('head meta[content]', {
        element: (meta) => retellMeta(meta, from, to),
      })
      .on(
        'script[type="application/ld+json"]',
        scriptsAs((text) => retellJson(text, from, to)),
      )
  }
  return followState(rewriter, state)
}

// ── The listings ─────────────────────────────────────────────────────

/** Where a listed address leads: its site and lesson, for a lesson page; null otherwise. */
function lessonAt(address: string): { origin: string; n: number } | null {
  const m = /^(https?:\/\/[^/\s]+)\/learn\/(\d{2})$/.exec(address.trim())
  return m === null ? null : { origin: m[1], n: Number(m[2]) }
}

/** The lessons a listing should hold for `state`, as the page shows the season: live, with a page. */
function liveLessons(state: PageState): Lesson[] {
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

// ── The hub ──────────────────────────────────────────────────────────

/** The series' node, which the hub's structured data holds and every lesson's `isPartOf` names. */
export const SERIES_ID = `${SITE_ORIGIN}/learn/#series`

/** The hub, /learn/: never held back, whatever the state; a whole page is settled for it. */
async function hubPage(
  request: Request,
  env: LessonGateEnv,
  ctx: WaitUntil | undefined,
): Promise<Response> {
  const asset = await env.ASSETS.fetch(unconditional(request))
  if (!isWholePage(asset)) return asset
  const state = await pageStateFor(request, env, ctx)
  return rewrite(asset, hubRewriter(state), request.method, {
    status: 200,
    cacheControl: REVALIDATE,
  })
}

/**
 * The series' structured data with its `hasPart` the lessons `live`, `<`
 * escaped so it cannot close its script; any other block, or text that is
 * not JSON, as it came.
 */
export function settleSeries(text: string, live: readonly Lesson[]): string {
  let node: unknown
  try {
    node = JSON.parse(text)
  } catch {
    return text
  }
  if (typeof node !== 'object' || node === null) return text
  if ((node as { '@id'?: unknown })['@id'] !== SERIES_ID) return text
  const hasPart = live.map((L) => ({
    '@id': `${SITE_ORIGIN}${L.page ?? ''}#lesson`,
  }))
  return JSON.stringify({ ...node, hasPart }, null, 2).replace(/</g, '\\u003c')
}

/**
 * The hub for `state`: its links and readings settled as a lesson page's
 * are, and all else it says of the lessons for the same live lessons: the
 * span of their reading times (the line goes while none is live) and the
 * series' parts. Each lesson asks the hook its override picks from `copy`
 * (lesson-copy.ts), written as text, as the lesson's own page asks it.
 */
export function hubRewriter(
  state: PageState,
  copy: Readonly<Partial<Record<number, CuriosityCopy>>> = LESSON_COPY,
): Rewriter {
  const live = liveLessons(state)
  const span = minutesSpan(live)
  const rewriter = new HTMLRewriter()
    .on(
      'script[type="application/ld+json"]',
      scriptsAs((text) => settleSeries(text, live)),
    )
    .on('.hub-time', {
      element: (p) => (span === null ? p.remove() : undefined),
    })
    .on('.hub-minutes', {
      element: (el) =>
        span === null || el.removed
          ? undefined
          : el.setInnerContent(span, { html: false }),
    })
    .on('.hub-hook[data-lesson]', {
      element: (p) => {
        const n = Number(p.getAttribute('data-lesson'))
        const lesson = LESSONS.find((L) => L.n === n)
        if (lesson === undefined) return
        const picked = state.lessons[String(n)]?.hook
        const hook = hookFor({ ...lesson, ...copy[n] }, picked).text
        if (hook !== lesson.hook) p.setInnerContent(hook, { html: false })
      },
    })
  return followState(rewriter, state)
}
