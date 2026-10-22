// ============================================================
// Lesson gate tests — the site worker answers each lesson as the console has it
// ============================================================
//
// The gate runs against the repository's own lesson pages, 404 page, sitemap
// and llms.txt, served by a stand-in for the asset layer that answers as
// Cloudflare's does (a 307 from a lesson's other spellings, a 304 to a
// request naming the file's ETag). `HTMLRewriter` is the jsdom double in
// html-rewriter.test-fixtures.ts, whose behaviour was checked against the
// runtime's; the Cache API, KV and the db-worker are stubs that record what
// they were asked. What comes out is read back with DOMParser, as a browser
// would read it.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LESSON_COPY } from '@/features/lessons/kit/lesson-copy'
import type { PageState } from '@/features/lessons/kit/publish'
import { LESSONS } from '@/features/lessons/kit/season'
import type { LessonState } from '@/lib/lesson-state'
import { isDraftLessonsShown, lessonDocument, lessonPages, } from '../tools/draft-lessons'
import { HtmlRewriterDouble } from './html-rewriter.test-fixtures'
import type { LessonGateEnv, WaitUntil } from './lesson-gate'
import { draftsShownBy, editLlms, editSitemap, FALLBACK_TTL_S, handleLessonRequest, lessonRewriter, STATE_TIMEOUT_MS, STATE_TTL_S, wrapItem, } from './lesson-gate'

const ROOT = resolve(__dirname, '..')
const repoFile = (path: string): string =>
  readFileSync(resolve(ROOT, path), 'utf8')

const SITE = 'https://mercurypitch.test'
const API = 'https://api.mercurypitch.test'
const ETAG = '"the-file-on-disk"'

/** The files the stand-in asset layer serves, by address. */
function filesByAddress(): Record<string, { body: string; type: string }> {
  const files: Record<string, { body: string; type: string }> = {
    '/404': { body: repoFile('404.html'), type: 'text/html; charset=utf-8' },
    '/sitemap.xml': {
      body: repoFile('public/sitemap.xml'),
      type: 'application/xml',
    },
    '/llms.txt': {
      body: repoFile('public/llms.txt'),
      type: 'text/plain; charset=utf-8',
    },
  }
  for (const n of lessonPages(ROOT))
    files[`/learn/${String(n).padStart(2, '0')}`] = {
      body: repoFile(lessonDocument(n)),
      type: 'text/html; charset=utf-8',
    }
  return files
}

/** Answers as Cloudflare's asset layer does for these files. */
function assetLayer() {
  const files = filesByAddress()
  return vi.fn(async (request: Request): Promise<Response> => {
    let { pathname } = new URL(request.url)
    const spelling = /^(\/learn\/\d{2})(?:\.html|\/)$/.exec(pathname)
    if (spelling !== null) {
      // Only a request that takes its redirects by hand sees the 307. The
      // runtime follows it for any other, as it does for a Request built
      // without `redirect`, and answers with the page and a 200.
      if (request.redirect === 'manual')
        return new Response(null, {
          status: 307,
          headers: { Location: spelling[1] },
        })
      pathname = spelling[1]
    }
    const file = files[pathname]
    const headers = {
      'Content-Type': file?.type ?? 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=0, must-revalidate',
      ETag: ETAG,
      'Last-Modified': 'Sun, 18 Oct 2026 12:00:00 GMT',
      'X-Content-Type-Options': 'nosniff',
    }
    if (request.headers.get('If-None-Match') === ETAG)
      return new Response(null, { status: 304, headers })
    const body =
      request.method === 'HEAD' ? null : (file?.body ?? files['/404'].body)
    return new Response(body, {
      status: file === undefined ? 404 : 200,
      headers,
    })
  })
}

/** A KV namespace that remembers what it was given. */
function memoryKv(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial))
  return {
    store,
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    put: vi.fn(async (key: string, value: string) => {
      store.set(key, value)
    }),
  }
}

/** The Cache API's `caches.default`, holding what was put in it. */
function memoryCache() {
  const entries = new Map<string, { body: string; cacheControl: string }>()
  return {
    entries,
    match: vi.fn(async (key: Request) => {
      const hit = entries.get(key.url)
      return hit === undefined ? undefined : new Response(hit.body)
    }),
    put: vi.fn(async (key: Request, response: Response) => {
      entries.set(key.url, {
        body: await response.text(),
        cacheControl: response.headers.get('Cache-Control') ?? '',
      })
    }),
  }
}

