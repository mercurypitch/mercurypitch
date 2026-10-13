// ============================================================
// Example song links — which slug names which song
// ============================================================
//
// REQ-SKL-012. The manifest list here mirrors the studio's published one
// (2026-10-13): the original demo under the legacy slug, then two more.

import { describe, expect, it } from 'vitest'
import { DEMO_SESSION_ID } from '@/lib/example-session'
import type { DemoSongManifest } from './demo-song'
import { demoSessionId } from './demo-song'
import { exampleLinkSlug, findExampleBySongSlug, LEGACY_LINK_SLUG, } from './example-links'

function manifest(
  slug: string | undefined,
  title: string,
  over: Partial<DemoSongManifest> = {},
): DemoSongManifest {
  return {
    ...(slug === undefined ? {} : { slug }),
    title,
    artist: 'Josh Woodward',
    attribution: { text: '', url: '', license: '', licenseUrl: '' },
    stems: {
      vocal: `https://r2.example/${title}/vocal.m4a`,
      instrumental: `https://r2.example/${title}/instrumental.m4a`,
    },
    ...over,
  }
}

const goodbye = manifest('karaoke-night', 'Goodbye to Spring')
const josephine = manifest('josephine', "I'll Be Right Behind You, Josephine")
const nothing = manifest('nothing-in-the-dark', 'Nothing in the Dark')
const published = [goodbye, josephine, nothing]

describe('exampleLinkSlug', () => {
  it('uses the manifest slug', () => {
    expect(exampleLinkSlug(nothing)).toBe('nothing-in-the-dark')
    expect(exampleLinkSlug(josephine)).toBe('josephine')
  })

  it('gives the original demo a name instead of the page name', () => {
    // `/karaoke-night?song=karaoke-night` says nothing about the song.
    expect(exampleLinkSlug(goodbye)).toBe(LEGACY_LINK_SLUG)
    expect(LEGACY_LINK_SLUG).toBe('goodbye-to-spring')
    // The shipped manifest carries no slug at all; same song, same link.
    expect(exampleLinkSlug(manifest(undefined, 'Goodbye to Spring'))).toBe(
      'goodbye-to-spring',
    )
  })
})

describe('findExampleBySongSlug', () => {
  it('finds every published example by its link slug', () => {
    for (const song of published) {
      const found = findExampleBySongSlug(exampleLinkSlug(song), published)
      expect(found, exampleLinkSlug(song)).toBe(song)
    }
  })

  it('maps the original demo to the session id it has always had', () => {
    const found = findExampleBySongSlug('goodbye-to-spring', published)
    expect(demoSessionId(found?.slug)).toBe(DEMO_SESSION_ID)
  })

  it('also answers to the legacy manifest slug', () => {
    expect(findExampleBySongSlug('karaoke-night', published)).toBe(goodbye)
    // The shipped-manifest fallback, which has no slug.
    const shipped = manifest(undefined, 'Goodbye to Spring')
    expect(findExampleBySongSlug('goodbye-to-spring', [shipped])).toBe(shipped)
    expect(findExampleBySongSlug('karaoke-night', [shipped])).toBe(shipped)
  })

  it('returns null for a slug nobody published', () => {
    expect(findExampleBySongSlug('not-a-song', published)).toBeNull()
    expect(findExampleBySongSlug(null, published)).toBeNull()
    expect(findExampleBySongSlug('josephine', [])).toBeNull()
  })

  it('returns null for an example that is not playable', () => {
    const parked = manifest('josephine', 'Josephine', {
      stems: { vocal: '', instrumental: 'x.m4a' },
    })
    expect(findExampleBySongSlug('josephine', [parked])).toBeNull()
  })

  it('prefers a real slug over the legacy alias', () => {
    // Should the studio ever publish a song under `goodbye-to-spring`
    // itself, that row wins: an alias must not shadow a real name.
    const real = manifest('goodbye-to-spring', 'Goodbye to Spring (new)')
    expect(findExampleBySongSlug('goodbye-to-spring', [goodbye, real])).toBe(
      real,
    )
  })
})
