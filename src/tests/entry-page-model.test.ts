import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { StoreListings } from '@/lib/store-listings'
import { STORE_LISTINGS } from '@/lib/store-listings'
import { canonicalPath, ENTRY_PAGES, nativeAppsAnswer, navLinksFor, } from '@/seo/entry-pages'
import { renderEntryPage } from '@/seo/render-entry-page'
import { releasedLessonLinks } from '../../tools/lesson-links'

// The entry documents are generated from ENTRY_PAGES, so the thing worth
// guarding is the model and what the renderer makes of it. These are the
// invariants that used to be maintained by hand across eleven files, which is
// exactly why they drifted: a room would gain a page and stay missing from the
// sitemap, or from the service worker, or from the other pages' cross-links.

const repoFile = (path: string) =>
  readFileSync(`${process.cwd()}/${path}`, 'utf8')

describe('entry page model', () => {
  it('has a unique slug and unique paths for every entry', () => {
    const slugs = ENTRY_PAGES.map((page) => page.slug)
    expect(new Set(slugs).size).toBe(slugs.length)

    const paths = ENTRY_PAGES.flatMap((page) => [...page.paths])
    expect(new Set(paths).size).toBe(paths.length)
    for (const path of paths) expect(path).toMatch(/^\/[a-z0-9-]+$/)
  })

  it('carries the search-intent pages the rooms had no document for', () => {
    for (const slug of [
      'pitch-training',
      'voice-type-test',
      'vocal-remover',
      'which-singer-has-my-vocal-range',
      'karaoke-app',
    ]) {
      const page = ENTRY_PAGES.find((entry) => entry.slug === slug)
      expect(page, `${slug} is missing from the model`).toBeTruthy()
      // A front door onto an existing room, never a new bundle.
      expect([
        '/src/index.tsx',
        '/src/features/mirror/main.tsx',
        '/src/features/karaoke-night/main.tsx',
      ]).toContain(page!.boot)
    }
  })

  it('cross-links every other entry, and never itself', () => {
    for (const page of ENTRY_PAGES) {
      const hrefs = navLinksFor(page).map((link) => link.href)
      expect(hrefs).not.toContain(canonicalPath(page))
      for (const other of ENTRY_PAGES) {
        if (other.slug === page.slug) continue
        expect(hrefs).toContain(canonicalPath(other))
      }
    }
  })

  it('writes a title and description an engine will actually show', () => {
    for (const page of ENTRY_PAGES) {
      expect(page.title, page.slug).toContain('MercuryPitch')
      // Google truncates a title near 60 characters and a description near
      // 160. Over that is not an error, it is words nobody reads.
      expect(page.title.length, `${page.slug} title`).toBeLessThanOrEqual(60)
      // Decision D5 (SEO audit, 12 Oct 2026): a colon, never an em dash.
      expect(page.title, `${page.slug} title`).not.toContain('—')
      expect(
        page.description.length,
        `${page.slug} description`,
      ).toBeLessThanOrEqual(165)
      expect(page.description.length).toBeGreaterThan(70)
    }
  })

  // Five of these shipped empty. The model was extracted from the old
  // hand-written documents, and the extractor's regex did not survive
  // Prettier's wrapped `</noscript\n>`, so it captured nothing — and the
  // parity check that was supposed to catch it compared that same empty
  // extraction against an empty render and agreed. Hence a test on the value
  // itself rather than on a round-trip.
  it('gives every entry the prose a crawler falls back to', () => {
    for (const page of ENTRY_PAGES) {
      expect(page.noscript.length, `${page.slug} noscript`).toBeGreaterThan(30)
      expect(page.noscript, page.slug).toMatch(/JavaScript/)
      expect(page.h1.length, `${page.slug} h1`).toBeGreaterThan(8)
      expect(page.lede.length, `${page.slug} lede`).toBeGreaterThan(80)
      expect(page.og.title.length, `${page.slug} og:title`).toBeGreaterThan(10)
      expect(
        page.twitter.title.length,
        `${page.slug} twitter:title`,
      ).toBeGreaterThan(10)
    }
  })

  it('renders the head every crawler reads', () => {
    for (const page of ENTRY_PAGES) {
      const html = renderEntryPage(page)
      const canonical = `https://mercurypitch.com${canonicalPath(page)}`
      expect(html).toContain(`<link rel="canonical" href="${canonical}" />`)
      expect(html).toContain(
        `<meta property="og:url" content="${canonical}" />`,
      )
      expect(html).toContain('<div id="root"></div>')
      expect(html).toContain('class="entry-prelude"')
      expect(html).toContain(`<script type="module" src="${page.boot}">`)
      // The prelude has to follow #root: it hides itself via the sibling
      // selector `#root:not(:empty) ~ .entry-prelude`.
      expect(html.indexOf('id="root"')).toBeLessThan(
        html.indexOf('class="entry-prelude"'),
      )
      // One h1, and it is the page's own.
      expect(html.match(/<h1>/g)?.length).toBe(1)
    }
  })

  it('colors browser chrome with each standalone surface ground', () => {
    const themeColor = (html: string): string | undefined =>
      /<meta name="theme-color" content="([^"]+)" \/>/.exec(html)?.[1]
    const colors = Object.fromEntries(
      ENTRY_PAGES.map((page) => [page.slug, themeColor(renderEntryPage(page))]),
    )
    const mirror = ENTRY_PAGES.filter(
      (page) => page.boot === '/src/features/mirror/main.tsx',
    ).map((page) => page.slug)

    expect(mirror).toEqual([
      'mirror',
      'vocal-range-test',
      'voice-type-test',
      'which-singer-has-my-vocal-range',
    ])
    for (const [slug, color] of Object.entries(colors)) {
      const expected =
        slug === 'studio-night'
          ? '#17181b'
          : mirror.includes(slug)
            ? '#0d1117'
            : '#0b1026'
      expect(color, slug).toBe(expected)
    }
  })

  it('keeps the visible FAQ and its structured data in step', () => {
    for (const page of ENTRY_PAGES) {
      const html = renderEntryPage(page)
      const visible = html.match(/<h2>/g)?.length ?? 0
      expect(visible, page.slug).toBe(page.faq?.length ?? 0)
      if (page.faq !== undefined && page.faq.length > 0) {
        expect(html).toContain('"@type": "FAQPage"')
        for (const item of page.faq) {
          // The answer in the markup must be the answer on the page.
          expect(html).toContain(item.a.replace(/&/g, '&amp;'))
        }
      }
    }
  })

  // The rooms people search for by name were the ones that never said they
  // were apps: Karaoke Night, the Voice Mirror, the range test and Break Glass
  // shipped an FAQ and no WebApplication, while their front doors had both.
  it('describes the most searched rooms as free web apps', () => {
    for (const slug of ['karaoke', 'mirror', 'vocal-range-test', 'glass']) {
      const page = ENTRY_PAGES.find((entry) => entry.slug === slug)
      expect(page?.app, `${slug} has no app markup`).toBeDefined()
      expect(page?.app?.description.length ?? 0).toBeGreaterThan(60)
    }
  })

  // Each app node is its own (@id on its canonical URL) and links by @id to
  // the studio and organization index.html defines, so every document reads
  // as one product from one publisher. The links repeat the name and URL, so
  // a reader that resolves nothing across pages still gets the whole claim.
  it('links every app to the studio and its publisher by @id', () => {
    for (const page of ENTRY_PAGES) {
      if (page.app === undefined) continue
      const scripts = new DOMParser()
        .parseFromString(renderEntryPage(page), 'text/html')
        .querySelectorAll('script[type="application/ld+json"]')
      const node = Array.from(scripts)
        .map((script) => JSON.parse(script.textContent ?? '{}'))
        .find((data) => data['@type'] === 'WebApplication')
      const url = `https://mercurypitch.com${canonicalPath(page)}`

      expect(node['@id'], page.slug).toBe(`${url}#app`)
      expect(node.url).toBe(url)
      expect(node.isPartOf).toEqual({
        '@type': 'WebApplication',
        '@id': 'https://mercurypitch.com/#app',
        name: 'MercuryPitch',
        url: 'https://mercurypitch.com/',
      })
      expect(node.publisher).toEqual({
        '@type': 'Organization',
        '@id': 'https://mercurypitch.com/#organization',
        name: 'MercuryPitch',
        url: 'https://mercurypitch.com/',
      })
    }
  })

  it('lists every entry in the sitemap and in llms.txt', () => {
    const sitemap = repoFile('public/sitemap.xml')
    const llms = repoFile('public/llms.txt')
    for (const page of ENTRY_PAGES) {
      const url = `https://mercurypitch.com${canonicalPath(page)}`
      expect(sitemap, `${page.slug} missing from sitemap`).toContain(
        `<loc>${url}</loc>`,
      )
      expect(llms, `${page.slug} missing from llms.txt`).toContain(`(${url})`)
    }
  })

  // The documents are build output. One that is not ignored is committed by
  // the next `git add -A`, and from then on the repo carries a stale copy the
  // generator overwrites on every run.
  it('git-ignores every generated document', () => {
    const ignored = repoFile('.gitignore').split('\n')
    for (const page of ENTRY_PAGES) {
      expect(ignored, `${page.slug}.html is not git-ignored`).toContain(
        `/${page.slug}.html`,
      )
    }
  })

  it('precaches every entry path and its document', () => {
    const serviceWorker = repoFile('src/lib/sw-runtime.ts')
    for (const page of ENTRY_PAGES) {
      for (const path of page.paths) {
        expect(
          serviceWorker,
          `${path} missing from the service worker`,
        ).toContain(`'${path}'`)
      }
      expect(serviceWorker).toContain(`'/${page.slug}.html'`)
    }
  })

  it('sets the studio tab client-side only where the entry boots the shell', () => {
    for (const page of ENTRY_PAGES) {
      if (page.bootHash === undefined) continue
      expect(page.boot, `${page.slug} sets a hash but is not the shell`).toBe(
        '/src/index.tsx',
      )
      expect(renderEntryPage(page)).toContain(
        `if (!window.location.hash) window.location.hash = '${page.bootHash}'`,
      )
    }
  })
})