/** The db-worker's GET /api/lessons/state, answering `state` (or a body of its own). */
function stateApi(answer: LessonState | string | (() => Promise<Response>)) {
  return vi.fn(async (_url: string, _init?: RequestInit): Promise<Response> => {
    if (typeof answer === 'function') return answer()
    const body = typeof answer === 'string' ? answer : JSON.stringify(answer)
    return new Response(body, {
      headers: { 'Content-Type': 'application/json' },
    })
  })
}

function stateOf(
  lessons: LessonState['lessons'],
  updatedAt: string | null = '2026-10-20T09:30:00.000Z',
): LessonState {
  return { version: 1, updatedAt, lessons }
}

interface Setup {
  state?: LessonState | string | (() => Promise<Response>)
  drafts?: string
  /** null for no KV binding, as a plain local `wrangler dev` has. */
  kv?: ReturnType<typeof memoryKv> | null
  /** null for no Cache API, as outside the Workers runtime. */
  cache?: ReturnType<typeof memoryCache> | null
  dbApiUrl?: string
}

function gate(setup: Setup = {}) {
  const assets = assetLayer()
  const kv = setup.kv === undefined ? memoryKv() : setup.kv
  const cache = setup.cache === undefined ? memoryCache() : setup.cache
  const api = stateApi(setup.state ?? stateOf({}, null))
  vi.stubGlobal('fetch', api)
  vi.stubGlobal('caches', cache === null ? undefined : { default: cache })
  const pending: Promise<unknown>[] = []
  const ctx: WaitUntil = { waitUntil: (work) => void pending.push(work) }
  const env = {
    ASSETS: { fetch: assets },
    SHARE_STORE: kv ?? undefined,
    DB_API_URL: setup.dbApiUrl ?? API,
    ...(setup.drafts === undefined ? {} : { LESSON_DRAFTS: setup.drafts }),
  } as unknown as LessonGateEnv
  const ask = async (path: string, init: RequestInit = {}) => {
    const response = await handleLessonRequest(
      new Request(`${SITE}${path}`, init),
      env,
      ctx,
    )
    await Promise.all(pending.splice(0))
    return response
  }
  return { ask, assets, kv, cache, api }
}

const read = (html: string): Document =>
  new DOMParser().parseFromString(html, 'text/html')

async function page(response: Response | null): Promise<Document> {
  expect(response).not.toBeNull()
  return read(await (response as Response).text())
}

const words = (el: Element | null): string =>
  (el?.textContent ?? '').replace(/\s+/g, ' ').trim()

const meta = (doc: Document, key: string): string | null =>
  doc
    .querySelector(`meta[property="${key}"], meta[name="${key}"]`)
    ?.getAttribute('content') ?? null

