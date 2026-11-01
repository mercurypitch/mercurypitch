import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { DRAFT_LESSONS } from '@/features/lessons/kit/drafts'
import { FILMS, filmSources, filmState } from '@/features/lessons/kit/films'
import { LESSONS } from '@/features/lessons/kit/season'
import { hasWatchPage, WATCH_PAGES, watchDocument, watchLessons, watchOfHref, watchPath, } from '@/features/lessons/kit/watch-pages'
import { lessonDocument, lessonPages, watchPages, } from '../../tools/draft-lessons'
import { hubLessons } from '../../tools/learn-hub'

// A lesson film's watch page (kit/watch-pages.ts) exists so Search can list
// the film as a video, which it does only where the video is the page's main
// content. Like a lesson page it is written by hand, so these hold it to
// what that needs: a self-canonical head, one h1, a real video first on the
// page that a crawler finds without pressing anything, a VideoObject whose
// every value is the film's own, and a way to the lesson and back. They
// also hold the film's other doors to it: the lesson's hero, the hub, the
// sitemap, llms.txt and the service worker.

const repo = resolve(__dirname, '../..')
const repoFile = (path: string) => readFileSync(resolve(repo, path), 'utf8')
const parse = (file: string) =>
  new DOMParser().parseFromString(repoFile(file), 'text/html')
const pad = (n: number) => String(n).padStart(2, '0')
const SITE = 'https://mercurypitch.com'

const meta = (doc: Document, key: string): string | null =>
  doc
    .querySelector(`meta[name="${key}"], meta[property="${key}"]`)
    ?.getAttribute('content') ?? null

function jsonLd(doc: Document): Record<string, unknown>[] {
  return Array.from(
    doc.querySelectorAll('script[type="application/ld+json"]'),
  ).map((node) => JSON.parse(node.textContent ?? '{}'))
}

const words = (el: Element | null): string =>
  (el?.textContent ?? '').replace(/\s+/g, ' ').trim()

/** An ISO 8601 duration such as PT5M36S, in seconds; NaN for anything else. */
function seconds(duration: string): number {
  const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(duration)
  if (m === null || duration === 'PT') return Number.NaN
  return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0)
}

/** "5:35", as season.ts writes a film's length, in seconds. */
const clockSeconds = (len: string): number => {
  const [min, sec] = len.split(':').map(Number)
  return min * 60 + sec
}

const WATCHED = watchLessons()

describe('the watch pages', () => {
  it('are the published films: every film with sources has one, and only those', () => {
    const published = Object.keys(FILMS)
      .map(Number)
      .filter((n) => filmState(n) === 'published')
    expect(WATCHED).toEqual(published)
    expect(WATCHED).toEqual(expect.arrayContaining([1, 2]))
    // a film with no sources has nothing to watch, so no watch page
    expect(hasWatchPage(1, WATCH_PAGES, { 1: null })).toBe(false)
    expect(hasWatchPage(3, { 3: WATCH_PAGES[1]! }, FILMS)).toBe(false)
  })

  it('each have their document, learn/NN/watch.html, beside a lesson document', () => {
    expect(watchPages(repo)).toEqual(WATCHED)
    for (const n of WATCHED)
      expect(lessonPages(repo), `Lesson ${n}`).toContain(n)
  })

  it('read a watch link in every spelling a page writes, and nothing else', () => {
    expect(watchOfHref('/learn/01/watch')).toBe(1)
    expect(watchOfHref('/learn/02/watch.html')).toBe(2)
    expect(watchOfHref('/learn/02/watch/')).toBe(2)
    expect(watchOfHref('/learn/02/watch#chapters')).toBe(2)
    expect(watchOfHref('/learn/02')).toBeNull()
    expect(watchOfHref('/learn/02/watching')).toBeNull()
    expect(watchPath(7)).toBe('/learn/07/watch')
    expect(watchDocument(7)).toBe('learn/07/watch.html')
  })
})

