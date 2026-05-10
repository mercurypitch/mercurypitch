// ============================================================
// OG Tags Tests
// ============================================================

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { initDefaultOGTags, resetToDefaultOGTags, setMelodyOGTags, } from '@/lib/og-tags'

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
    expect(getMetaContent('property', 'og:title')).toContain('PitchPerfect')
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

  it('sets og:image to favicon', () => {
    initDefaultOGTags()
    expect(getMetaContent('property', 'og:image')).toBe(
      'https://mercurypitch.com/favicon.png',
    )
  })

  it('sets og:site_name to PitchPerfect', () => {
    initDefaultOGTags()
    expect(getMetaContent('property', 'og:site_name')).toBe('PitchPerfect')
  })

  it('sets twitter:card to summary_large_image', () => {
    initDefaultOGTags()
    expect(getMetaContent('name', 'twitter:card')).toBe('summary_large_image')
  })

  it('sets twitter:title matching og:title', () => {
    initDefaultOGTags()
    expect(getMetaContent('name', 'twitter:title')).toContain('PitchPerfect')
  })

  it('sets twitter:description matching og:description', () => {
    initDefaultOGTags()
    expect(getMetaContent('name', 'twitter:description')).toContain('pitch')
  })

  it('sets twitter:image matching og:image', () => {
    initDefaultOGTags()
    expect(getMetaContent('name', 'twitter:image')).toBe(
      'https://mercurypitch.com/favicon.png',
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
      'Melody in C shared on PitchPerfect',
    )
  })

  it('updates og:title without key', () => {
    setMelodyOGTags({ noteCount: 10 })
    expect(getMetaContent('property', 'og:title')).toBe(
      'Melody shared on PitchPerfect',
    )
  })

  it('updates og:description with full metadata', () => {
    setMelodyOGTags({ noteCount: 20, bpm: 140, key: 'Am' })
    expect(getMetaContent('property', 'og:description')).toBe(
      'A 20-note melody at 140 BPM in Am — practice it on PitchPerfect.',
    )
  })

  it('updates og:description without optional fields', () => {
    setMelodyOGTags({ noteCount: 5 })
    expect(getMetaContent('property', 'og:description')).toBe(
      'A 5-note melody — practice it on PitchPerfect.',
    )
  })

  it('updates og:description with BPM but no key', () => {
    setMelodyOGTags({ noteCount: 8, bpm: 100 })
    expect(getMetaContent('property', 'og:description')).toBe(
      'A 8-note melody at 100 BPM — practice it on PitchPerfect.',
    )
  })

  it('updates og:description with key but no BPM', () => {
    setMelodyOGTags({ noteCount: 12, key: 'Dm' })
    expect(getMetaContent('property', 'og:description')).toBe(
      'A 12-note melody in Dm — practice it on PitchPerfect.',
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
      'Melody in G shared on PitchPerfect',
    )
  })

  it('updates twitter:description to match melody description', () => {
    setMelodyOGTags({ noteCount: 7, bpm: 110 })
    expect(getMetaContent('name', 'twitter:description')).toBe(
      'A 7-note melody at 110 BPM — practice it on PitchPerfect.',
    )
  })

  it('does not change og:type or og:image or og:site_name', () => {
    setMelodyOGTags({ noteCount: 3 })
    expect(getMetaContent('property', 'og:type')).toBe('website')
    expect(getMetaContent('property', 'og:image')).toBe(
      'https://mercurypitch.com/favicon.png',
    )
    expect(getMetaContent('property', 'og:site_name')).toBe('PitchPerfect')
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
    expect(getMetaContent('property', 'og:title')).toContain('PitchPerfect')
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
    expect(getMetaContent('name', 'twitter:title')).toContain('PitchPerfect')
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
