// ============================================================
// Glassworks listing tests — the production web build hides every link to the museum
// ============================================================
//
// Run against the real public/ files and hand-written documents, so a format
// change there fails here before it fails a release build.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ENTRY_PAGES, navLinksFor } from '../src/seo/entry-pages'
import { renderEntryPage } from '../src/seo/render-entry-page'
import { isGlassworksListed, stripGlassworksFromLlms, stripGlassworksFromSitemap, stripGlassworksNavLink, unlistedEntrySlugs, } from './glassworks-listing'

const repoFile = (path: string): string =>
  readFileSync(resolve(__dirname, '..', path), 'utf8')

const glassGame = ENTRY_PAGES.find((page) => page.slug === 'glass-game')!

describe('the Glassworks listing switch', () => {
  it('lists only on an explicit "1" or "true"', () => {
    expect(isGlassworksListed('1')).toBe(true)
    expect(isGlassworksListed('true')).toBe(true)
    expect(isGlassworksListed(' TRUE ')).toBe(true)
    for (const value of [undefined, '', '0', 'false', 'no', 'yes'])
      expect(isGlassworksListed(value)).toBe(false)
  })

  it('sets it on for development mode and off for production mode', () => {
    expect(repoFile('.env.development')).toMatch(/^VITE_GLASSWORKS_LISTED=1$/m)
    expect(repoFile('.env.production')).toMatch(/^VITE_GLASSWORKS_LISTED=0$/m)
  })

  it('asserts the matching state on every deploy build', () => {
    const scripts = (
      JSON.parse(repoFile('package.json')) as {
        scripts: Record<string, string>
      }
    ).scripts
    expect(scripts.build).toContain(
      'assert-glassworks-listing.mjs dist --unlisted',
    )
    expect(scripts['build:dev']).toContain(
      'assert-glassworks-listing.mjs dist --listed',
    )
    expect(scripts['build:e2e']).toContain('VITE_GLASSWORKS_LISTED=1')
    expect(scripts['build:e2e']).toContain(
      'assert-glassworks-listing.mjs dist --listed',
    )
  })
})

describe('an unlisted build', () => {
  it('drops the museum from the sitemap and nothing else', () => {
    const source = repoFile('public/sitemap.xml')
    const { text, removed } = stripGlassworksFromSitemap(source)

    expect(removed).toBe(true)
    expect(text).not.toContain('/glass-game')
    expect(text).not.toContain('Glassworks')
    expect(text).toContain('<loc>https://mercurypitch.com/glass</loc>')
    const urls = (xml: string) => xml.match(/<url>/g)?.length ?? 0
    expect(urls(text)).toBe(urls(source) - 1)
    expect(text.trimEnd().endsWith('</urlset>')).toBe(true)
  })

  it('drops the museum from llms.txt and keeps its neighbours whole', () => {
    const source = repoFile('public/llms.txt')
    const { text, removed } = stripGlassworksFromLlms(source)

    expect(removed).toBe(true)
    expect(text).not.toContain('/glass-game')
    expect(text).not.toContain('Glassworks')
    expect(text).toContain(
      '- [Karaoke Night](https://mercurypitch.com/karaoke-night): Turn a song you',
    )
    expect(text).toContain(
      '- [Break Glass](https://mercurypitch.com/glass): A sixty-second challenge that',
    )
  })

  it.each(['index.html', '404.html'])(
    "drops the museum from %s's prelude nav",
    (file) => {
      const source = repoFile(file)
      const { text, removed } = stripGlassworksNavLink(source)

      expect(removed).toBe(true)
      expect(text).not.toContain('href="/glass-game"')
      expect(text).toContain('<a href="/glass">Break Glass</a>')
      expect(source.split('\n').length - text.split('\n').length).toBe(1)
    },
  )

  it('still renders the museum document, marked noindex', () => {
    const unlisted = unlistedEntrySlugs(false)
    const document = renderEntryPage(glassGame, { unlisted })

    expect(document).toContain(
      '<meta name="robots" content="noindex, follow" />',
    )
    expect(document).toContain(
      '<link rel="canonical" href="https://mercurypitch.com/glass-game" />',
    )
    expect(document).toContain(
      '<script type="module" src="/src/features/glass-adventure/main.tsx">',
    )
    // It still links out to every other room.
    expect(document).toContain('href="/karaoke-night"')
  })

  it('links the museum from no other entry document', () => {
    const unlisted = unlistedEntrySlugs(false)
    for (const page of ENTRY_PAGES.filter((entry) => entry !== glassGame)) {
      const document = renderEntryPage(page, { unlisted })
      expect(document, page.slug).not.toContain('href="/glass-game"')
      expect(document, page.slug).toContain(
        '<meta name="robots" content="index, follow" />',
      )
      expect(
        navLinksFor(page, unlisted).map((link) => link.label),
      ).not.toContain('Glassworks')
    }
  })
})

describe('a listed build', () => {
  it('renders every entry document exactly as before', () => {
    const unlisted = unlistedEntrySlugs(true)
    expect(unlisted).toEqual([])
    for (const page of ENTRY_PAGES) {
      const document = renderEntryPage(page, { unlisted })
      expect(document).toBe(renderEntryPage(page))
      expect(document).toContain(
        '<meta name="robots" content="index, follow" />',
      )
      if (page !== glassGame)
        expect(document, page.slug).toContain('href="/glass-game"')
    }
  })
})