// A search snippet or a card is no place for an absolute promise about where
// audio goes: it has no room for the exceptions elsewhere in the app, such as
// Jam's peer-to-peer audio and the vocal remover's optional server pass. The
// snippets say what the page does and that it runs in the browser. The vocal remover FAQ keeps "the file never leaves your machine",
// which is true of its default path (uvr-store.ts) and is said next to the
// server option it does not cover.
describe('what a snippet promises about audio', () => {
  const ABSOLUTE = /\b(?:never leav\w*|stays? on) your (?:own )?device\b/iu

  it.each(ENTRY_PAGES.map((page) => [page.slug, page] as const))(
    '%s makes no absolute device claim in its snippets',
    (_slug, page) => {
      for (const text of [
        page.description,
        page.og.description,
        page.twitter.description,
        ...(page.faq ?? []).map((item) => item.a),
      ]) {
        expect(text).not.toMatch(ABSOLUTE)
      }
    },
  )
})

describe('what a page without JavaScript says about the voice', () => {
  // The six pages that listen to a voice say WHERE it is analyzed. They used
  // to say what does not happen to it, which the owner struck: a denial puts
  // the idea in front of somebody who was not thinking about it.
  const VOICE_PAGES = [
    'mirror',
    'vocal-range-test',
    'glass',
    'pitch-training',
    'voice-type-test',
    'which-singer-has-my-vocal-range',
  ]

  it.each(VOICE_PAGES)(
    '%s says the voice is analyzed in the browser',
    (slug) => {
      const page = ENTRY_PAGES.find((entry) => entry.slug === slug)
      expect(page).toBeDefined()
      if (page === undefined) return
      expect(page.noscript).toMatch(
        /needs JavaScript — your voice is analyzed (?:right )?here in your browser\.$/u,
      )
      expect(renderEntryPage(page)).toContain(
        `<noscript>${page.noscript}</noscript>`,
      )
    },
  )

  it('is said by exactly those six', () => {
    const saying = ENTRY_PAGES.filter((page) =>
      page.noscript.includes('your voice is analyzed'),
    ).map((page) => page.slug)
    expect(saying.sort()).toEqual([...VOICE_PAGES].sort())
  })

  it('never mentions an upload, on any page', () => {
    for (const page of ENTRY_PAGES)
      expect(page.noscript).not.toMatch(/upload/iu)
  })
})

