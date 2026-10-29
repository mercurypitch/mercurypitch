// ============================================================
// Experimental features tests — the production web build serves Studio and lists it nowhere
// ============================================================
//
// Run against the real public/ files and the hand-written index.html, so a
// format change there fails here before it fails a release build.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { renderErrorPage } from '../src/error-kit/render-error-page'
import { EXPERIMENTAL_FEATURES } from '../src/lib/experimental-features'
import { ENTRY_PAGES, navLinksFor } from '../src/seo/entry-pages'
import { renderEntryPage } from '../src/seo/render-entry-page'
import { EXPERIMENTAL_ENTRY_SLUGS, isExperimentalFeaturesOn, pointsAt, stripLlmsEntry, stripNavLink, stripSitemapEntry, unlistedExperimentSlugs, } from './experimental-features'

const repoFile = (path: string): string =>
  readFileSync(resolve(__dirname, '..', path), 'utf8')

const studio = ENTRY_PAGES.find((page) => page.slug === 'studio-night')!

describe('the experimental features switch', () => {
  it('turns features on only on an explicit "1" or "true"', () => {
    expect(isExperimentalFeaturesOn('1')).toBe(true)
    expect(isExperimentalFeaturesOn('true')).toBe(true)
    expect(isExperimentalFeaturesOn(' TRUE ')).toBe(true)
    for (const value of [undefined, '', '0', 'false', 'no', 'yes'])
      expect(isExperimentalFeaturesOn(value)).toBe(false)
  })

  it('sets it on for development mode and off for production mode', () => {
    expect(repoFile('.env.development')).toMatch(
      /^VITE_EXPERIMENTAL_FEATURES=1$/m,
    )
    expect(repoFile('.env.production')).toMatch(
      /^VITE_EXPERIMENTAL_FEATURES=0$/m,
    )
  })

  it('pins it off for the native app', () => {
    expect(repoFile('apps/mercurypitch/vite.config.ts')).toContain(
      "'import.meta.env.VITE_EXPERIMENTAL_FEATURES': JSON.stringify('0')",
    )
  })

  it('asserts the matching state on every deploy build', () => {
    const scripts = (
      JSON.parse(repoFile('package.json')) as {
        scripts: Record<string, string>
      }
    ).scripts
    expect(scripts.build).toContain(
      'assert-experimental-features.mjs dist --off',
    )
    expect(scripts['build:tours']).toContain(
      'assert-experimental-features.mjs dist --off',
    )
    expect(scripts['build:dev']).toContain(
      'assert-experimental-features.mjs dist --on',
    )
    expect(scripts['build:e2e']).toContain('VITE_EXPERIMENTAL_FEATURES=1')
    expect(scripts['build:e2e']).toContain(
      'assert-experimental-features.mjs dist --on',
    )
  })

  it('names a page for every feature, each one an entry page, and the dist check names the same pages', () => {
    const slugs = ENTRY_PAGES.map((page) => page.slug)
    const assertScript = repoFile('scripts/assert-experimental-features.mjs')
    expect(Object.keys(EXPERIMENTAL_ENTRY_SLUGS).sort()).toEqual(
      [...EXPERIMENTAL_FEATURES].sort(),
    )
    for (const owned of Object.values(EXPERIMENTAL_ENTRY_SLUGS)) {
      for (const slug of owned) {
        expect(slugs).toContain(slug)
        expect(assertScript).toContain(`'${slug}'`)
      }
    }
  })

  it('keeps every feature page unlisted with the switch off, and none with it on', () => {
    expect(unlistedExperimentSlugs(false)).toEqual(['studio-night'])
    expect(unlistedExperimentSlugs(true)).toEqual([])
  })
})

