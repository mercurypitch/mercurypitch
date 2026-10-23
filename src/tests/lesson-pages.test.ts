import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PREREQ } from '@/features/lessons/kit/season'
import { ENTRY_PAGES } from '@/seo/entry-pages'
import { draftLessons, lessonDocument, lessonPath, releasedLessons, } from '../../tools/draft-lessons'
import { lessonHeadline, releasedLessonLinks } from '../../tools/lesson-links'

// A Find Your Pitch lesson is written by hand, so nothing generates its head
// or puts it in front of a crawler. These hold it to what a page needs to be
// found, in two parts.
//
// The document's own part holds every lesson document, a draft's included: a
// self-canonical head, a share card that is in public/, structured data that
// says what it is, and the legal links. The admin console publishes a draft
// on mercurypitch.com at run time, with no release (src/lesson-gate.ts), so
// a draft goes live with the head it was built with: that head has to be
// finished before the console can publish it, not at the release after.
//
// The release's part waits for the release, which deletes the lesson's line
// from drafts.ts: the sitemap, llms.txt, the service worker, and links from
// the documents a crawler reaches first. Lesson 1 shipped without the links,
// the structured data or the image directive; the lessons after it cannot.

const repo = resolve(__dirname, '../..')
const repoFile = (path: string) => readFileSync(resolve(repo, path), 'utf8')
const parse = (file: string) =>
  new DOMParser().parseFromString(repoFile(file), 'text/html')

const meta = (document: Document, key: string): string | null =>
  document
    .querySelector(`meta[name="${key}"], meta[property="${key}"]`)
    ?.getAttribute('content') ?? null

function jsonLd(document: Document): Record<string, unknown>[] {
  return Array.from(
    document.querySelectorAll('script[type="application/ld+json"]'),
  ).map((node) => JSON.parse(node.textContent ?? '{}'))
}

/** A baseline or progressive JPEG's pixel size, from its frame header. */
function jpegSize(bytes: Buffer): { width: number; height: number } {
  let at = 2
  while (at + 8 < bytes.length) {
    const marker = bytes[at + 1]
    const frame =
      marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)
    if (frame)
      return {
        height: bytes.readUInt16BE(at + 5),
        width: bytes.readUInt16BE(at + 7),
      }
    at += 2 + bytes.readUInt16BE(at + 2)
  }
  throw new Error('no JPEG frame header')
}

const ORGANIZATION = {
  '@type': 'Organization',
  '@id': 'https://mercurypitch.com/#organization',
  name: 'MercuryPitch',
  url: 'https://mercurypitch.com/',
}

// Released: every learn/NN.html the draft list does not hold back.
const RELEASED = releasedLessons(repo)
// Every lesson document, released or a draft: any of them can be live.
const DOCUMENTS = [...RELEASED, ...draftLessons()].sort((a, b) => a - b)

describe('the released lessons', () => {
  it('starts with Lesson 1, which every hand-written nav links', () => {
    expect(RELEASED[0]).toBe(1)
  })

  it('links each one by its own headline, and never a draft', () => {
    const links = releasedLessonLinks(repo)
    expect(links.map((link) => link.href)).toEqual(RELEASED.map(lessonPath))
    for (const n of RELEASED) {
      const headline = lessonHeadline(repoFile(lessonDocument(n)))
      expect(headline, `Lesson ${n} has no Article headline`).toBeDefined()
      expect(links).toContainEqual({
        href: lessonPath(n),
        label: `${headline} (Lesson ${n})`,
      })
    }
    // A lesson still on the draft list is not linked, even though its
    // document is in the repository.
    expect(
      releasedLessonLinks(repo, { 2: 'test draft' }).map((link) => link.href),
    ).not.toContain('/learn/02')
  })

  it('reads a headline only from an Article node', () => {
    const doc = (node: unknown) =>
      `<script type="application/ld+json">${JSON.stringify(node)}</script>`
    expect(lessonHeadline(doc({ '@type': 'Article', headline: 'Hi' }))).toBe(
      'Hi',
    )
    expect(lessonHeadline(doc({ '@type': 'WebPage', headline: 'No' }))).toBe(
      undefined,
    )
    expect(
      lessonHeadline(
        `<script type="application/ld+json">{ not json</script>${doc({
          '@type': 'Article',
          headline: 'Still found',
        })}`,
      ),
    ).toBe('Still found')
  })
})