// The imprint has to be "easily, directly and permanently accessible"
// (E-Commerce Directive Art. 5), and an entry document is all a reader without
// JavaScript, a crawler or an ad reviewer ever sees. So every document a visitor
// can land on carries the same legal nav, as plain links in the first byte.
describe('the legal nav in every entry document', () => {
  // Each with its trailing slash: the landing answers /privacy and /terms with
  // a 307 to these, a hop on every legal link a crawler follows.
  const LEGAL_HREFS = [
    'https://about.mercurypitch.com/privacy/',
    'https://about.mercurypitch.com/terms/',
    'https://about.mercurypitch.com/imprint/',
  ]

  function legalHrefs(html: string): (string | null)[] {
    const document = new DOMParser().parseFromString(html, 'text/html')
    const nav = document.querySelector('nav[aria-label="Legal"]')
    return Array.from(nav?.querySelectorAll('a') ?? []).map((a) =>
      a.getAttribute('href'),
    )
  }

  it('links Privacy, Terms and Imprint from every generated entry', () => {
    for (const page of ENTRY_PAGES) {
      expect(legalHrefs(renderEntryPage(page))).toEqual(LEGAL_HREFS)
    }
  })

  it.each(['index.html', '404.html', 'delete-account.html'])(
    'links Privacy, Terms and Imprint from the hand-written %s',
    (file) => {
      expect(legalHrefs(repoFile(file))).toEqual(LEGAL_HREFS)
    },
  )
})