describe('a build with experimental features off', () => {
  it('drops Studio from the sitemap and nothing else', () => {
    const source = repoFile('public/sitemap.xml')
    const { text, removed } = stripSitemapEntry(source, 'studio-night')

    expect(removed).toBe(true)
    expect(pointsAt(text, 'studio-night')).toBe(false)
    expect(text).toContain('<loc>https://mercurypitch.com/ear-lab</loc>')
    expect(text).toContain('<loc>https://mercurypitch.com/jam</loc>')
    // The Jam comment belongs to the Jam block below Studio's: it stays.
    expect(text).toContain('<!-- Jam Rooms:')
    const urls = (xml: string) => xml.match(/<url>/g)?.length ?? 0
    expect(urls(text)).toBe(urls(source) - 1)
    expect(text.trimEnd().endsWith('</urlset>')).toBe(true)
  })

  it('drops Studio from llms.txt and keeps its neighbours whole', () => {
    const source = repoFile('public/llms.txt')
    const { text, removed } = stripLlmsEntry(source, 'studio-night')

    expect(removed).toBe(true)
    expect(pointsAt(text, 'studio-night')).toBe(false)
    expect(text).not.toContain('project backup with its copied audio')
    expect(text).toContain(
      '- [Voice Mirror](https://mercurypitch.com/mirror): Sing one note and watch a',
    )
    expect(text).toContain('## Rooms\n\n- [Voice Mirror]')
  })

  it("drops Studio from index.html's prelude nav, one line and nothing else", () => {
    const source = repoFile('index.html')
    const { text, removed } = stripNavLink(source, 'studio-night')

    expect(removed).toBe(true)
    expect(text).not.toContain('href="/studio-night"')
    expect(text).toContain('<a href="/ear-lab">Ear Lab</a>')
    expect(text).toContain('<a href="/jam">Jam Rooms</a>')
    expect(source.split('\n').length - text.split('\n').length).toBe(1)
  })

  it('leaves a page whose slug merely starts the same way', () => {
    const html = '  <a href="/studio-night-two">Two</a>\n'
    expect(stripNavLink(html, 'studio-night')).toEqual({
      text: html,
      removed: false,
    })
    expect(pointsAt(html, 'studio-night')).toBe(false)
  })

  it('still renders the Studio document, marked noindex, booting the app into Studio', () => {
    const unlisted = unlistedExperimentSlugs(false)
    const document = renderEntryPage(studio, { unlisted })

    expect(document).toContain(
      '<meta name="robots" content="noindex, follow" />',
    )
    expect(document).toContain(
      '<link rel="canonical" href="https://mercurypitch.com/studio-night" />',
    )
    expect(document).toContain('<script type="module" src="/src/index.tsx">')
    expect(document).toContain('#/studio-night')
    // It still links out to every other room.
    expect(document).toContain('href="/karaoke-night"')
  })

  it('links Studio from no other entry document and not from the 404', () => {
    const unlisted = unlistedExperimentSlugs(false)
    for (const page of ENTRY_PAGES.filter((entry) => entry !== studio)) {
      const document = renderEntryPage(page, { unlisted })
      expect(pointsAt(document, 'studio-night'), page.slug).toBe(false)
      expect(
        navLinksFor(page, unlisted).map((link) => link.label),
        page.slug,
      ).not.toContain('Studio')
    }
    const notFound = renderErrorPage('not-found', { unlisted })
    expect(pointsAt(notFound, 'studio-night')).toBe(false)
    expect(notFound).toContain('href="/jam"')
  })
})

describe('a build with experimental features on', () => {
  it('renders every entry document exactly as before, Studio linked and indexed', () => {
    const unlisted = unlistedExperimentSlugs(true)
    for (const page of ENTRY_PAGES) {
      const document = renderEntryPage(page, { unlisted })
      expect(document).toBe(renderEntryPage(page))
      if (page !== studio)
        expect(document, page.slug).toContain('href="/studio-night"')
    }
    expect(renderEntryPage(studio, { unlisted })).toContain(
      '<meta name="robots" content="index, follow" />',
    )
    expect(renderErrorPage('not-found', { unlisted })).toContain(
      'href="/studio-night"',
    )
  })
})
