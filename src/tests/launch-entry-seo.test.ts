import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

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
    expect(vite).toContain(
      "vocalRangeTest: resolve(__dirname, 'vocal-range-test.html')",
    )
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

  // Both instrument rooms were `noindex, nofollow` pilots until 2026-08-20.
  // They are listed now, so what is worth pinning is that each one is *safe* to
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
      vitePaths: "PIANO_NIGHT_PATHS = new Set(['/piano-night'])",
      viteInput: "pianoNight: resolve(__dirname, 'piano-night.html')",
    },
    {
      room: 'Guitar Night',
      file: 'guitar-night.html',
      path: 'guitar-night',
      entry: '/src/features/guitar-night/main.tsx',
      vitePaths: "GUITAR_NIGHT_PATHS = new Set(['/guitar-night'])",
      viteInput: "guitarNight: resolve(__dirname, 'guitar-night.html')",
    },
  ] as const

  for (const room of INSTRUMENT_ROOMS) {
    it(`indexes ${room.room} from a self-canonical document with a share card`, () => {
      const document = repoHtml(room.file)
      const vite = repoFile('vite.config.ts')
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
      expect(vite).toContain(room.vitePaths)
      expect(vite).toContain(room.viteInput)
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

  it('builds Drum Night from a dedicated noindex playable document', () => {
    const document = repoHtml('drum-night.html')
    const vite = repoFile('vite.config.ts')
    const serviceWorker = repoFile('src/lib/sw-runtime.ts')
    const sitemap = repoFile('public/sitemap.xml')

    expect(document.title).toBe('Drum Night — MercuryPitch')
    expect(
      document.querySelector('link[rel="canonical"]')?.getAttribute('href'),
    ).toBe('https://mercurypitch.com/drum-night')
    expect(
      document.querySelector('meta[name="robots"]')?.getAttribute('content'),
    ).toBe('noindex, nofollow')
    expect(
      document
        .querySelector('meta[name="description"]')
        ?.getAttribute('content'),
    ).toContain('drum room for touch, keys and e-kits')
    expect(
      document.querySelector('script[type="module"]')?.getAttribute('src'),
    ).toBe('/src/features/drum-night/main.tsx')
    expect(vite).toContain("DRUM_NIGHT_PATHS = new Set(['/drum-night'])")
    expect(vite).toContain("drumNight: resolve(__dirname, 'drum-night.html')")
    expect(serviceWorker).toContain("'/drum-night'")
    expect(serviceWorker).toContain("'/drum-night.html'")
    expect(sitemap).not.toContain('mercurypitch.com/drum-night')
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

  // Everything the nav offers is `index, follow` and in the sitemap. Drum Night
  // is neither, so nothing links to it: a nofollow pilot collecting internal
  // links from nine indexed documents is a contradiction a crawler notices.
  const SIBLING_PATHS = [
    '/',
    '/mirror',
    '/vocal-range-test',
    '/karaoke-night',
    '/glass',
    '/piano-night',
    '/guitar-night',
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
      // A noindex, nofollow pilot must not collect internal links.
      expect(hrefs).not.toContain('/drum-night')
    })

    it(`hides ${file}'s prelude the moment the app mounts`, () => {
      // The selector is the whole contract: the prelude must be a later sibling
      // of #root, and #root must be empty in the file, or the rule never fires
      // and the room renders under a stack of loading text.
      const raw = repoFile(file)
      expect(raw).toContain('#root:not(:empty) ~ .entry-prelude')
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