beforeEach(() => {
  vi.stubGlobal('HTMLRewriter', HtmlRewriterDouble)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

// Lesson 3 waits on the vocal coach (drafts.ts); Lesson 2 is released.
describe('a lesson page', () => {
  it('answers a lesson held back with the 404 page, at every spelling of its address', async () => {
    for (const path of ['/learn/02', '/learn/02.html', '/learn/02/']) {
      // Arrange
      const { ask } = gate({ state: stateOf({ 2: { published: false } }) })

      // Act
      const response = await ask(path)

      // Assert
      expect(response?.status, path).toBe(404)
      expect(response?.headers.get('X-Robots-Tag'), path).toBe('noindex')
      expect(response?.headers.get('Cache-Control'), path).toBe('no-store')
      expect(response?.headers.get('ETag'), path).toBeNull()
      const doc = await page(response)
      expect(doc.querySelector('main.error-scene'), path).not.toBeNull()
      expect(doc.getElementById('hook'), path).toBeNull()
    }
  })

  it('answers a HEAD for a lesson held back with a 404 and no body', async () => {
    // Arrange
    const { ask } = gate({ state: stateOf({ 2: { published: false } }) })

    // Act
    const response = await ask('/learn/02', { method: 'HEAD' })

    // Assert
    expect(response?.status).toBe(404)
    expect(await response?.text()).toBe('')
  })

  it("takes a lesson held back out of the 404 page's own nav", async () => {
    // Arrange
    const { ask } = gate({ state: stateOf({ 1: { published: false } }) })

    // Act
    const doc = await page(await ask('/learn/01'))

    // Assert: Lesson 2 is still linked there, Lesson 1 no longer is
    const hrefs = Array.from(doc.querySelectorAll('nav a')).map((a) =>
      a.getAttribute('href'),
    )
    expect(hrefs).toContain('/learn/02')
    expect(hrefs).not.toContain('/learn/01')
  })

  it('serves a released lesson nothing holds back, rewritten, with no validators', async () => {
    // Arrange
    const { ask } = gate()

    // Act
    const response = await ask('/learn/02')

    // Assert
    expect(response?.status).toBe(200)
    expect(response?.headers.get('ETag')).toBeNull()
    expect(response?.headers.get('Last-Modified')).toBeNull()
    expect(response?.headers.get('Cache-Control')).toBe(
      'public, max-age=0, must-revalidate',
    )
    expect(response?.headers.get('X-Content-Type-Options')).toBe('nosniff')
    const doc = await page(response)
    expect(words(doc.getElementById('hook'))).toBe(LESSONS[2].hook)
  })

  it("never passes a browser's conditions on, so no 304 vouches for a copy it kept", async () => {
    // Arrange
    const { ask, assets } = gate()

    // Act
    const response = await ask('/learn/02', {
      headers: {
        'If-None-Match': ETAG,
        'If-Modified-Since': 'x',
        Range: 'bytes=0-9',
      },
    })

    // Assert
    expect(response?.status).toBe(200)
    const asked = assets.mock.calls[0][0]
    expect(asked.headers.get('If-None-Match')).toBeNull()
    expect(asked.headers.get('If-Modified-Since')).toBeNull()
    expect(asked.headers.get('Range')).toBeNull()
  })

  it("passes the asset layer's redirect from the other spellings through as it came", async () => {
    for (const path of ['/learn/02.html', '/learn/02/']) {
      // Arrange
      const { ask } = gate()

      // Act
      const response = await ask(path)

      // Assert
      expect(response?.status, path).toBe(307)
      expect(response?.headers.get('Location'), path).toBe('/learn/02')
    }
  })

  it('passes any answer that is not a whole page through: a 304, a missing page', async () => {
    // Arrange: the asset layer answers a 304 to everything
    const { ask, assets } = gate()
    assets.mockImplementation(
      async () =>
        new Response(null, {
          status: 304,
          headers: { ETag: ETAG, 'Content-Type': 'text/html' },
        }),
    )

    // Act
    const notModified = await ask('/learn/02')

    // Assert
    expect(notModified?.status).toBe(304)
    expect(notModified?.headers.get('ETag')).toBe(ETAG)

    // A lesson no page is built for yet is the asset layer's own 404
    const { ask: askUnbuilt } = gate()
    const missing = await askUnbuilt('/learn/14')
    expect(missing?.status).toBe(404)
    expect(missing?.headers.get('X-Robots-Tag')).toBeNull()
  })

  it('answers a HEAD for a published lesson with its headers and no body', async () => {
    // Arrange
    const { ask } = gate()

    // Act
    const response = await ask('/learn/02', { method: 'HEAD' })

    // Assert
    expect(response?.status).toBe(200)
    expect(response?.headers.get('ETag')).toBeNull()
    expect(await response?.text()).toBe('')
  })

  it('leaves every other request to the worker', async () => {
    // Arrange
    const { ask } = gate()

    // Act + Assert
    for (const path of [
      '/learn/',
      '/learn/3',
      '/learn/03/extra',
      '/learn/lesson-01-og.jpg',
      '/sitemap.xml.gz',
    ])
      expect(await ask(path), path).toBeNull()
    expect(await ask('/learn/03', { method: 'POST' })).toBeNull()
  })
})

describe("an environment's default for drafts", () => {
  it('holds a draft with no override back where LESSON_DRAFTS is "0" or unset', async () => {
    for (const drafts of ['0', undefined]) {
      // Arrange
      const { ask } = gate({ drafts })

      // Act
      const response = await ask('/learn/03')

      // Assert
      expect(response?.status, String(drafts)).toBe(404)
    }
  })

  it('publishes a draft with no override where LESSON_DRAFTS is "1"', async () => {
    // Arrange
    const { ask } = gate({ drafts: '1' })

    // Act
    const response = await ask('/learn/03')

    // Assert
    expect(response?.status).toBe(200)
    expect(words((await page(response)).getElementById('hook'))).toBe(
      LESSONS[3].hook,
    )
  })

  it('reads the var as the build reads its own switch', () => {
    for (const value of [
      undefined,
      '',
      '0',
      '1',
      'true',
      ' TRUE ',
      'false',
      'yes',
    ])
      expect(draftsShownBy(value), String(value)).toBe(
        isDraftLessonsShown(value),
      )
  })
})

describe("the console's overrides", () => {
  it('publish a draft where drafts are held back', async () => {
    // Arrange
    const { ask } = gate({
      drafts: '0',
      state: stateOf({ 3: { published: true } }),
    })

    // Act
    const response = await ask('/learn/03')

    // Assert
    expect(response?.status).toBe(200)
  })

  it('hold back a draft where drafts are shown, and a released lesson anywhere', async () => {
    // Arrange
    const state = stateOf({ 3: { published: false }, 2: { published: false } })
    const { ask } = gate({ drafts: '1', state })

    // Act + Assert
    expect((await ask('/learn/03'))?.status).toBe(404)
    expect((await ask('/learn/02'))?.status).toBe(404)
    expect((await ask('/learn/01'))?.status).toBe(200)
  })

  it("write the page's state into its head, for the page's script", async () => {
    // Arrange
    const state = stateOf({ 3: { published: true, hook: 'figures' } })
    const { ask } = gate({ drafts: '0', state })

    // Act
    const doc = await page(await ask('/learn/03'))

    // Assert
    const tags = doc.head.querySelectorAll('script#lesson-state')
    expect(tags).toHaveLength(1)
    expect(tags[0].getAttribute('type')).toBe('application/json')
    expect(JSON.parse(tags[0].textContent ?? '')).toEqual({
      ...state,
      drafts: false,
    })
  })

  it('keep a state whose text could close its tag inside it', async () => {
    // Arrange: updatedAt is any string the db-worker answers
    const state = stateOf({}, '</script><script>alert(1)</script>')
    const { ask } = gate({ state })

    // Act
    const response = await ask('/learn/02')
    const html = await (response as Response).text()

    // Assert: the whole of it is the tag's text, and no script of its own
    expect(html).not.toContain('</script><script>alert(1)')
    const doc = read(html)
    const holding = Array.from(doc.querySelectorAll('script')).filter((s) =>
      (s.textContent ?? '').includes('alert(1)'),
    )
    expect(holding.map((s) => s.id)).toEqual(['lesson-state'])
    const tag = doc.getElementById('lesson-state')
    expect(JSON.parse(tag?.textContent ?? '').updatedAt).toBe(state.updatedAt)
  })
})

describe('the picked hook', () => {
  const FIGURES = LESSON_COPY[3]?.hookAlts?.[0]

  it("replaces Lesson 3's h1 and every copy of it in the head", async () => {
    // Arrange
    const state = stateOf({ 3: { hook: 'figures' } })
    const { ask } = gate({ drafts: '1', state })

    // Act
    const doc = await page(await ask('/learn/03'))

    // Assert
    expect(FIGURES?.id).toBe('figures')
    expect(words(doc.getElementById('hook'))).toBe(FIGURES?.text)
    expect(meta(doc, 'og:description')).toBe(FIGURES?.text)
    expect(meta(doc, 'twitter:description')).toBe(FIGURES?.text)
    for (const key of ['description', 'og:title', 'twitter:title'])
      expect(meta(doc, key), key).not.toContain(LESSONS[3].hook)
  })

  it('keeps the default for an id the lesson does not have, or none', async () => {
    for (const hook of ['gone', 'default', undefined]) {
      // Arrange
      const state = stateOf(hook === undefined ? {} : { 3: { hook } })
      const { ask } = gate({ drafts: '1', state })

      // Act
      const doc = await page(await ask('/learn/03'))

      // Assert
      expect(words(doc.getElementById('hook')), String(hook)).toBe(
        LESSONS[3].hook,
      )
      expect(meta(doc, 'og:description'), String(hook)).toBe(LESSONS[3].hook)
    }
  })

  // A variant whose words hold every character markup cares about, an
  // entity's spelling among them, on a lesson whose head quotes its hook
  // three times and adds to one of them.
  const ODD = 'Is 3 < 4 & "five" > 2, or ‘six’, and is &amp; a word?'
  const COPY = { 1: { hookAlts: [{ id: 'odd', text: ODD }] } }

  async function lessonOne(): Promise<{ doc: Document; html: string }> {
    const asset = new Response(repoFile('learn/01.html'), {
      headers: { 'Content-Type': 'text/html' },
    })
    const state: PageState = {
      ...stateOf({ 1: { hook: 'odd' } }),
      drafts: false,
    }
    const html = await lessonRewriter(1, state, COPY).transform(asset).text()
    return { doc: read(html), html }
  }

  it('escapes its words in the h1 and the head, as a browser reads them back', async () => {
    // Act
    const { doc } = await lessonOne()

    // Assert
    expect(words(doc.getElementById('hook'))).toBe(ODD)
    expect(doc.getElementById('hook')?.querySelector('script, b, i')).toBeNull()
    expect(meta(doc, 'twitter:description')).toBe(ODD)
    expect(meta(doc, 'og:description')).toBe(`${ODD} Hear it, then see why.`)
  })

  it('retells the structured data, which stays JSON that cannot close its script', async () => {
    // Act
    const { doc } = await lessonOne()

    // Assert
    const scripts = Array.from(
      doc.querySelectorAll('script[type="application/ld+json"]'),
    )
    expect(scripts.map((s) => s.textContent ?? '').join('')).not.toContain('<')
    const [article, breadcrumbs] = scripts.map(
      (s) => JSON.parse(s.textContent ?? '') as Record<string, unknown>,
    )
    expect(article.alternativeHeadline).toBe(ODD)
    expect(article.headline).toBe('What is a note?')
    expect(breadcrumbs['@type']).toBe('BreadcrumbList')
  })

  it('finds a hook its page writes with entities, as Lesson 5 writes its quotation marks', async () => {
    // Arrange: Lesson 5's head writes “support” as &#8220;support&#8221;
    const copy = {
      5: {
        hookAlts: [{ id: 'plain', text: 'What keeps a long note steady?' }],
      },
    }
    const asset = new Response(repoFile('learn/05.html'), {
      headers: { 'Content-Type': 'text/html' },
    })
    const state: PageState = {
      ...stateOf({ 5: { published: true, hook: 'plain' } }),
      drafts: false,
    }

    // Act
    const doc = read(
      await lessonRewriter(5, state, copy).transform(asset).text(),
    )

    // Assert
    expect(words(doc.getElementById('hook'))).toBe(
      'What keeps a long note steady?',
    )
    expect(meta(doc, 'og:description')).toBe('What keeps a long note steady?')
    expect(meta(doc, 'twitter:description')).toBe(
      'What keeps a long note steady?',
    )
  })

  it('is quoted whole by every page that has one to pick, so the rewrite finds it', () => {
    // A lesson with alternative hooks and a page: its h1 and every head copy
    // that carries its hook must quote the default exactly, or a pick would
    // change the h1 and leave the head telling the old one.
    const pages = new Set(lessonPages(ROOT))
    const pickable = LESSONS.filter(
      (L) => (L.hookAlts?.length ?? 0) > 0 && pages.has(L.n),
    )
    expect(pickable.map((L) => L.n)).toContain(3)
    for (const L of pickable) {
      const doc = read(repoFile(lessonDocument(L.n)))
      expect(words(doc.getElementById('hook')), `${L.n}`).toBe(L.hook)
      expect(meta(doc, 'twitter:description'), `${L.n}`).toBe(L.hook)
      expect(meta(doc, 'og:description'), `${L.n}`).toContain(L.hook)
    }
  })
})

describe("a page's links and readings", () => {
  /** Lesson 5's page, whose chips link Lessons 2 and 3, with two readings added. */
  async function lessonFive(
    lessons: LessonState['lessons'],
  ): Promise<Document> {
    const html = repoFile('learn/05.html').replace(
      '<p class="promise">',
      '<p id="readings">Lesson 2 is <span data-if-live="2">ready</span\n><span data-if-planned="2" hidden>coming later</span>; Lesson 3 is <span data-if-live="3" hidden>ready</span\n><span data-if-planned="3">coming later</span>; <span data-if-live="x">odd</span>.</p><nav id="extra"><a href="/learn/03">Three</a><a href="/learn/02">Two</a></nav><p id="other"><a href="/learn/03#step-2">step two of Lesson 3</a></p><p class="promise">',
    )
    const asset = new Response(html, {
      headers: { 'Content-Type': 'text/html' },
    })
    const state: PageState = { ...stateOf(lessons), drafts: false }
    return read(await lessonRewriter(5, state).transform(asset).text())
  }

  it('keep a link to a lesson that is live', async () => {
    // Act: Lesson 3 published
    const doc = await lessonFive({ 3: { published: true } })

    // Assert
    const chip = doc.querySelector('a.chip-link[href="/learn/03"]')
    expect(words(chip)).toBe('After Lesson 3: Match a note')
    expect(doc.querySelectorAll('#extra a')).toHaveLength(2)
    expect(doc.querySelector('#other a')?.getAttribute('href')).toBe(
      '/learn/03#step-2',
    )
  })

  it('lose their link to a lesson that is not: a chip stays a plain chip, a nav link goes, other words stay', async () => {
    // Act: Lesson 3 held back, as production holds drafts
    const doc = await lessonFive({})

    // Assert
    expect(doc.querySelector('a[href^="/learn/03"]')).toBeNull()
    const chips = Array.from(doc.querySelectorAll('.meta .chip')).map(words)
    expect(chips).toContain('After Lesson 3: Match a note')
    const plain = Array.from(doc.querySelectorAll('.meta span.chip')).find(
      (el) => words(el) === 'After Lesson 3: Match a note',
    )
    expect(plain?.classList.contains('chip-link')).toBe(false)
    expect(plain?.hasAttribute('href')).toBe(false)
    expect(doc.querySelector('a.chip-link[href="/learn/02"]')).not.toBeNull()
    expect(Array.from(doc.querySelectorAll('#extra a')).map(words)).toEqual([
      'Two',
    ])
    expect(words(doc.getElementById('other'))).toBe('step two of Lesson 3')
  })

  it("say what is true of each lesson they name, the build's hidden mark going with the other", async () => {
    // Act: Lesson 2 held back, Lesson 3 published
    const doc = await lessonFive({
      2: { published: false },
      3: { published: true },
    })

    // Assert
    const readings = doc.getElementById('readings')
    expect(words(readings)).toBe(
      'Lesson 2 is coming later; Lesson 3 is ready; odd.',
    )
    expect(
      readings?.querySelectorAll('[data-if-live="2"], [data-if-planned="3"]'),
    ).toHaveLength(0)
    expect(readings?.querySelector('[hidden]')).toBeNull()
    // A reading with no lesson number is left as it was written
    expect(readings?.querySelector('[data-if-live="x"]')).not.toBeNull()
  })
})

describe('the sitemap and llms.txt', () => {
  const sitemap = repoFile('public/sitemap.xml')
  const llms = repoFile('public/llms.txt')
  const asPage = (
    lessons: LessonState['lessons'],
    drafts = false,
    updatedAt: string | null = '2026-10-20T09:30:00.000Z',
  ): PageState => ({
    ...stateOf(lessons, updatedAt),
    drafts,
  })

  it('are left as they are where the state changes nothing', () => {
    expect(editSitemap(sitemap, asPage({}))).toBe(sitemap)
    expect(editLlms(llms, asPage({}))).toBe(llms)
  })

  it("list a published draft in lesson order, in each file's own form", () => {
    // Act: two drafts published, the later one named first
    const state = asPage({
      4: { published: true },
      3: { published: true, hook: 'figures' },
    })
    const xml = editSitemap(sitemap, state)
    const text = editLlms(llms, state)

    // Assert: the sitemap entries after Lesson 2 and in order, with the day of the change
    expect(xml).toContain(
      '  <url>\n    <loc>https://mercurypitch.com/learn/03</loc>\n    <lastmod>2026-10-20</lastmod>\n  </url>\n',
    )
    const locs = [...xml.matchAll(/<loc>[^<]*\/learn\/(\d{2})<\/loc>/g)].map(
      (m) => m[1],
    )
    expect(locs).toEqual(['01', '02', '03', '04'])
    expect(
      xml.replace(
        / {2}<url>\n {4}<loc>https:\/\/mercurypitch\.com\/learn\/0[34]<\/loc>\n[^]*?<\/url>\n/g,
        '',
      ),
    ).toBe(sitemap)

    // llms.txt: its title, then the hook the console picked, wrapped as the rest are
    const items = [...text.matchAll(/^- \[Lesson (\d+): [^\]]+\]/gm)].map(
      (m) => m[1],
    )
    expect(items).toEqual(['1', '2', '3', '4'])
    const item =
      /^- \[Lesson 3: Match a note\]\(https:\/\/mercurypitch\.com\/learn\/03\): [^]*?(?=\n- )/m.exec(
        text,
      )?.[0] ?? ''
    expect(item.replace(/\n {2}/g, ' ')).toBe(
      `- [Lesson 3: Match a note](https://mercurypitch.com/learn/03): ${LESSON_COPY[3]?.hookAlts?.[0]?.text}`,
    )
    for (const line of item.split('\n'))
      expect(line.length, line).toBeLessThanOrEqual(80)
  })

  it('take out a released lesson held back', () => {
    // Act
    const state = asPage({ 2: { published: false } })
    const xml = editSitemap(sitemap, state)
    const text = editLlms(llms, state)

    // Assert
    expect(xml).not.toContain('/learn/02')
    expect(xml).toContain('/learn/01')
    expect(xml.split('\n').length).toBe(sitemap.split('\n').length - 4)
    expect(text).not.toContain('/learn/02')
    expect(text).not.toContain('Where the other\n  five notes')
    expect(text).toContain('/learn/01')
  })

  it('write no lastmod for a draft the environment shows when no override has ever changed', () => {
    // Act
    const xml = editSitemap(sitemap, asPage({}, true, null))

    // Assert
    expect(xml).toContain(
      '  <url>\n    <loc>https://mercurypitch.com/learn/03</loc>\n  </url>\n',
    )
    expect(xml).toContain('<loc>https://mercurypitch.com/learn/05</loc>')
  })

  it('answer through the worker with no validators, and a HEAD with no body', async () => {
    // Arrange
    const { ask } = gate({ state: stateOf({ 2: { published: false } }) })

    // Act
    const xml = await ask('/sitemap.xml', {
      headers: { 'If-None-Match': ETAG },
    })
    const text = await ask('/llms.txt')
    const head = await ask('/llms.txt', { method: 'HEAD' })

    // Assert
    expect(xml?.status).toBe(200)
    expect(xml?.headers.get('ETag')).toBeNull()
    expect(xml?.headers.get('Content-Type')).toBe('application/xml')
    expect(await xml?.text()).not.toContain('/learn/02')
    expect(await text?.text()).not.toContain('/learn/02')
    expect(head?.status).toBe(200)
    expect(await head?.text()).toBe('')
  })

  it('wrap an item at its width, later lines indented two spaces and no word broken', () => {
    expect(wrapItem(['- [L](u):', 'one', 'two', 'three', 'four'], 16)).toBe(
      '- [L](u): one\n  two three four\n',
    )
    expect(wrapItem(['- x', 'y'.repeat(30)], 10)).toBe(
      `- x\n  ${'y'.repeat(30)}\n`,
    )
    expect(wrapItem(['- [L](u):', 'short'])).toBe('- [L](u): short\n')
  })
})

describe('reading the state', () => {
  it("asks the db-worker once, then answers from the data centre's copy for thirty seconds", async () => {
    // Arrange
    const state = stateOf({ 3: { published: true } })
    const { ask, api, cache } = gate({ drafts: '0', state })

    // Act
    const first = await ask('/learn/03')
    const second = await ask('/learn/03')

    // Assert
    expect([first?.status, second?.status]).toEqual([200, 200])
    expect(api).toHaveBeenCalledOnce()
    expect(api.mock.calls[0][0]).toBe(`${API}/api/lessons/state`)
    expect(cache?.match).toHaveBeenCalledTimes(2)
    const [entry] = [...(cache?.entries.values() ?? [])]
    expect(entry.cacheControl).toBe(`max-age=${STATE_TTL_S}`)
    expect(JSON.parse(entry.body)).toEqual(state)
  })

  it('serves a cached state without asking the db-worker', async () => {
    // Arrange: the cache holds Lesson 2 held back; the db-worker would say otherwise
    const cache = memoryCache()
    const { ask, api } = gate({ cache, state: stateOf({}) })
    const key = new URL('/__lesson-state/v1', SITE)
    key.searchParams.set('api', API)
    cache.entries.set(key.toString(), {
      body: JSON.stringify(stateOf({ 2: { published: false } })),
      cacheControl: 'max-age=30',
    })

    // Act
    const response = await ask('/learn/02')

    // Assert
    expect(response?.status).toBe(404)
    expect(api).not.toHaveBeenCalled()
  })

  it('keeps the last good state in KV, written only when it changes', async () => {
    // Arrange
    const state = stateOf({ 3: { published: true } })
    const kv = memoryKv()
    const first = gate({ kv, state })
    await first.ask('/learn/03')

    // Act: a second data centre reads the same state
    const second = gate({ kv, state })
    await second.ask('/learn/03')

    // Assert
    expect(kv.put).toHaveBeenCalledOnce()
    expect(kv.put.mock.calls[0][0]).toBe(`lesson-state:last-good:${API}`)
    expect(JSON.parse(kv.put.mock.calls[0][1])).toEqual(state)
  })

  it('falls back to the KV copy when the db-worker fails, and keeps that for ten seconds', async () => {
    for (const failure of [
      async () => new Response('busy', { status: 503 }),
      async () => {
        throw new TypeError('network down')
      },
    ]) {
      // Arrange: the last good copy holds Lesson 3 published
      const kv = memoryKv({
        [`lesson-state:last-good:${API}`]: JSON.stringify(
          stateOf({ 3: { published: true } }),
        ),
      })
      const { ask, cache } = gate({ kv, drafts: '0', state: failure })

      // Act
      const response = await ask('/learn/03')

      // Assert
      expect(response?.status).toBe(200)
      const [entry] = [...(cache?.entries.values() ?? [])]
      expect(entry.cacheControl).toBe(`max-age=${FALLBACK_TTL_S}`)
      expect(kv.put).not.toHaveBeenCalled()
    }
  })

  it('reads a body it cannot use as a failure: not JSON, or a version it does not know', async () => {
    for (const body of [
      '<html>oops</html>',
      '{"version":2,"lessons":{"3":{"published":true}}}',
    ]) {
      // Arrange: no KV copy either, so the state is empty
      const { ask } = gate({ drafts: '0', state: body })

      // Act + Assert: Lesson 3 is a draft, held back by default
      expect((await ask('/learn/03'))?.status, body).toBe(404)
      expect((await ask('/learn/02'))?.status, body).toBe(200)
    }
  })

  it('gives up on the db-worker after its timeout and serves the site as built', async () => {
    // Arrange: a db-worker that answers nothing until the timeout's signal fires
    const timeout = new AbortController()
    const after = vi
      .spyOn(AbortSignal, 'timeout')
      .mockReturnValue(timeout.signal)
    const hanging = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(init.signal?.reason),
          )
        }),
    )
    const { ask } = gate({ drafts: '0' })
    vi.stubGlobal('fetch', hanging)

    // Act: the time runs out while the page waits
    const answered = ask('/learn/03')
    await vi.waitFor(() => expect(hanging).toHaveBeenCalledOnce())
    timeout.abort(new DOMException('timed out', 'TimeoutError'))
    const response = await answered

    // Assert: no state, so the draft is held back as built
    expect(after).toHaveBeenCalledWith(STATE_TIMEOUT_MS)
    expect(response?.status).toBe(404)
  })

  it('works with no Cache API, no KV and no db-worker, as a bare local run has', async () => {
    // Arrange
    const { ask, api } = gate({
      cache: null,
      kv: null,
      dbApiUrl: '',
      drafts: '1',
    })

    // Act + Assert
    expect((await ask('/learn/03'))?.status).toBe(200)
    expect(api).not.toHaveBeenCalled()
  })
})

