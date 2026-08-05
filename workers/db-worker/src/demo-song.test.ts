// The demo song's two quiet decisions.
//
// Neither throws when it is wrong. A revision that moves too eagerly
// re-seeds every visitor's lyrics for a title typo; one that never moves
// leaves an authored correction stranded on the server forever. And a
// projection that drops `active` makes the studio show a parked row as
// live, so the next save re-arms it without anybody asking.

import { describe, expect, it } from 'vitest'
import type { DemoSongRow } from './demo-song'
import { demoSongValues, nextLyricsRevision, publicDemoSong } from './demo-song'

const row = (over: Partial<DemoSongRow> = {}): DemoSongRow => ({
  id: 'row-1',
  slug: 'karaoke-night',
  title: 'Sing Along',
  artist: 'A Friend',
  attributionText: 'A Friend, CC BY 4.0',
  attributionUrl: 'https://example.test/source',
  licenseName: 'CC BY 4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
  vocalUrl: 'https://r2.test/vocal.m4a',
  instrumentalUrl: 'https://r2.test/instrumental.m4a',
  lyricsUrl: 'https://r2.test/lyrics.lrc',
  lyricsText: null,
  lyricsRevision: 3,
  durationSec: 214,
  active: 1,
  updatedAt: '2026-08-01T00:00:00.000Z',
  ...over,
})

describe('nextLyricsRevision', () => {
  it('starts a first row at 1, above the shipped manifest', () => {
    expect(nextLyricsRevision(null, 'https://r2.test/l.lrc', null)).toBe(1)
    expect(nextLyricsRevision(null, null, null)).toBe(1)
  })

  it('holds still when the lyrics are untouched', () => {
    const existing = row({ lyricsUrl: 'https://r2.test/l.lrc', lyricsText: null })
    expect(nextLyricsRevision(existing, 'https://r2.test/l.lrc', null)).toBe(3)
  })

  it('moves when the lyrics URL changes', () => {
    const existing = row({ lyricsUrl: 'https://r2.test/old.lrc' })
    expect(nextLyricsRevision(existing, 'https://r2.test/new.lrc', null)).toBe(4)
  })

  it('moves when pasted lyrics change', () => {
    const existing = row({ lyricsUrl: null, lyricsText: 'one line' })
    expect(nextLyricsRevision(existing, null, 'one line, fixed')).toBe(4)
  })

  it('moves when lyrics are cleared', () => {
    const existing = row({ lyricsText: 'one line' })
    expect(nextLyricsRevision(existing, existing.lyricsUrl, null)).toBe(4)
  })

  it('does not move for an unrelated edit', () => {
    // The regression this guards: bumping on every save would re-seed
    // every visitor because somebody fixed a licence URL.
    const existing = row()
    expect(
      nextLyricsRevision(existing, existing.lyricsUrl, existing.lyricsText),
    ).toBe(existing.lyricsRevision)
  })
})

describe('publicDemoSong', () => {
  it('reports a parked row as parked', () => {
    expect(publicDemoSong(row({ active: 0 })).active).toBe(false)
    expect(publicDemoSong(row({ active: 1 })).active).toBe(true)
  })

  it('gives absent stems as empty strings, not null', () => {
    // `demoIsPlayable` on the client tests `(stems.vocal ?? '') !== ''`;
    // both shapes work there, but the manifest that ships uses strings and
    // the two sources must be indistinguishable to the page.
    const projected = publicDemoSong(row({ vocalUrl: null, instrumentalUrl: null }))
    expect(projected.stems).toEqual({ vocal: '', instrumental: '' })
  })

  it('carries the attribution the licence requires', () => {
    expect(publicDemoSong(row()).attribution).toEqual({
      text: 'A Friend, CC BY 4.0',
      url: 'https://example.test/source',
      license: 'CC BY 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    })
  })
})

describe('demoSongValues', () => {
  it('stores a blank optional field as NULL, not an empty string', () => {
    const values = demoSongValues({ title: 'T', artist: 'A', lyricsUrl: '  ' })
    expect(values.lyricsUrl).toBeNull()
    expect(values.vocalUrl).toBeNull()
  })

  it('trims the title and artist', () => {
    const values = demoSongValues({ title: '  T  ', artist: '  A  ' })
    expect(values.title).toBe('T')
    expect(values.artist).toBe('A')
  })

  it('keeps a row live unless it is explicitly parked', () => {
    expect(demoSongValues({ title: 'T', artist: 'A' }).active).toBe(1)
    expect(demoSongValues({ title: 'T', artist: 'A', active: true }).active).toBe(1)
    expect(demoSongValues({ title: 'T', artist: 'A', active: false }).active).toBe(0)
    expect(demoSongValues({ title: 'T', artist: 'A', active: 0 }).active).toBe(0)
  })

  it('rejects a non-numeric duration rather than storing NaN', () => {
    expect(demoSongValues({ durationSec: '214' }).durationSec).toBeNull()
    expect(demoSongValues({ durationSec: Number.NaN }).durationSec).toBeNull()
    expect(demoSongValues({ durationSec: 214.6 }).durationSec).toBe(215)
  })
})