// Bing's SEO scan reports an image with no alt attribute, and a scanner that
// reads raw markup counts an image tag inside a comment too. Decorative
// images keep alt="" (an alt attribute, read as "skip this"); none may lack
// the attribute, and no comment may spell out the tag.
describe('the images a crawler reads in the raw markup', () => {
  const tagsWithoutAlt = (html: string) =>
    (html.match(/<img\b[^>]*>/gi) ?? []).filter((tag) => !/\salt=/i.test(tag))

  it('gives every image in every generated entry an alt attribute', () => {
    for (const page of ENTRY_PAGES) {
      expect(tagsWithoutAlt(renderEntryPage(page)), page.slug).toEqual([])
    }
  })

  it.each(['index.html', '404.html', 'delete-account.html'])(
    'gives every image in the root document %s an alt attribute',
    (file) => {
      expect(tagsWithoutAlt(repoFile(file))).toEqual([])
    },
  )
})

// The generated documents take their cross-links from the model, but nothing
// generates the rooms nav in index.html: a page added to the model has to be
// added there by hand. The four search-intent pages reached the 404 page's nav
// that way and never reached the home page's. 404.html is generated now
// (src/error-kit/) and is checked beside it. Glassworks is checked too: the
// source lists it, and the production build strips the link
// (tools/glassworks-listing.ts).
describe('the rooms nav in the hand-written documents', () => {
  function roomLinks(file: string): Map<string, string> {
    const document = new DOMParser().parseFromString(
      repoFile(file),
      'text/html',
    )
    const nav = document.querySelector(
      'nav[aria-label="More from MercuryPitch"]',
    )
    return new Map(
      Array.from(nav?.querySelectorAll('a') ?? []).map((a) => [
        a.getAttribute('href') ?? '',
        a.textContent?.trim() ?? '',
      ]),
    )
  }

  it.each(['index.html', '404.html'])(
    'links every entry from the hand-written %s, by its nav label',
    (file) => {
      const links = roomLinks(file)
      for (const page of ENTRY_PAGES) {
        expect(links.get(canonicalPath(page)), `${file}: ${page.slug}`).toBe(
          page.navLabel,
        )
      }
    },
  )
})

