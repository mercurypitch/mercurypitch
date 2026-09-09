import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ENTRY_PAGES } from '@/seo/entry-pages'

function repoFile(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

function repoHtml(path: string): Document {
  return new DOMParser().parseFromString(repoFile(path), 'text/html')
}

describe('launch entry documents', () => {
  it('builds vocal range from a dedicated, self-canonical document', () => {
    const document = repoHtml('vocal-range-test.html')
    const vite = repoFile('vite.config.ts')

    expect(document.title).toBe(
      'Free Vocal Range Test — Lowest & Highest Note | MercuryPitch',
    )
    expect(
      document.querySelector('link[rel="canonical"]')?.getAttribute('href'),
    ).toBe('https://mercurypitch.com/vocal-range-test')
    expect(
      document
        .querySelector('meta[property="og:url"]')
        ?.getAttribute('content'),
    ).toBe('https://mercurypitch.com/vocal-range-test')
    expect(
      document.querySelector('script[type="module"]')?.getAttribute('src'),
    ).toBe('/src/features/mirror/main.tsx')
    // The document, its clean path and its build input all come from one
    // record now, so this asserts the record rather than a config literal.
    const entry = ENTRY_PAGES.find((page) => page.slug === 'vocal-range-test')
    expect(entry?.paths).toEqual(['/vocal-range-test'])
    expect(entry?.boot).toBe('/src/features/mirror/main.tsx')
    expect(vite).not.toContain("'tone-deaf-test.html'")
  })

  it('permanently redirects the unsafe diagnostic alias', () => {
    const redirects = repoFile('public/_redirects')

    expect(redirects).toMatch(/^\/tone-deaf-test \/mirror 301$/m)
    expect(redirects).toMatch(/^\/tone-deaf-test\/ \/mirror 301$/m)
  })

  it('indexes the truthful range and Karaoke Night entries but not the redirect', () => {
    const sitemap = repoFile('public/sitemap.xml')

    expect(sitemap).toContain(
      '<loc>https://mercurypitch.com/vocal-range-test</loc>',
    )
    expect(sitemap).toContain(
      '<loc>https://mercurypitch.com/karaoke-night</loc>',
    )
    expect(sitemap).not.toContain('mercurypitch.com/tone-deaf-test')
  })

  it('positions the root document around Voice Mirror and Karaoke Night', () => {
    const document = repoFile('index.html')

    expect(document).toContain('See Your Voice, Sing Karaoke')
    expect(document).toContain('Karaoke Night stages')
    expect(document).toContain('vocal range and pitch accuracy')
  })

  // The instrument rooms were `noindex, nofollow` pilots: Piano and Guitar
  // Night until 2026-08-20, Drum Night until 2026-09-08. They are listed now,
  // so what is worth pinning is that each one is *safe* to
  // index: a page enters the sitemap only once it has its own title, a
  // description worth showing, a self-canonical and a share card. A sitemap
  // entry whose canonical points elsewhere is how you earn "duplicate,
  // submitted URL not selected as canonical" — which is exactly why the
  // /exercises deep links are still held back above.
  const INSTRUMENT_ROOMS = [
    {
      room: 'Piano Night',
      file: 'piano-night.html',
      path: 'piano-night',
      entry: '/src/features/piano-night/main.tsx',
    },
    {
      room: 'Guitar Night',
      file: 'guitar-night.html',
      path: 'guitar-night',
      entry: '/src/features/guitar-night/main.tsx',
    },
    {
      room: 'Drum Night',
      file: 'drum-night.html',
      path: 'drum-night',
      entry: '/src/features/drum-night/main.tsx',
    },
  ] as const

  for (const room of INSTRUMENT_ROOMS) {
    it(`indexes ${room.room} from a self-canonical document with a share card`, () => {
      const document = repoHtml(room.file)
      // The standalone-document list lives with the rest of the worker's
      // routing rules, which moved out of src/sw.ts into src/lib/sw-runtime.ts.
      const serviceWorker = repoFile('src/lib/sw-runtime.ts')
      const sitemap = repoFile('public/sitemap.xml')
      const url = `https://mercurypitch.com/${room.path}`

      expect(document.title).toContain(room.room)
      expect(
        document.querySelector('link[rel="canonical"]')?.getAttribute('href'),
      ).toBe(url)
      expect(
        document.querySelector('meta[name="robots"]')?.getAttribute('content'),
      ).toBe('index, follow')
      // The pilot heads carried a one-line description and no keywords, which
      // is thin for a page asking to be crawled.
      expect(
        document
          .querySelector('meta[name="description"]')
          ?.getAttribute('content')?.length ?? 0,
      ).toBeGreaterThan(120)
      expect(document.querySelector('meta[name="keywords"]')).not.toBeNull()
      expect(
        document
          .querySelector('meta[property="og:url"]')
          ?.getAttribute('content'),
      ).toBe(url)
      expect(
        document
          .querySelector('meta[property="og:image"]')
          ?.getAttribute('content'),
      ).toBe(`https://mercurypitch.com/${room.path}-og.png`)
      expect(
        document.querySelector('script[type="module"]')?.getAttribute('src'),
      ).toBe(room.entry)
      // One record drives the document, the dev rewrite and the build input.
      const entry = ENTRY_PAGES.find((page) => page.slug === room.path)
      expect(entry?.paths).toEqual([`/${room.path}`])
      expect(entry?.boot).toBe(room.entry)
      expect(serviceWorker).toContain(`'/${room.path}'`)
      expect(serviceWorker).toContain(`'/${room.path}.html'`)
      expect(sitemap).toContain(`<loc>${url}</loc>`)
    })
  }

  it('consumes Guitar Night Google sign-in before restoring the session', () => {
    const entry = repoFile('src/features/guitar-night/main.tsx')
    const consume = entry.indexOf('consumeGoogleRedirect()')
    const restore = entry.indexOf('void restoreAuth()')

    expect(consume).toBeGreaterThan(-1)
    expect(restore).toBeGreaterThan(consume)
  })
})

// Every entry document is a JavaScript shell: `#root` is empty in the file, so a
// crawler that does not run the bundle reads no heading, no sentence and no link
// out. That is why Search Console left /glass, /karaoke-night, /piano-night and
// /vocal-range-test "Discovered — currently not indexed" for a month: known from
// the sitemap, never worth fetching. The prelude is the fix — real text in the
// first byte of the body, and a link to every sibling room so no document is an
// orphan. These assertions exist so it cannot quietly disappear in a refactor.
describe('entry document prelude', () => {
  const ENTRY_FILES = [
    'index.html',
    'mirror.html',
    'vocal-range-test.html',
    'karaoke.html',
    'glass.html',
    'piano-night.html',
    'guitar-night.html',
    'drum-night.html',
    'ear-lab.html',
    'jam.html',
  ] as const

  // Everything the nav offers is `index, follow` and in the sitemap, and every
  // document links every sibling but itself, so none of them is an orphan.
  const SIBLING_PATHS = [
    '/',
    '/mirror',
    '/vocal-range-test',
    '/karaoke-night',
    '/glass',
    '/piano-night',
    '/guitar-night',
    '/drum-night',
    '/ear-lab',
    '/jam',
  ] as const

  for (const file of ENTRY_FILES) {
    it(`gives ${file} a heading, a claim and a way out without JavaScript`, () => {
      const document = repoHtml(file)
      const prelude = document.querySelector('.entry-prelude')

      expect(prelude).not.toBeNull()
      // One h1, and it carries words — an empty heading indexes as nothing.
      const headings = prelude?.querySelectorAll('h1') ?? []
      expect(headings.length).toBe(1)
      // A phrase, not a placeholder — a blank or single-word h1 indexes as
      // nothing, which is the state these documents are being lifted out of.
      expect(
        (headings[0]?.textContent ?? '').trim().split(/\s+/).length,
      ).toBeGreaterThanOrEqual(2)
      // A sentence, not a slogan: this is the entire body copy for a
      // non-rendering crawler.
      expect(
        (prelude?.querySelector('p')?.textContent ?? '').trim().length,
      ).toBeGreaterThan(80)

      const hrefs = Array.from(prelude?.querySelectorAll('a') ?? []).map((a) =>
        a.getAttribute('href'),
      )
      for (const path of SIBLING_PATHS) {
        const self =
          document
            .querySelector('link[rel="canonical"]')
            ?.getAttribute('href') === `https://mercurypitch.com${path}` ||
          (path === '/' &&
            document
              .querySelector('link[rel="canonical"]')
              ?.getAttribute('href') === 'https://mercurypitch.com/')
        if (self) continue
        expect(hrefs).toContain(path)
      }
      // The app repo never linked to the marketing site, so the landing sat
      // outside the only pages with any crawl budget.
      expect(hrefs).toContain('https://about.mercurypitch.com/')
    })

    it(`hides ${file}'s prelude the moment the app mounts`, () => {
      // The selector in the shared stylesheet is the whole contract: the
      // prelude must be a later sibling of #root, and #root must be empty in
      // the file, or the rule never fires and the room renders under a stack
      // of loading text.
      const raw = repoFile(file)
      expect(raw).toContain('href="/src/styles/entry-prelude.css"')
      expect(raw).toContain('<div id="root"></div>')
      expect(raw.indexOf('class="entry-prelude"')).toBeGreaterThan(
        raw.indexOf('<div id="root"></div>'),
      )
    })

    it(`keeps ${file}'s title short enough to survive a result`, () => {
      // Bing Webmaster Tools' URL inspection reports a title outside roughly 15
      // to 65 characters, and Google truncates on pixel width at about 60. The
      // tail is where the brand sits, so an overrun costs the least important
      // words first — but it still reads as a truncated result.
      const title = repoHtml(file).title.trim()

      expect(title.length).toBeGreaterThan(15)
      expect(title.length).toBeLessThanOrEqual(65)
    })

    it(`keeps ${file}'s description short enough to survive a result`, () => {
      const description =
        repoHtml(file)
          .querySelector('meta[name="description"]')
          ?.getAttribute('content') ?? ''

      expect(description.length).toBeGreaterThan(80)
      expect(description.length).toBeLessThanOrEqual(160)
    })
  }

  it('keeps the hide rule in the one stylesheet every entry links', () => {
    const css = repoFile('src/styles/entry-prelude.css')
    expect(css).toMatch(
      /#root:not\(:empty\) ~ \.entry-prelude \{\s*display: none;/,
    )
    // No entry document may carry a private copy: ten inline blocks drift.
    for (const file of ENTRY_FILES) {
      expect(repoFile(file)).not.toContain('.entry-prelude {')
    }
  })

  // The prelude is the loading screen, so it opens on the brand rather than on
  // a dark rectangle, and it races the bundle the way the curtain's art does.
  for (const file of ENTRY_FILES) {
    it(`opens ${file} on the brand mark and its plate`, () => {
      const document = repoHtml(file)
      const lockup = document.querySelector('.entry-prelude__lockup')
      const mark = lockup?.querySelector('img')

      expect(lockup).not.toBeNull()
      // The shipped asset, never an inlined copy: this app once shipped a
      // superseded mark in the opening because that copy was hand-written.
      expect(mark?.getAttribute('src')).toBe('/brand-mark.svg')
      // Decorative — the h1 below already names the page.
      expect(mark?.getAttribute('alt')).toBe('')
      // The lockup must not become the claim a crawler reads first.
      expect(lockup?.tagName).toBe('DIV')

      const raw = repoFile(file)
      for (const plate of [
        '/opening/first-light-wide.webp',
        '/opening/first-light-tall.webp',
      ]) {
        expect(raw).toContain(`rel="preload"`)
        expect(raw).toContain(plate)
      }
      expect(raw).toContain('href="/brand-mark.svg"')
    })
  }

  it('holds the prelude copy back so a fast boot never shows it', () => {
    const css = repoFile('src/styles/entry-prelude.css')

    // The ground paints at once — delaying it would flash the body's white
    // through first — while the lockup and then the copy wait behind delays.
    expect(css).toMatch(/\.entry-prelude \{[^}]*background:/s)
    expect(css).toMatch(
      /\.entry-prelude__lockup \{\s*animation: entryPreludeRise [\d]+ms ease [\d]+ms both;/,
    )
    expect(css).toMatch(
      /\.entry-prelude > :not\(\.entry-prelude__lockup\) \{\s*animation: entryPreludeRise [\d]+ms ease [\d]+ms both;/,
    )
    const delay = (rule: string): number =>
      Number(
        /animation: entryPreludeRise \d+ms ease (\d+)ms both/.exec(
          css.slice(css.indexOf(rule)),
        )?.[1] ?? 0,
      )
    // Brand first, words second, both after the moment a warm boot needs.
    expect(delay('.entry-prelude__lockup {')).toBeGreaterThanOrEqual(120)
    expect(
      delay('.entry-prelude > :not(.entry-prelude__lockup) {'),
    ).toBeGreaterThan(delay('.entry-prelude__lockup {'))
    // Reduced motion keeps the waits and drops the movement.
    expect(css).toContain('prefers-reduced-motion: reduce')
  })

  // Google's structured-data rules require FAQPage content to be visible on the
  // page. These four documents declared Q&A that no reader could ever see.
  const FAQ_FILES = [
    'mirror.html',
    'vocal-range-test.html',
    'karaoke.html',
    'glass.html',
  ] as const

  for (const file of FAQ_FILES) {
    it(`shows ${file}'s marked-up FAQ answers to a reader`, () => {
      const document = repoHtml(file)
      const script = Array.from(
        document.querySelectorAll('script[type="application/ld+json"]'),
      )
        .map((node) => JSON.parse(node.textContent ?? '{}'))
        .find((data) => data['@type'] === 'FAQPage')

      expect(script).toBeDefined()
      // Prettier re-wraps the rendered copy across lines, so compare on
      // collapsed whitespace rather than the formatter's line breaks.
      const collapse = (value: string) => value.replace(/\s+/g, ' ').trim()
      const visible = collapse(
        document.querySelector('.entry-prelude__faq')?.textContent ?? '',
      )
      expect(visible.length).toBeGreaterThan(0)
      for (const entry of script.mainEntity) {
        expect(visible).toContain(collapse(entry.name))
        expect(visible).toContain(collapse(entry.acceptedAnswer.text))
      }
    })
  }

  it('tells search engines what MercuryPitch is, and where else it lives', () => {
    const blocks = Array.from(
      repoHtml('index.html').querySelectorAll(
        'script[type="application/ld+json"]',
      ),
    ).map((node) => JSON.parse(node.textContent ?? '{}'))
    const organization = blocks.find((data) => data['@type'] === 'Organization')

    // "mercurypitch" as a Google query returns Mercury Marine propeller pitch
    // charts. Nothing on the web said the name belonged to anything else.
    expect(organization).toBeDefined()
    expect(organization.name).toBe('MercuryPitch')
    expect(organization.sameAs).toContain(
      'https://github.com/mercurypitch/mercurypitch',
    )
    expect(blocks.some((data) => data['@type'] === 'WebApplication')).toBe(true)
  })

  it('lists every indexable entry document in the sitemap', () => {
    const sitemap = repoFile('public/sitemap.xml')

    for (const path of SIBLING_PATHS) {
      const url =
        path === '/'
          ? 'https://mercurypitch.com/'
          : `https://mercurypitch.com${path}`
      expect(sitemap).toContain(`<loc>${url}</loc>`)
    }
  })

  it('keeps non-production deploys out of the index', () => {
    const vite = repoFile('vite.config.ts')

    // dev.mercurypitch.com served the same index,follow documents as production
    // with only a cross-host canonical arguing against a duplicate.
    expect(vite).toContain('nonProductionNoindexPlugin')
    expect(vite).toContain('X-Robots-Tag: noindex, nofollow')
    expect(vite).toContain("nonProductionNoindexPlugin(mode === 'production')")
  })
})

// ── Unmatched paths ───────────────────────────────────────────
//
// Until now every path that matched no file was answered with index.html and a
// 200, so /llms.txt, /foo/bar and every dead link looked like the home page to
// a crawler. These pin the three pieces that make an unmatched path a real 404
// without taking the exercise deep links down with it.
describe('unmatched paths', () => {
  it('asks the asset layer for a 404 document rather than the app shell', () => {
    const wrangler = repoFile('wrangler.jsonc')

    expect(wrangler).toContain('"not_found_handling": "404-page"')
    // The setting itself, not the comment above it explaining what it replaced.
    expect(wrangler).not.toMatch(
      /"not_found_handling":\s*"single-page-application"/,
    )
  })

  it('keeps every prefix that relied on the fallback', () => {
    const wrangler = repoFile('wrangler.jsonc')

    expect(wrangler).toContain('"/exercises/*"')
    // /admin and its sections have no file either. Missed the first time, and
    // six real URLs went to the 404 page because of it.
    expect(wrangler).toContain('"/admin"')
    expect(wrangler).toContain('"/admin/*"')
    // Not "/admin/": wrangler rejects it as redundant against the wildcard,
    // and a config it refuses to load fails the deploy, not the gate.
    expect(wrangler).not.toContain('"/admin/",')
  })

  it('builds the 404 document as a real entry', () => {
    const vite = repoFile('vite.config.ts')

    expect(vite).toContain("notFound: resolve(__dirname, '404.html')")
  })

  it('gives the 404 document a heading, a way out, and no canonical', () => {
    const document = repoHtml('404.html')

    expect(document.title).toBe('Page not found | MercuryPitch')
    expect(document.querySelector('h1')?.textContent?.trim()).toBeTruthy()
    // A page that does not exist must not claim to be a copy of one that does.
    expect(document.querySelector('link[rel="canonical"]')).toBeNull()
    expect(
      document.querySelector('meta[name="robots"]')?.getAttribute('content'),
    ).toBe('noindex, follow')
    // No app shell: the 404 is a static document and must not boot the studio.
    expect(document.querySelector('#root')).toBeNull()
    expect(document.querySelector('script[type="module"]')).toBeNull()
    expect(
      document.querySelector('link[rel="stylesheet"]')?.getAttribute('href'),
    ).toBe('/src/styles/entry-prelude.css')

    const links = [...document.querySelectorAll('nav a')].map((anchor) =>
      anchor.getAttribute('href'),
    )
    for (const path of [
      '/',
      '/mirror',
      '/vocal-range-test',
      '/karaoke-night',
      '/glass',
      '/piano-night',
      '/guitar-night',
      '/drum-night',
      '/ear-lab',
      '/jam',
    ]) {
      expect(links).toContain(path)
    }
  })
})

// ── llms.txt ──────────────────────────────────────────────────
//
// The llmstxt.org convention: an H1 with the name, a blockquote summary, then
// H2 sections of markdown links. GPTBot is the single largest crawler on this
// domain and the project allows it, so the file is worth keeping honest.
describe('llms.txt', () => {
  const llms = () => repoFile('public/llms.txt')

  it('opens with the name and a blockquote summary', () => {
    const lines = llms().split('\n')

    expect(lines[0]).toBe('# MercuryPitch')
    expect(lines.find((line) => line.startsWith('> '))).toBeTruthy()
  })

  it('lists every room in the sitemap', () => {
    const text = llms()
    const sitemap = repoFile('public/sitemap.xml')
    const indexed = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)]
      .map((match) => match[1])
      .filter((url) => url !== 'https://mercurypitch.com/')

    for (const url of indexed) {
      expect(text).toContain(`(${url})`)
    }
  })

  it('states what the app does not do, so an assistant cannot fill the gap', () => {
    const text = llms()

    expect(text).toContain('## What MercuryPitch does not do')
    // The claim the feature map forbids above all others.
    expect(text).toMatch(/not a tone-deafness test/i)
  })

  it('links nothing that is not a real destination', () => {
    const hosts = [...llms().matchAll(/\((https?:\/\/[^)]+)\)/g)].map(
      (match) => new URL(match[1]).hostname,
    )

    for (const host of hosts) {
      expect([
        'mercurypitch.com',
        'about.mercurypitch.com',
        'github.com',
        'llmstxt.org',
      ]).toContain(host)
    }
  })
})