describe('the wrangler config', () => {
  interface Wrangler {
    vars?: Record<string, string>
    assets: { run_worker_first: string[] }
    env: Record<string, { vars?: Record<string, string> }>
  }
  // JSONC: strings kept whole, comments and trailing commas dropped.
  const config = JSON.parse(
    repoFile('wrangler.jsonc')
      .replace(
        /("(?:[^"\\]|\\.)*")|\/\/[^\n]*/g,
        (_all, text?: string) => text ?? '',
      )
      .replace(/,(\s*[}\]])/g, '$1'),
  ) as Wrangler

  it('runs the worker first for every lesson page, the sitemap and llms.txt', () => {
    expect(config.assets.run_worker_first).toEqual(
      expect.arrayContaining(['/learn/*', '/sitemap.xml', '/llms.txt']),
    )
  })

  it("sets each environment's default for drafts: held back on mercurypitch.com, shown on dev, previews and a local run", () => {
    // Act
    const defaults = {
      local: config.vars?.LESSON_DRAFTS,
      prod: config.env.prod?.vars?.LESSON_DRAFTS,
      dev: config.env.dev?.vars?.LESSON_DRAFTS,
      preview: config.env.preview?.vars?.LESSON_DRAFTS,
    }

    // Assert
    expect(defaults).toEqual({ local: '1', prod: '0', dev: '1', preview: '1' })
    expect(Object.keys(config.env).sort()).toEqual(['dev', 'preview', 'prod'])
  })
})
