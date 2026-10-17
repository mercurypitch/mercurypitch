// ============================================================
// OG Tags Tests
// ============================================================

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { initDefaultOGTags, resetToDefaultOGTags, setMelodyOGTags, } from '@/lib/og-tags'
import { OG_IMAGE_VERSIONS } from '@/seo/og-image-versions'

/** The share card's URL, stamped with its version as index.html carries it. */
const STAMPED_CARD = `https://mercurypitch.com/og-image.png?v=${OG_IMAGE_VERSIONS['og-image.png']}`

function getMeta(attr: string, value: string): HTMLMetaElement | null {
  return document.head.querySelector(`meta[${attr}="${value}"]`)
}

function getMetaContent(attr: string, value: string): string {
  return getMeta(attr, value)?.getAttribute('content') ?? ''
}

describe('initDefaultOGTags', () => {
  afterEach(() => {
    document.head.innerHTML = ''
  })

  it('sets og:title meta tag', () => {
    initDefaultOGTags()
    expect(getMetaContent('property', 'og:title')).toContain('MercuryPitch')
  })

  it('sets og:description meta tag', () => {
    initDefaultOGTags()
    expect(getMetaContent('property', 'og:description')).toContain('pitch')
  })

  it('sets og:type to website', () => {
    initDefaultOGTags()
    expect(getMetaContent('property', 'og:type')).toBe('website')
  })

  it('sets og:url to production URL', () => {
    initDefaultOGTags()
    expect(getMetaContent('property', 'og:url')).toBe(
      'https://mercurypitch.com/',
    )
  })

  it('sets og:image to the stamped share card', () => {
    initDefaultOGTags()
    expect(getMetaContent('property', 'og:image')).toBe(STAMPED_CARD)
  })

  it('sets og:site_name to MercuryPitch', () => {
    initDefaultOGTags()
    expect(getMetaContent('property', 'og:site_name')).toBe('MercuryPitch')
  })

  it('sets twitter:card to summary_large_image', () => {
    initDefaultOGTags()
    expect(getMetaContent('name', 'twitter:card')).toBe('summary_large_image')
  })

  it('sets twitter:title matching og:title', () => {
    initDefaultOGTags()
    expect(getMetaContent('name', 'twitter:title')).toContain('MercuryPitch')
  })

  it('sets twitter:description matching og:description', () => {
    initDefaultOGTags()
    expect(getMetaContent('name', 'twitter:description')).toContain('pitch')
  })

  it('sets twitter:image matching og:image', () => {
    initDefaultOGTags()
    expect(getMetaContent('name', 'twitter:image')).toBe(STAMPED_CARD)
  })

  // The app sets these on boot, over what index.html shipped. An unstamped
  // card URL sent social caches back to the old banded card, the title
  // carried an em dash index.html no longer does, and the description was
  // an older line than index.html's (0.9.19 clip review).
  it('says what index.html says about the card, the title and the description', () => {
    const html = new DOMParser().parseFromString(
      readFileSync(resolve(process.cwd(), 'index.html'), 'utf8'),
      'text/html',
    )
    const shipped = (attr: string, key: string): string | null | undefined =>
      html.head.querySelector(`meta[${attr}="${key}"]`)?.getAttribute('content')
    initDefaultOGTags()
    for (const [attr, key] of [
      ['property', 'og:image'],
      ['name', 'twitter:image'],
      ['property', 'og:title'],
      ['name', 'twitter:title'],
      ['property', 'og:description'],
      ['name', 'twitter:description'],
    ] as const) {
      expect(getMetaContent(attr, key), key).toBe(shipped(attr, key))
    }
    expect(getMetaContent('property', 'og:title')).toBe(
      'MercuryPitch: See Your Voice, Sing Karaoke, Improve Every Take',
    )
  })

  it('updates existing meta tags instead of creating duplicates', () => {
    initDefaultOGTags()
    initDefaultOGTags()
    // Should still be one of each
    const ogTitles = document.head.querySelectorAll('meta[property="og:title"]')
    expect(ogTitles.length).toBe(1)
  })
})

