// ============================================================
// Reading the bundle's manifest: a bad song is dropped, not the list
// ============================================================
//
// The manifest ships inside the app, so it is read as a packaged file is
// inside the iOS WebView: status 0, ok false, and its bytes (audit K2).

import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadBundledExamples } from './bundled-examples'

const song = (slug: string, extra: Record<string, unknown> = {}) => ({
  slug,
  title: `Song ${slug}`,
  artist: 'Test Artist',
  attribution: {
    text: 'Test credit',
    url: 'https://example.invalid/credit',
    license: 'CC BY 4.0',
    licenseUrl: 'https://example.invalid/licence',
  },
  stems: {
    vocal: `/karaoke/examples/${slug}-vocal.m4a`,
    instrumental: `/karaoke/examples/${slug}-instrumental.m4a`,
  },
  ...extra,
})

/** The manifest, answered the way a packaged file answers. */
function serve(manifest: unknown): void {
  const bytes = new TextEncoder().encode(JSON.stringify(manifest))
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      Promise.resolve({
        ok: false,
        status: 0,
        headers: new Headers(),
        body: null,
        arrayBuffer: async () => Promise.resolve(bytes.buffer),
      }),
    ),
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('the bundled manifest', () => {
  it('drops a song it cannot play and keeps the rest, in order', async () => {
    serve({
      version: 1,
      songs: [
        song('first'),
        song('no-vocal', {
          stems: { instrumental: '/karaoke/examples/i.m4a' },
        }),
        song('second'),
        song('', { title: 'No slug' }),
        song('no-title', { title: ' ' }),
        song('no-stems', { stems: null }),
        song('no-credit', { attribution: null }),
      ],
    })

    const songs = await loadBundledExamples()

    expect(songs.map((entry) => entry.slug)).toEqual(['first', 'second'])
  })

  it('reads nothing from a manifest of another version', async () => {
    serve({ version: 2, songs: [song('first')] })

    expect(await loadBundledExamples()).toEqual([])
  })

  it('reads nothing, quietly, when the manifest is not there', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))),
    )

    expect(await loadBundledExamples()).toEqual([])
  })
})