describe.each(DOCUMENTS)('lesson document %i', (n) => {
  const file = lessonDocument(n)
  const canonical = `https://mercurypitch.com${lessonPath(n)}`

  it('has a self-canonical, indexable head', () => {
    const document = parse(file)

    expect(
      document.querySelector('link[rel="canonical"]')?.getAttribute('href'),
    ).toBe(canonical)
    expect(meta(document, 'og:url')).toBe(canonical)
    // Discover uses a large image only when the page allows one.
    expect(meta(document, 'robots')).toBe(
      'index, follow, max-image-preview:large',
    )
    expect(document.title).toContain('MercuryPitch')
    expect(document.title.length).toBeLessThanOrEqual(60)
    // Google cuts a description near 160 characters; the tail is lost.
    const description = meta(document, 'description') ?? ''
    expect(description.length).toBeGreaterThan(80)
    expect(description.length).toBeLessThanOrEqual(160)
    expect(meta(document, 'twitter:card')).toBe('summary_large_image')
  })

  it('describes itself as a free lesson in the series', () => {
    const document = parse(file)
    const blocks = jsonLd(document)
    const article = blocks.find((node) => node['@type'] === 'Article')

    expect(article, 'no Article node').toBeDefined()
    // First of the blocks: kit/lesson-copy.test.ts reads the hook's copy in
    // alternativeHeadline from the first one only.
    expect(blocks[0]?.['@type']).toBe('Article')
    if (article === undefined) return
    expect(article.url).toBe(canonical)
    expect(article['@id']).toBe(`${canonical}#lesson`)
    expect(article.learningResourceType).toBe('Lesson')
    expect(article.isAccessibleForFree).toBe(true)
    expect(article.position).toBe(n)
    expect(article.isPartOf).toEqual({
      '@type': 'CreativeWorkSeries',
      name: 'Find Your Pitch',
    })
    expect(article.author).toEqual(ORGANIZATION)
    expect(article.publisher).toEqual(ORGANIZATION)
    // Repeats the page, never a second version of it.
    expect(article.description).toBe(meta(document, 'description'))
    expect(article.image).toBe(meta(document, 'og:image'))
    expect(document.title).toContain(String(article.headline))
  })

  it('gives search a trail back to the home page', () => {
    const document = parse(file)
    const trail = jsonLd(document).find(
      (node) => node['@type'] === 'BreadcrumbList',
    )
    const items = (trail?.itemListElement ?? []) as Record<string, unknown>[]
    const article = jsonLd(document).find((node) => node['@type'] === 'Article')

    expect(items.length).toBeGreaterThanOrEqual(2)
    expect(items[0]?.item).toBe('https://mercurypitch.com/')
    expect(items.at(-1)?.name).toBe(article?.headline)
    items.forEach((item, index) => expect(item.position).toBe(index + 1))
  })

  // The picture a share or Discover shows with the page (SEARCH.md § 3.1):
  // this lesson's own card, a file in public/ at the size the head gives.
  it('names a share card that is in public/, at the size its head gives', () => {
    const document = parse(file)
    const card = `learn/lesson-${String(n).padStart(2, '0')}-og.jpg`
    const image = resolve(repo, 'public', card)

    expect(meta(document, 'og:image')).toBe(`https://mercurypitch.com/${card}`)
    expect(meta(document, 'twitter:image')).toBe(meta(document, 'og:image'))
    expect(existsSync(image), `public/${card} is missing`).toBe(true)
    const size = jpegSize(readFileSync(image))
    expect([
      meta(document, 'og:image:width'),
      meta(document, 'og:image:height'),
    ]).toEqual([String(size.width), String(size.height)])
    expect(meta(document, 'og:image:alt')?.trim()).toBeTruthy()
    expect(meta(document, 'twitter:image:alt')).toBe(
      meta(document, 'og:image:alt'),
    )
  })

  // The header's "After Lesson N" chips are written by hand, and the season's
  // edges are what the menu and the map read: a page whose chips name other
  // lessons than PREREQ tells a learner a different way in.
  it('names the lessons it comes after, as the season does', () => {
    const chips = Array.from(
      parse(file).querySelectorAll('ul.meta a.chip-link'),
    ).map((a) => ({
      after: Number(/After Lesson (\d+)/.exec(a.textContent ?? '')?.[1]),
      href: a.getAttribute('href'),
    }))
    expect(chips).toEqual(
      (PREREQ[n] ?? []).map((k) => ({ after: k, href: lessonPath(k) })),
    )
  })

  // The imprint has to be easily, directly and permanently accessible from
  // every document a visitor can land on (launch-entry-seo's legal nav rule).
  it('closes on the legal links', () => {
    const hrefs = Array.from(
      parse(file).querySelectorAll('nav[aria-label="Legal"] a'),
    ).map((a) => a.getAttribute('href'))
    expect(hrefs).toEqual([
      'https://about.mercurypitch.com/privacy/',
      'https://about.mercurypitch.com/terms/',
      'https://about.mercurypitch.com/imprint/',
    ])
  })
})

