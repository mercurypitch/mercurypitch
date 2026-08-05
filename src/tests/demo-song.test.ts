// The Karaoke Night demo song: which source wins, and when an authored
// lyric correction is allowed to overwrite what is already on the device.
//
// The seeding rule is the delicate one. Anything stored under the demo
// session id may be the visitor's own edit or their own upload, and those
// must survive forever. But before revisions existed there was no way for
// a corrected lyric to reach anyone who had already sung the demo — the
// seed simply gave up whenever a row existed. `shouldSeedLyrics` is the
// narrow opening that fixes that without ever taking somebody's work.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DemoSongManifest } from '@/features/karaoke-night/demo-song'
import { DEMO_SESSION_ID, demoIsPlayable, demoSessionId, isDemoSessionId, LEGACY_SLUG, loadDemoSong, loadDemoSongs, shouldSeedLyrics, } from '@/features/karaoke-night/demo-song'

const SHIPPED: DemoSongManifest = {
  title: 'Shipped Demo',
  artist: 'The Build',
  attribution: { text: '', url: '', license: '', licenseUrl: '' },
  stems: {
    vocal: 'https://r2.test/ship-v.m4a',
    instrumental: 'https://r2.test/ship-i.m4a',
  },
}

const stamp = (revision: number, text: string) => ({ revision, text })

describe('shouldSeedLyrics', () => {
  it('seeds when there is nothing stored yet', () => {
    expect(shouldSeedLyrics(null, null, 1)).toBe(true)
    expect(shouldSeedLyrics(null, stamp(9, 'anything'), 1)).toBe(true)
  })

  it('leaves an unstamped copy alone — provenance unknown', () => {
    // Seeded before revisions existed, or written by an older build. It
    // could be the visitor's own upload, so it is never guessed at.
    expect(shouldSeedLyrics('some lyrics', null, 5)).toBe(false)
  })

  it('does not re-seed the same revision', () => {
    expect(shouldSeedLyrics('seeded text', stamp(3, 'seeded text'), 3)).toBe(
      false,
    )
    expect(shouldSeedLyrics('seeded text', stamp(4, 'seeded text'), 3)).toBe(
      false,
    )
  })

  it('replaces an untouched copy when the revision moves', () => {
    expect(shouldSeedLyrics('seeded text', stamp(2, 'seeded text'), 3)).toBe(
      true,
    )
  })

  it("never replaces the visitor's own edit, however far the revision moves", () => {
    expect(shouldSeedLyrics('my own words', stamp(2, 'seeded text'), 3)).toBe(
      false,
    )
    expect(shouldSeedLyrics('my own words', stamp(2, 'seeded text'), 99)).toBe(
      false,
    )
  })

  it('treats a whitespace-only difference as an edit', () => {
    // Deliberate: the comparison is exact. Re-seeding over a trimmed or
    // re-indented copy would still be taking work that is not ours.
    expect(shouldSeedLyrics('seeded text ', stamp(1, 'seeded text'), 2)).toBe(
      false,
    )
  })
})

describe('demoIsPlayable', () => {
  it('needs both stems', () => {
    expect(demoIsPlayable(SHIPPED)).toBe(true)
    expect(demoIsPlayable({ ...SHIPPED, stems: { vocal: 'v' } })).toBe(false)
    expect(demoIsPlayable({ ...SHIPPED, stems: { instrumental: 'i' } })).toBe(
      false,
    )
    expect(demoIsPlayable({ ...SHIPPED, stems: {} })).toBe(false)
    expect(demoIsPlayable(null)).toBe(false)
  })
})

describe('demoSessionId', () => {
  // The load-bearing case. Every visitor who has ever sung the demo has
  // lyrics, pitch analysis and takes in their local db keyed by the bare
  // id. If the original song ever started producing a suffixed id, all of
  // that would be silently orphaned — no error, just a page that has
  // forgotten what they did.
  it('keeps the historic bare id for the original song', () => {
    expect(demoSessionId(LEGACY_SLUG)).toBe(DEMO_SESSION_ID)
    expect(demoSessionId(undefined)).toBe(DEMO_SESSION_ID)
    expect(demoSessionId('')).toBe(DEMO_SESSION_ID)
    expect(demoSessionId('  ')).toBe(DEMO_SESSION_ID)
  })

  it('namespaces every later song under it', () => {
    expect(demoSessionId('second-song')).toBe(`${DEMO_SESSION_ID}:second-song`)
    expect(demoSessionId(' second-song ')).toBe(
      `${DEMO_SESSION_ID}:second-song`,
    )
  })

  it('recognises its own ids, and only those', () => {
    expect(isDemoSessionId(DEMO_SESSION_ID)).toBe(true)
    expect(isDemoSessionId(demoSessionId('second-song'))).toBe(true)
    expect(isDemoSessionId('karaoke-night-demo-2')).toBe(false)
    expect(isDemoSessionId('uvr-1234')).toBe(false)
    expect(isDemoSessionId('')).toBe(false)
  })
})

describe('loadDemoSongs', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('falls back to the shipped manifest as a one-song list', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify(SHIPPED), { status: 200 })),
    )
    const songs = await loadDemoSongs()
    expect(songs).toHaveLength(1)
    expect(songs[0]).toMatchObject({ title: 'Shipped Demo' })
  })

  it('returns an empty list rather than throwing when nothing is reachable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('offline')
      }),
    )
    await expect(loadDemoSongs()).resolves.toEqual([])
  })
})

describe('loadDemoSong', () => {
  // VITE_API_BASE_URL is blanked for the test run, so the API branch is
  // skipped and every case here exercises the shipped-manifest floor —
  // which is exactly the path that must never break the page.
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('falls back to the shipped manifest', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify(SHIPPED), { status: 200 })),
    )
    await expect(loadDemoSong()).resolves.toMatchObject({
      title: 'Shipped Demo',
    })
  })

  it('returns null rather than throwing when the manifest is unreachable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('offline')
      }),
    )
    await expect(loadDemoSong()).resolves.toBeNull()
  })

  it('rejects a malformed manifest instead of half-loading it', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ artist: 'no title' }), { status: 200 }),
      ),
    )
    await expect(loadDemoSong()).resolves.toBeNull()
  })
})
