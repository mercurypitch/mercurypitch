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
      'Free Vocal Range Test — Find Your Lowest & Highest Note | MercuryPitch',
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
})
