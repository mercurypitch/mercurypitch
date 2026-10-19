import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CONTACT_FORM_URL } from '@/lib/contact-links'
import { DELETE_ACCOUNT_URL } from '@/lib/legal-links'
import { STORE_LISTINGS, storeLinks } from '@/lib/store-listings'
import { canonicalPath, ENTRY_PAGES } from '@/seo/entry-pages'

function repoFile(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

function repoHtml(path: string): Document {
  return new DOMParser().parseFromString(repoFile(path), 'text/html')
}

// The documents a visitor can land on, and the paths every prelude nav has to
// offer, both read off the model so a page added there is checked here too.
// These lists used to be written out by hand, and the four search-intent pages
// (/pitch-training and the three after it in the model) went live missing
// from both: no link to them in the home page's prelude, and no check to say so.
//
// Nothing is taken off for Glassworks. The suites read documents generated
// with every entry listed, as the dev deploy serves them
// (src/tests/setup-entry-pages.ts). The production build drops the museum
// from every nav, and scripts/assert-glassworks-listing.mjs checks that in dist.
const ENTRY_FILES: readonly string[] = [
  'index.html',
  ...ENTRY_PAGES.map((page) => `${page.slug}.html`),
]
const SIBLING_PATHS: readonly string[] = [
  '/',
  ...ENTRY_PAGES.map(canonicalPath),
]

describe('launch entry documents', () => {
  it('builds vocal range from a dedicated, self-canonical document', () => {
    const document = repoHtml('vocal-range-test.html')
    const vite = repoFile('vite.config.ts')

    expect(document.title).toBe(
      'Free Vocal Range Test: Lowest & Highest Note | MercuryPitch',
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
      // Keywords were removed in 0.9.18: no engine reads them, and Bing
      // treats a stuffed list as a spam signal.
      expect(document.querySelector('meta[name="keywords"]')).toBeNull()
      expect(
        document
          .querySelector('meta[property="og:url"]')
          ?.getAttribute('content'),
      ).toBe(url)
      expect(
        document
          .querySelector('meta[property="og:image"]')
          ?.getAttribute('content'),
      ).toMatch(
        new RegExp(
          `^https://mercurypitch\\.com/${room.path}-og\\.png\\?v=[0-9a-f]{8}$`,
        ),
      )
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
  // Everything the nav offers (SIBLING_PATHS) is `index, follow` and in the
  // sitemap, and every document links every sibling but itself, so none of
  // them is an orphan.

  // Titles known to be longer than a result shows. Empty since 0.9.18, when
  // the last three (69, 76 and 77 characters) were shortened. A page named
  // here still gets every other check, and its title check fails as soon as
  // the title fits, so the name comes off the list with the fix.
  const LONG_TITLES: readonly string[] = []

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

    const long = LONG_TITLES.includes(file)
    it(
      long
        ? `still has ${file}'s title on the list of ones too long for a result`
        : `keeps ${file}'s title short enough to survive a result`,
      () => {
        // Bing Webmaster Tools' URL inspection reports a title outside roughly
        // 15 to 65 characters, and Google truncates on pixel width at about 60.
        // The tail is where the brand sits, so an overrun costs the least
        // important words first — but it still reads as a truncated result.
        const title = repoHtml(file).title.trim()

        expect(title.length).toBeGreaterThan(15)
        // Decision D5: "Name: what it does | MercuryPitch", no em dash.
        expect(title).not.toContain('—')
        if (long) {
          expect(
            title.length,
            `${file}'s title fits now: take it off LONG_TITLES`,
          ).toBeGreaterThan(65)
        } else {
          expect(title.length).toBeLessThanOrEqual(65)
        }
      },
    )

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
      // The mark is the brand's logo, so it is named. Checkers flagged the
      // empty alt on all 14 pages (SEO recheck, 14 Oct 2026).
      expect(mark?.getAttribute('alt')).toBe('MercuryPitch')
      // The lockup must not become the claim a crawler reads first.
      expect(lockup?.tagName).toBe('DIV')

      const raw = repoFile(file)
      const plates = [
        '/opening/first-light-wide.webp',
        '/opening/first-light-tall.webp',
      ]
      if (file === 'index.html') {
        // The app shell is the one document that PAINTS these: App.tsx's
        // opening curtain is a real <picture>, and the plate is its LCP.
        // Preloading it there is the whole point.
        for (const plate of plates) expect(raw).toContain(plate)
        expect(raw).toContain('rel="preload"')
      } else {
        // Every other entry document only uses the plate as a CSS background
        // of .entry-prelude, which is hidden the moment #root fills — and the
        // curtain that would paint it never renders on these pages at all.
        // Preloading it at high priority put 173 KB ahead of all 36 module
        // scripts, so the art competed with the bundle whose arrival ends the
        // prelude. Measured on 2026-09-09: downloaded in full, painted by
        // nothing. A browser skips a hidden element's background entirely.
        for (const plate of plates) expect(raw).not.toContain(plate)
      }
      // The mark is different again: a real <img> in the lockup, painted on
      // every boot slow enough to show the prelude at all.
      expect(raw).toContain('href="/brand-mark.svg"')
      // The art still has to reach a slow boot from somewhere.
      expect(repoFile('src/styles/entry-prelude.css')).toContain(
        '/opening/first-light-wide.webp',
      )
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
  // page. Four documents once declared Q&A that no reader could ever see, so
  // every document whose model carries an FAQ is checked.
  const FAQ_FILES = ENTRY_PAGES.filter(
    (page) => (page.faq?.length ?? 0) > 0,
  ).map((page) => `${page.slug}.html`)

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

  // The landing (disjoint-colliders, packages/mercurypitch Base.astro) emits
  // its MercuryPitch node under this @id. Both hosts have to use the same one,
  // or a search engine reads two organizations with the same name.
  it('names the same organization the landing does', () => {
    const organization = Array.from(
      repoHtml('index.html').querySelectorAll(
        'script[type="application/ld+json"]',
      ),
    )
      .map((node) => JSON.parse(node.textContent ?? '{}'))
      .find((data) => data['@type'] === 'Organization')

    expect(organization['@id']).toBe('https://mercurypitch.com/#organization')
    // A PNG that ships in public/, like the landing's own node uses: the
    // owner's call (14 Oct 2026) was a raster file that answers 200.
    expect(organization.logo).toMatch(
      /^https:\/\/mercurypitch\.com\/[\w-]+\.png$/,
    )
    expect(
      existsSync(
        resolve(
          process.cwd(),
          'public',
          new URL(organization.logo as string).pathname.slice(1),
        ),
      ),
    ).toBe(true)
    // Every account the landing's footer lists (brand.ts SOCIAL_LINKS).
    for (const account of [
      'https://x.com/mercurypitch7',
      'https://www.instagram.com/mercurypitch/',
      'https://www.tiktok.com/@mercurypitch',
      'https://www.youtube.com/@mercurypitch',
      'https://github.com/mercurypitch/mercurypitch',
    ]) {
      expect(organization.sameAs).toContain(account)
    }
  })

  // Google takes a result's site name from a WebSite node on the home page,
  // and "Mercury Pitch" is how the name gets typed. The studio is what every
  // entry document's app links to as its whole (render-entry-page.ts), so its
  // @id has to be the one they use.
  it('names the site for search results and links it to the organization', () => {
    const blocks = Array.from(
      repoHtml('index.html').querySelectorAll(
        'script[type="application/ld+json"]',
      ),
    ).map((node) => JSON.parse(node.textContent ?? '{}'))
    const website = blocks.find((data) => data['@type'] === 'WebSite')
    const studio = blocks.find((data) => data['@type'] === 'WebApplication')
    const organization = { '@id': 'https://mercurypitch.com/#organization' }

    expect(website).toBeDefined()
    expect(website['@id']).toBe('https://mercurypitch.com/#website')
    expect(website.name).toBe('MercuryPitch')
    expect(website.alternateName).toBe('Mercury Pitch')
    expect(website.url).toBe('https://mercurypitch.com/')
    expect(website.publisher).toEqual(organization)

    expect(studio['@id']).toBe('https://mercurypitch.com/#app')
    expect(studio.url).toBe('https://mercurypitch.com/')
    expect(studio.publisher).toEqual(organization)
  })

  // The audience reads American English. Main fixed "colour" and
  // "recognisable"; these are the ones that were still live on 14 Oct 2026.
  it.each(ENTRY_FILES)('writes %s in American spelling', (file) => {
    const document = repoHtml(file)
    const visible = [
      document.title,
      document.querySelector('.entry-prelude')?.textContent ?? '',
      document.querySelector('noscript')?.textContent ?? '',
      ...Array.from(document.querySelectorAll('meta[content]')).map(
        (node) => node.getAttribute('content') ?? '',
      ),
      ...Array.from(
        document.querySelectorAll('script[type="application/ld+json"]'),
      ).map((node) => node.textContent ?? ''),
    ].join('\n')

    expect(visible).not.toMatch(
      /\b(?:analys(?:e|ed|es|ing)|theatre|catalogue|colour|recognisable|practis(?:e|ed|es|ing)|centre)\b/iu,
    )
  })

  it.each(ENTRY_FILES)('carries no meta keywords in %s', (file) => {
    expect(repoHtml(file).querySelector('meta[name="keywords"]')).toBeNull()
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

  // <lastmod> is the one sitemap field Google and Bing read, and only from a
  // file whose dates look true. Five URLs once went in with none, and ten kept
  // 2026-09-08 through a month of changes. A day of slack on "the future", so
  // a date written in a time zone ahead of CI's UTC still passes.
  it('dates every sitemap URL, and none in the future', () => {
    const sitemap = repoFile('public/sitemap.xml').replace(
      /<!--[\s\S]*?-->/g,
      '',
    )
    const urls = [...sitemap.matchAll(/<url>([\s\S]*?)<\/url>/g)].map(
      (match) => match[1],
    )
    const latest = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)

    expect(urls.length).toBeGreaterThan(0)
    for (const url of urls) {
      const loc = /<loc>([^<]+)<\/loc>/.exec(url)?.[1]
      const lastmod = /<lastmod>([^<]+)<\/lastmod>/.exec(url)?.[1] ?? ''
      expect(lastmod, `${loc} has no <lastmod>`).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(lastmod <= latest, `${loc} is dated ${lastmod}`).toBe(true)
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
    // The error scene's sheet (src/error-kit/), not the entry prelude's.
    expect(
      document.querySelector('link[rel="stylesheet"]')?.getAttribute('href'),
    ).toBe('/src/styles/error-scene.css')

    const links = [...document.querySelectorAll('nav a')].map((anchor) =>
      anchor.getAttribute('href'),
    )
    for (const path of SIBLING_PATHS) {
      expect(links).toContain(path)
    }
  })
})

// ── The account deletion page ─────────────────────────────────
//
// Google Play asks for a public web address where somebody can have their
// account deleted without the app, and the Play Console links it. So the page
// has to load signed out, on a hard load, with nothing booted: a real document
// of its own, built as an input and served by the asset layer for its clean
// path, never the app shell and never the 404.
describe('the account deletion page', () => {
  const page = () => repoHtml('delete-account.html')

  it('is built as a document of its own and rewritten in dev and preview', () => {
    const vite = repoFile('vite.config.ts')

    expect(vite).toContain(
      "deleteAccount: resolve(__dirname, 'delete-account.html')",
    )
    // Cloudflare's html_handling maps the clean path to the file in
    // production; the dev and preview servers need the same table.
    expect(vite).toContain("const DELETE_ACCOUNT_PATH = '/delete-account'")
  })

  it('needs nothing booted to read: no app root, no script', () => {
    const document = page()

    expect(document.querySelector('#root')).toBeNull()
    expect(document.querySelector('script')).toBeNull()
    expect(document.title).toBe('Delete your account | MercuryPitch')
    expect(
      document.querySelector('link[rel="canonical"]')?.getAttribute('href'),
    ).toBe('https://mercurypitch.com/delete-account')
    // Indexable like any real page; only the 404 says noindex.
    expect(document.querySelector('meta[name="robots"]')).toBeNull()
  })

  it('offers all three ways: the app, the web flow, and writing to us', () => {
    const document = page()
    const text = document.body.textContent?.replace(/\s+/g, ' ') ?? ''

    expect(text).toContain('Under your account, tap Delete account.')
    // The web flow is Settings, Account, Danger Zone, and a signed-out
    // visitor reaches it through the sign-in button on the same tab.
    expect(
      document
        .querySelector('[data-testid="delete-account-settings"]')
        ?.getAttribute('href'),
    ).toBe('/#/settings/account')
    expect(text).toContain('Sign in or create account')
    const contact = new URL(
      document
        .querySelector('[data-testid="delete-account-contact"]')
        ?.getAttribute('href') ?? '',
    )
    expect(`${contact.origin}${contact.pathname}`).toBe(CONTACT_FORM_URL)
    expect(contact.searchParams.get('topic')).toBe('privacy')
  })

  it('says what goes, what stays, and that Apple is told', () => {
    const text =
      page().body.textContent?.replace(/\s+/g, ' ').toLowerCase() ?? ''

    expect(text).toContain('what deleting removes')
    expect(text).toContain('what is kept, and for how long')
    expect(text).toContain('we also ask apple to revoke it')
    expect(text).toContain('credits are not refunded')
    // The retention figures come from the code: share links (60 days) and
    // share cards (30 days) in KV, and D1 Time Travel (30 days).
    expect(text).toContain('up to 60 days')
    expect(text).toContain('restore history for 30 days')
  })

  it('is linked from Settings, About beside the privacy notice', () => {
    const settings = repoFile('src/components/SettingsPanel.tsx')

    expect(DELETE_ACCOUNT_URL).toBe('https://mercurypitch.com/delete-account')
    expect(settings).toContain('href={DELETE_ACCOUNT_URL}')
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
    // A store is a real destination once its listing is live, and only then.
    const stores = Object.values(storeLinks(STORE_LISTINGS)).map(
      (url) => new URL(url).hostname,
    )

    for (const host of hosts) {
      expect([
        'mercurypitch.com',
        'about.mercurypitch.com',
        'github.com',
        'llmstxt.org',
        ...stores,
      ]).toContain(host)
    }
  })

  // "Does MercuryPitch have an app?" gets answered with whatever this file
  // says. Until a listing is live it says plainly that the apps are not out;
  // the day one goes live, this fails until the file links the listing.
  it('says where it runs, and names a store only once its listing is live', () => {
    const text = llms()
    const links = storeLinks(STORE_LISTINGS)

    expect(text).toContain('## Where it runs')
    // Both ways round: the sentence goes the day either store is out.
    expect(text.includes('not yet in the stores')).toBe(
      links.appStore === undefined && links.googlePlay === undefined,
    )
    for (const url of Object.values(links)) {
      expect(text, `llms.txt does not link ${url}`).toContain(`(${url})`)
    }
    if (links.appStore === undefined) {
      expect(text).not.toContain('apps.apple.com')
    }
    if (links.googlePlay === undefined) {
      expect(text).not.toContain('play.google.com')
    }
  })
})