// What only a release brings: a draft has none of it (below).
describe.each(RELEASED)('released lesson %i', (n) => {
  const path = lessonPath(n)
  const canonical = `https://mercurypitch.com${path}`

  // drafts.ts asks for the sitemap and llms.txt by hand on release; this is
  // what notices when they were forgotten.
  it('is in the sitemap, llms.txt and the service worker', () => {
    expect(repoFile('public/sitemap.xml')).toContain(`<loc>${canonical}</loc>`)
    expect(repoFile('public/llms.txt')).toContain(`(${canonical})`)
    const serviceWorker = repoFile('src/lib/sw-runtime.ts')
    expect(serviceWorker).toContain(`'${path}'`)
    expect(serviceWorker).toContain(`'${path}.html'`)
  })

  // A crawler starts at the entry documents; a page none of them links is
  // found late, from the sitemap alone. The generated ones link every
  // released lesson (tools/lesson-links.ts); setup-entry-pages.ts wrote them.
  it('is linked from every generated entry document', () => {
    for (const page of ENTRY_PAGES) {
      const hrefs = Array.from(
        parse(`${page.slug}.html`).querySelectorAll(
          'nav[aria-label="More from MercuryPitch"] a',
        ),
      ).map((a) => a.getAttribute('href'))
      expect(hrefs, `${page.slug}.html does not link ${path}`).toContain(path)
    }
  })
})

// A draft (a lesson with a line in drafts.ts) is the other half. Its document
// is held above with the released lessons', since a draft the console
// publishes is live with the head it was built with. What it is held to here
// is what scripts/assert-draft-lessons.mjs checks in a finished build: listed
// in no static file and linked from no crawlable document, whichever way an
// environment shows it (the site worker adds it to the sitemap and llms.txt
// only while it is published, src/lesson-gate.ts), with its service-worker
// rule kept so that where it is held back its address reaches the worker's
// 404 page, never the app shell. These are the same rules on the repository,
// so the two cannot disagree.
describe.each(draftLessons())('draft lesson %i', (n) => {
  const path = lessonPath(n)
  // `/learn/05`, but not `/learn/050`
  const mention = new RegExp(`${path}(?!\\d)`)

  it('is in neither the sitemap nor llms.txt until it is released', () => {
    expect(repoFile('public/sitemap.xml')).not.toMatch(mention)
    expect(repoFile('public/llms.txt')).not.toMatch(mention)
  })

  it('is linked from no entry document, generated or hand-written', () => {
    expect(releasedLessonLinks(repo).map((link) => link.href)).not.toContain(
      path,
    )
    for (const file of [
      'index.html',
      '404.html',
      ...ENTRY_PAGES.map((page) => `${page.slug}.html`),
    ])
      expect(repoFile(file), `${file} links ${path}`).not.toMatch(mention)
  })

  it('keeps its service-worker rule, for an environment that holds it back', () => {
    const serviceWorker = repoFile('src/lib/sw-runtime.ts')
    expect(serviceWorker).toContain(`'${path}'`)
    expect(serviceWorker).toContain(`'${path}.html'`)
  })
})

// index.html links the series' first lesson by hand, which never changes:
// each lesson links the next, so a release needs no edit there. The 404 page
// is generated (src/error-kit/) and links every released lesson.
describe('the documents outside the entry model', () => {
  it.each(['index.html', '404.html'])('%s links Lesson 1', (file) => {
    const hrefs = Array.from(
      parse(file).querySelectorAll(
        'nav[aria-label="More from MercuryPitch"] a',
      ),
    ).map((a) => a.getAttribute('href'))
    expect(hrefs).toContain('/learn/01')
  })
})
