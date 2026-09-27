// ============================================================
// The native app's examples: the bundle, then the server over it
// ============================================================
//
// `mergeExampleManifests` decides what going online may change about a song
// the app already carries (plan S8 §8, D13 A). The stems of a bundled song
// must never be traded for the server's: they are what plays on a plane.

import { describe, expect, it } from 'vitest'
import type { BundledExample } from './bundled-examples'
import type { DemoSongManifest } from './demo-song'
import { mergeExampleManifests } from './examples-library'

const credit = (text: string) => ({
  text,
  url: 'https://example.test/song',
  license: 'CC BY 4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
})

function bundled(
  slug: string,
  over: Partial<BundledExample> = {},
): BundledExample {
  return {
    slug,
    title: `Title ${slug}`,
    artist: 'Josh Woodward',
    attribution: credit(`Music: ${slug}`),
    durationSec: 240,
    lyricsRevision: 2,
    lyricsText: `[00:01.00] ${slug} from the bundle`,
    stems: {
      vocal: `/karaoke/examples/${slug}/vocal.m4a`,
      instrumental: `/karaoke/examples/${slug}/instrumental.m4a`,
    },
    ...over,
  }
}

function served(
  slug: string | undefined,
  over: Partial<DemoSongManifest> = {},
): DemoSongManifest {
  return {
    slug,
    title: `Title ${slug ?? 'legacy'}`,
    artist: 'Josh Woodward',
    attribution: credit(`Music: ${slug ?? 'legacy'} (from the server)`),
    stems: {
      vocal: `https://r2.example/demo/${slug}/vocal.m4a`,
      instrumental: `https://r2.example/demo/${slug}/instrumental.m4a`,
    },
    lyricsRevision: 2,
    lyricsText: `[00:01.00] ${slug} from the server`,
    ...over,
  }
}

describe('the examples, merged', () => {
  it("keeps a bundled song's stems whatever the server says", () => {
    const [song] = mergeExampleManifests(
      [bundled('josephine')],
      [served('josephine', { lyricsRevision: 9 })],
    )
    expect(song.stems).toEqual({
      vocal: '/karaoke/examples/josephine/vocal.m4a',
      instrumental: '/karaoke/examples/josephine/instrumental.m4a',
    })
    expect(song.durationSec).toBe(240)
  })

  it("takes the server's lyrics only at a higher revision", () => {
    const at = (revision: number) =>
      mergeExampleManifests(
        [bundled('josephine')],
        [served('josephine', { lyricsRevision: revision })],
      )[0]
    expect(at(3).lyricsText).toBe('[00:01.00] josephine from the server')
    expect(at(3).lyricsRevision).toBe(3)
    expect(at(2).lyricsText).toBe('[00:01.00] josephine from the bundle')
    expect(at(2).lyricsRevision).toBe(2)
    expect(at(1).lyricsText).toBe('[00:01.00] josephine from the bundle')
  })

  it('takes a lyrics file of a higher revision, dropping the older text', () => {
    const [song] = mergeExampleManifests(
      [bundled('josephine')],
      [
        served('josephine', {
          lyricsRevision: 3,
          lyricsText: undefined,
          lyrics: 'https://r2.example/demo/josephine/lyrics.lrc',
        }),
      ],
    )
    expect(song.lyrics).toBe('https://r2.example/demo/josephine/lyrics.lrc')
    expect(song.lyricsText).toBeUndefined()
  })

  it('ignores a higher revision that carries no lyrics at all', () => {
    const [song] = mergeExampleManifests(
      [bundled('josephine')],
      [served('josephine', { lyricsRevision: 5, lyricsText: '  ' })],
    )
    expect(song.lyricsText).toBe('[00:01.00] josephine from the bundle')
    expect(song.lyricsRevision).toBe(2)
  })

  it("takes the server's credit when it has one", () => {
    const [corrected] = mergeExampleManifests(
      [bundled('josephine')],
      [served('josephine')],
    )
    expect(corrected.attribution.text).toBe(
      'Music: josephine (from the server)',
    )
    const [kept] = mergeExampleManifests(
      [bundled('josephine')],
      [served('josephine', { attribution: credit('') })],
    )
    expect(kept.attribution.text).toBe('Music: josephine')
  })

  it("puts the bundle first, then the server's own songs in its order", () => {
    const merged = mergeExampleManifests(
      [bundled('karaoke-night'), bundled('josephine')],
      [served('nothing-in-the-dark'), served('josephine'), served('new-song')],
    )
    expect(merged.map((song) => song.slug)).toEqual([
      'karaoke-night',
      'josephine',
      'nothing-in-the-dark',
      'new-song',
    ])
    expect(merged[2].stems.vocal).toBe(
      'https://r2.example/demo/nothing-in-the-dark/vocal.m4a',
    )
  })

  it('knows the legacy song whose server row has no slug', () => {
    // `demoSessionId(undefined)` and `demoSessionId('karaoke-night')` are the
    // same row; matching on the slug text would add the song twice.
    const merged = mergeExampleManifests(
      [bundled('karaoke-night')],
      [served(undefined, { lyricsRevision: 3 })],
    )
    expect(merged).toHaveLength(1)
    expect(merged[0].lyricsRevision).toBe(3)
    expect(merged[0].stems.vocal).toBe(
      '/karaoke/examples/karaoke-night/vocal.m4a',
    )
  })

  it('keeps a bundled song the server no longer lists', () => {
    const merged = mergeExampleManifests(
      [bundled('karaoke-night'), bundled('josephine')],
      [served('karaoke-night')],
    )
    expect(merged.map((song) => song.slug)).toEqual([
      'karaoke-night',
      'josephine',
    ])
  })

  it('adds a server song once, however often it is listed', () => {
    const merged = mergeExampleManifests(
      [],
      [served('new-song'), served('new-song')],
    )
    expect(merged).toHaveLength(1)
  })
})