// "Is there an app?" is the question a karaoke searcher asks next, and its
// answer changes on the day a store publishes the listing. It is worked out
// from src/lib/store-listings.ts, so that day needs no copy change and no page
// keeps saying "on the way" about an app that is out.
describe('the answer about the phone apps', () => {
  const listings = (appStore: boolean, googlePlay: boolean): StoreListings => ({
    appStore: { live: appStore, appleId: '1234567890' },
    googlePlay: {
      live: googlePlay,
      packageName: 'com.irchiinnuss.mercurypitch',
    },
  })

  it('says both are on the way while neither listing is live', () => {
    const answer = nativeAppsAnswer(listings(false, false))
    expect(answer).toMatch(/^Apps for iPhone and Android are on the way\./)
    expect(answer).not.toMatch(/App Store|Google Play/)
  })

  it('names the store that is live and keeps the other on the way', () => {
    expect(nativeAppsAnswer(listings(true, false))).toMatch(
      /^MercuryPitch is on the App Store for iPhone\. An Android app is on the way/,
    )
    expect(nativeAppsAnswer(listings(false, true))).toMatch(
      /^MercuryPitch is on Google Play for Android\. An iPhone app is on the way/,
    )
  })

  it('names both once both are live', () => {
    const answer = nativeAppsAnswer(listings(true, true))
    expect(answer).toContain('App Store')
    expect(answer).toContain('Google Play')
    expect(answer).not.toContain('on the way')
  })

  // The store chips' rule: a live flag with no usable ID links nowhere, so it
  // does not count as out either.
  it('does not count a live App Store listing that has no Apple ID', () => {
    const answer = nativeAppsAnswer({
      ...listings(false, false),
      appStore: { live: true, appleId: '' },
    })
    expect(answer).toMatch(/^Apps for iPhone and Android are on the way\./)
  })

  it('is what the karaoke app page answers, from the shipped listings', () => {
    const page = ENTRY_PAGES.find((entry) => entry.slug === 'karaoke-app')
    expect(page).toBeDefined()
    if (page === undefined) return
    const item = page.faq?.find((entry) =>
      entry.q.includes('iPhone or Android'),
    )
    expect(item?.a).toBe(nativeAppsAnswer(STORE_LISTINGS))
    expect(renderEntryPage(page)).toContain(nativeAppsAnswer(STORE_LISTINGS))
  })
})