describe.each(WATCHED)('watch page %i', (n) => {
  const file = watchDocument(n)
  const url = `${SITE}${watchPath(n)}`
  const lesson = LESSONS.find((L) => L.n === n)!
  const film = filmSources(n)!
  const facts = WATCH_PAGES[n]!
  const doc = parse(file)
  const lessonDoc = parse(lessonDocument(n))

  it('has a self-canonical, indexable head that allows video previews', () => {
    expect(
      doc.querySelector('link[rel="canonical"]')?.getAttribute('href'),
    ).toBe(url)
    expect(meta(doc, 'og:url')).toBe(url)
    const robots = meta(doc, 'robots') ?? ''
    expect(robots).toContain('index, follow')
    expect(robots).not.toContain('noindex')
    expect(robots).toContain('max-video-preview:-1')
    // its own title and description, not the lesson's
    expect(doc.title).not.toBe(lessonDoc.title)
    expect(doc.title).toContain(lesson.title)
    expect(meta(doc, 'description')).not.toBe(meta(lessonDoc, 'description'))
  })

  it('has one h1, the lesson title', () => {
    const h1s = doc.querySelectorAll('h1')
    expect(h1s).toHaveLength(1)
    expect(words(h1s[0])).toBe(lesson.title)
  })

  it('plays the film in its markup: a video with a poster, controls and sources, first in the page', () => {
    const video = doc.querySelector('main video#ep')
    expect(video).not.toBeNull()
    expect(video?.hasAttribute('controls')).toBe(true)
    expect(video?.getAttribute('preload')).toBe('metadata')
    expect(video?.getAttribute('poster')).toMatch(/poster\.jpg$/)
    const sources = Array.from(video?.querySelectorAll('source') ?? [])
    // the 1080p MP4 first, the one the structured data names
    expect(sources.map((s) => s.getAttribute('src'))).toEqual([
      film.hd,
      film.sd,
    ])
    for (const s of sources) expect(s.getAttribute('type')).toBe('video/mp4')
    const track = video?.querySelector('track[kind="captions"]')
    expect(track?.hasAttribute('default')).toBe(true)
    // nothing on the page comes before it but its own heading
    const main = doc.querySelector('main')!
    const after = (a: Element, b: Element) =>
      (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
    for (const el of Array.from(
      main.querySelectorAll('p, img, a, section section, details, ul'),
    )) {
      if (el.closest('.watch-head') !== null || video!.contains(el)) continue
      expect(after(video!, el), el.outerHTML.slice(0, 60)).toBe(true)
    }
  })

  it("describes the film in a VideoObject, every value the film's own", () => {
    const videos = jsonLd(doc).filter((node) => node['@type'] === 'VideoObject')
    expect(videos).toHaveLength(1)
    const video = videos[0]
    expect(video['@context']).toBe('https://schema.org')
    expect(video.url).toBe(url)
    expect(video.name).toBe(meta(doc, 'og:title'))
    expect(video.description).toBe(meta(doc, 'description'))
    expect(String(video.description).length).toBeGreaterThan(50)
    // the thumbnail is the lesson's share card, in public/, absolute
    const og = meta(lessonDoc, 'og:image') ?? ''
    expect(video.thumbnailUrl).toEqual([og])
    expect(meta(doc, 'og:image')).toBe(og)
    expect(
      existsSync(resolve(repo, 'public', og.slice(`${SITE}/`.length))),
    ).toBe(true)
    // when it went live, with its offset; how long it runs, measured
    expect(video.uploadDate).toBe(facts.uploadDate)
    expect(String(video.uploadDate)).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2})$/,
    )
    expect(video.duration).toBe(facts.duration)
    const length = seconds(facts.duration)
    expect(length).toBeGreaterThan(30)
    // within a second of the length the team wrote down (season.ts `len`)
    expect(
      Math.abs(length - clockSeconds(lesson.len ?? '0:00')),
    ).toBeLessThanOrEqual(1)
    // the page prints the same running time
    expect(words(doc.querySelector('.watch-meta .dur'))).toBe(
      `${Math.floor(length / 60)}:${String(length % 60).padStart(2, '0')}`,
    )
    // the file the video plays, and no player page, so no embedUrl
    expect(video.contentUrl).toBe(film.hd)
    expect(video.embedUrl).toBeUndefined()
    expect((video.isPartOf as { '@id'?: string })['@id']).toBe(
      `${SITE}/learn/#series`,
    )
  })

  it("is not described as a video on its lesson's page, where the film is supplementary", () => {
    expect(
      jsonLd(lessonDoc).some((node) => node['@type'] === 'VideoObject'),
    ).toBe(false)
  })

  it('gives search a trail through its lesson', () => {
    const trail = jsonLd(doc).find((node) => node['@type'] === 'BreadcrumbList')
    const items = (trail?.itemListElement ?? []) as {
      name: string
      item?: string
    }[]
    expect(items.map((i) => i.item)).toEqual([
      `${SITE}/`,
      `${SITE}/learn/`,
      `${SITE}/learn/${pad(n)}`,
      undefined,
    ])
    expect(items[2].name).toBe(lesson.title)
  })

  it('leads back to its lesson, and the lesson to it', () => {
    const back = Array.from(doc.querySelectorAll(`a[href="/learn/${pad(n)}"]`))
    expect(back.map(words)).toContain('Take the lesson')
    expect(doc.querySelector('a[href="/learn/"]')).not.toBeNull()
    // the lesson's hero offers it under its chips, with the film's length
    const hero = lessonDoc.querySelector(
      `.hero .hero-film a[href="${watchPath(n)}"]`,
    )
    expect(words(hero)).toBe(`Watch the film${lesson.len}`)
    expect(hero?.querySelector('use')?.getAttribute('href')).toBe('#i-play')
    expect(hero?.querySelector('small.dur')?.textContent).toBe(lesson.len)
  })

  it('closes on the legal links', () => {
    const hrefs = Array.from(
      doc.querySelectorAll('nav[aria-label="Legal"] a'),
    ).map((a) => a.getAttribute('href'))
    expect(hrefs).toEqual([
      'https://about.mercurypitch.com/privacy/',
      'https://about.mercurypitch.com/terms/',
      'https://about.mercurypitch.com/imprint/',
    ])
  })

  it('writes its copy without an em dash', () => {
    expect(doc.body.textContent ?? '').not.toContain('—')
    expect(meta(doc, 'description') ?? '').not.toContain('—')
  })

  it('is listed in the sitemap and llms.txt, and left to the network by the service worker', () => {
    expect(repoFile('public/sitemap.xml')).toContain(`<loc>${url}</loc>`)
    expect(repoFile('public/llms.txt')).toContain(`](${url}):`)
    const sw = repoFile('src/lib/sw-runtime.ts')
    expect(sw).toContain(`'${watchPath(n)}'`)
    expect(sw).toContain(`'${watchPath(n)}.html'`)
  })

  it('is linked from the hub, beside its lesson', () => {
    expect(hubLessons(repo).find((L) => L.n === n)?.watch).toBe(watchPath(n))
  })
})

describe('a lesson with no watch page', () => {
  const without = lessonPages(repo).filter((n) => !WATCHED.includes(n))

  it('links none', () => {
    expect(without.length).toBeGreaterThan(0)
    for (const n of without) {
      const doc = parse(lessonDocument(n))
      expect(
        Array.from(doc.querySelectorAll('a[href]')).filter(
          (a) => watchOfHref(a.getAttribute('href') ?? '') !== null,
        ),
        `Lesson ${n}`,
      ).toHaveLength(0)
      expect(hubLessons(repo).find((L) => L.n === n)?.watch).toBeUndefined()
    }
  })

  it('and no draft, is in neither the sitemap nor llms.txt as a film', () => {
    const listings = [
      repoFile('public/sitemap.xml'),
      repoFile('public/llms.txt'),
    ]
    const drafts = Object.keys(DRAFT_LESSONS).map(Number)
    for (const n of [...without, ...drafts])
      for (const listing of listings)
        expect(listing, `Lesson ${n}`).not.toContain(`/learn/${pad(n)}/watch`)
  })
})