describe('setMelodyOGTags', () => {
  beforeEach(() => {
    document.head.innerHTML = ''
    // seed defaults so setMelodyOGTags updates rather than creates
    initDefaultOGTags()
  })

  it('updates og:title with melody info and key', () => {
    setMelodyOGTags({ noteCount: 15, bpm: 120, key: 'C' })
    expect(getMetaContent('property', 'og:title')).toBe(
      'Melody in C shared on MercuryPitch',
    )
  })

  it('updates og:title without key', () => {
    setMelodyOGTags({ noteCount: 10 })
    expect(getMetaContent('property', 'og:title')).toBe(
      'Melody shared on MercuryPitch',
    )
  })

  it('updates og:description with full metadata', () => {
    setMelodyOGTags({ noteCount: 20, bpm: 140, key: 'Am' })
    expect(getMetaContent('property', 'og:description')).toBe(
      'A 20-note melody at 140 BPM in Am. Practice it on MercuryPitch.',
    )
  })

  it('updates og:description without optional fields', () => {
    setMelodyOGTags({ noteCount: 5 })
    expect(getMetaContent('property', 'og:description')).toBe(
      'A 5-note melody. Practice it on MercuryPitch.',
    )
  })

  it('updates og:description with BPM but no key', () => {
    setMelodyOGTags({ noteCount: 8, bpm: 100 })
    expect(getMetaContent('property', 'og:description')).toBe(
      'An 8-note melody at 100 BPM. Practice it on MercuryPitch.',
    )
  })

  // By how the number is said: eight, eleven, eighteen, eighty and eight
  // hundred start on a vowel; one, sixteen and one hundred ten do not.
  it.each([
    [8, 'An 8-note'],
    [11, 'An 11-note'],
    [18, 'An 18-note'],
    [80, 'An 80-note'],
    [800, 'An 800-note'],
    [1, 'A 1-note'],
    [16, 'A 16-note'],
    [110, 'A 110-note'],
  ])('says "%s" notes with the right article', (noteCount, opening) => {
    setMelodyOGTags({ noteCount })
    expect(getMetaContent('property', 'og:description')).toBe(
      `${opening} melody. Practice it on MercuryPitch.`,
    )
  })

  it('updates og:description with key but no BPM', () => {
    setMelodyOGTags({ noteCount: 12, key: 'Dm' })
    expect(getMetaContent('property', 'og:description')).toBe(
      'A 12-note melody in Dm. Practice it on MercuryPitch.',
    )
  })

  it('updates og:url to current window location', () => {
    vi.stubGlobal('location', { href: 'https://mercurypitch.com/?n=m60s0d2' })
    setMelodyOGTags({ noteCount: 1 })
    expect(getMetaContent('property', 'og:url')).toBe(
      'https://mercurypitch.com/?n=m60s0d2',
    )
    vi.unstubAllGlobals()
  })

  it('updates twitter:title to match melody title', () => {
    setMelodyOGTags({ noteCount: 10, key: 'G' })
    expect(getMetaContent('name', 'twitter:title')).toBe(
      'Melody in G shared on MercuryPitch',
    )
  })

  it('updates twitter:description to match melody description', () => {
    setMelodyOGTags({ noteCount: 7, bpm: 110 })
    expect(getMetaContent('name', 'twitter:description')).toBe(
      'A 7-note melody at 110 BPM. Practice it on MercuryPitch.',
    )
  })

  it('does not change og:type or og:image or og:site_name', () => {
    setMelodyOGTags({ noteCount: 3 })
    expect(getMetaContent('property', 'og:type')).toBe('website')
    expect(getMetaContent('property', 'og:image')).toBe(STAMPED_CARD)
    expect(getMetaContent('property', 'og:site_name')).toBe('MercuryPitch')
  })
})

describe('resetToDefaultOGTags', () => {
  beforeEach(() => {
    document.head.innerHTML = ''
    initDefaultOGTags()
  })

  it('reverts og:title to default', () => {
    setMelodyOGTags({ noteCount: 15, bpm: 120, key: 'C' })
    resetToDefaultOGTags()
    expect(getMetaContent('property', 'og:title')).toContain('MercuryPitch')
    expect(getMetaContent('property', 'og:title')).not.toContain('Melody')
  })

  it('reverts og:description to default', () => {
    setMelodyOGTags({ noteCount: 15, bpm: 120, key: 'C' })
    resetToDefaultOGTags()
    expect(getMetaContent('property', 'og:description')).toContain('pitch')
    expect(getMetaContent('property', 'og:description')).not.toContain(
      '15-note',
    )
  })

  it('reverts og:url to default', () => {
    vi.stubGlobal('location', { href: 'https://mercurypitch.com/?n=m60s0d2' })
    setMelodyOGTags({ noteCount: 1 })
    resetToDefaultOGTags()
    expect(getMetaContent('property', 'og:url')).toBe(
      'https://mercurypitch.com/',
    )
    vi.unstubAllGlobals()
  })

  it('reverts twitter:title to default', () => {
    setMelodyOGTags({ noteCount: 5, key: 'D' })
    resetToDefaultOGTags()
    expect(getMetaContent('name', 'twitter:title')).toContain('MercuryPitch')
    expect(getMetaContent('name', 'twitter:title')).not.toContain('Melody')
  })

  it('reverts twitter:description to default', () => {
    setMelodyOGTags({ noteCount: 5, bpm: 100 })
    resetToDefaultOGTags()
    expect(getMetaContent('name', 'twitter:description')).toContain('pitch')
    expect(getMetaContent('name', 'twitter:description')).not.toContain(
      '5-note',
    )
  })
})