// A room's document links back to each lesson that practises in it once
// that lesson is released (docs/plans/find-your-pitch/SEARCH.md § 8), in
// its text under the lede rather than only in the nav, so the rooms and the
// lessons read as one topic. The model holds § 8's table; the build passes
// in the released lessons (tools/lesson-links.ts), so a draft is never
// linked and the release that deletes a lesson's line links it.
describe('the lessons a room practises', () => {
  const LESSON_1 = { href: '/learn/01', label: 'What is a note? (Lesson 1)' }
  const LESSON_2 = { href: '/learn/02', label: 'Twelve notes (Lesson 2)' }

  /** The lesson links in the text of `page` as rendered with `released`, and their paragraph's words. */
  function practised(
    page: (typeof ENTRY_PAGES)[number],
    released: readonly { href: string; label: string }[],
  ) {
    const document = new DOMParser().parseFromString(
      renderEntryPage(page, { lessons: released }),
      'text/html',
    )
    const p = document.querySelector(
      '.entry-prelude > p.entry-prelude__lessons',
    )
    return {
      links: Array.from(p?.querySelectorAll('a') ?? [], (a) => [
        a.getAttribute('href'),
        a.textContent,
      ]),
      words: (p?.textContent ?? '').replace(/\s+/g, ' ').trim(),
    }
  }

  it("holds SEARCH.md § 8's table, room by room", () => {
    // Arrange: each row's rooms and lessons, as the plan writes them
    const rows = repoFile('docs/plans/find-your-pitch/SEARCH.md')
      .split('\n## 8.')[1]
      .split('\n---')[0]
      .split('\n')
      .filter((line) => line.startsWith('| `/'))
      .map((line) => {
        const [rooms, lessons] = line.split('|').slice(1, 3)
        return {
          paths: Array.from(rooms.matchAll(/`([^`]+)`/g), (m) => m[1]),
          lessons: Array.from(lessons.matchAll(/\b\d+\b/g), (m) =>
            Number(m[0]),
          ),
        }
      })

    // Act
    const model = new Map(
      ENTRY_PAGES.filter((page) => page.lessonsPractised !== undefined).map(
        (page) => [canonicalPath(page), page.lessonsPractised],
      ),
    )

    // Assert
    expect(rows).toHaveLength(7)
    expect(model).toEqual(
      new Map(
        rows.flatMap((row) =>
          row.paths.map((path) => [path, row.lessons] as const),
        ),
      ),
    )
  })

  it('links Lesson 1 from /mirror and /vocal-range-test and Lesson 2 from /ear-lab while those two are out, and nothing from any other room', () => {
    // Act
    const linked = Object.fromEntries(
      ENTRY_PAGES.map((page) => [
        page.slug,
        practised(page, [LESSON_1, LESSON_2]).links,
      ]).filter(([, links]) => links.length > 0),
    )

    // Assert
    expect(linked).toEqual({
      mirror: [['/learn/01', 'What is a note? (Lesson 1)']],
      'vocal-range-test': [['/learn/01', 'What is a note? (Lesson 1)']],
      'ear-lab': [['/learn/02', 'Twelve notes (Lesson 2)']],
    })
    const mirror = ENTRY_PAGES.find((page) => page.slug === 'mirror')!
    expect(practised(mirror, [LESSON_1, LESSON_2]).words).toBe(
      'Find Your Pitch lesson: What is a note? (Lesson 1)',
    )
  })

  it('links a lesson only once it is released, every one in lesson order', () => {
    // Arrange
    const ear = ENTRY_PAGES.find((page) => page.slug === 'ear-lab')!
    const three = { href: '/learn/03', label: 'Match a note (Lesson 3)' }
    const seven = { href: '/learn/07', label: 'Slides (Lesson 7)' }
    const mirror = ENTRY_PAGES.find((page) => page.slug === 'mirror')!

    // Act
    const held = practised(ear, [LESSON_1])
    const out = practised(mirror, [LESSON_1, LESSON_2, three, seven])

    // Assert
    expect(held.links).toEqual([])
    expect(out.words).toBe(
      'Find Your Pitch lessons: What is a note? (Lesson 1), Match a note (Lesson 3) and Slides (Lesson 7)',
    )
  })

  it('links from each generated document only lessons the build lists as released', () => {
    // Arrange
    const released = releasedLessonLinks(process.cwd()).map((l) => l.href)

    for (const page of ENTRY_PAGES) {
      // Act
      const document = new DOMParser().parseFromString(
        repoFile(`${page.slug}.html`),
        'text/html',
      )
      const hrefs = Array.from(
        document.querySelectorAll('.entry-prelude__lessons a'),
        (a) => a.getAttribute('href'),
      )

      // Assert
      for (const href of hrefs) expect(released, page.slug).toContain(href)
    }
  })
})
