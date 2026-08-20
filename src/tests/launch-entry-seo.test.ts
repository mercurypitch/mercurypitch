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

  it('builds Drum Night from a dedicated noindex pilot document', () => {
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
    ).toContain('interactive visual pilot')
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
