import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { canonicalPath, ENTRY_PAGES, navLinksFor } from '@/seo/entry-pages'
import { renderEntryPage } from '@/seo/render-entry-page'

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
      expect(page.title.length, `${page.slug} title`).toBeLessThanOrEqual(80)
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
