// ============================================================
// Background catalog tests
// ============================================================

import { describe, expect, it } from 'vitest'
import { BACKGROUND_CATALOG, BACKGROUND_PERK_IDS, CURRENT_FREE_BACKGROUND_IDS, defaultBackground, EXISTING_PREMIUM_BACKGROUND_IDS, getBackgroundDefinition, listBackgrounds, NEW_EDITION_BACKGROUND_IDS, PIANO_PREMIUM_BACKGROUND_IDS, } from './background-catalog'

describe('background catalog', () => {
  it('registers every current free performance scene as shipped', () => {
    expect(
      BACKGROUND_CATALOG.filter(
        (background) => background.access.kind === 'free',
      ).map((background) => background.id),
    ).toEqual(CURRENT_FREE_BACKGROUND_IDS)

    for (const id of CURRENT_FREE_BACKGROUND_IDS) {
      const background = getBackgroundDefinition(id)
      expect(background?.delivery).toBe('shipped')
      expect(background?.assetSource.kind).toBe('public')
    }
  })

  it('marks every available master separately from the remaining planned editions', () => {
    for (const id of EXISTING_PREMIUM_BACKGROUND_IDS) {
      expect(getBackgroundDefinition(id)?.delivery).toBe('master-ready')
    }
    for (const id of PIANO_PREMIUM_BACKGROUND_IDS) {
      expect(getBackgroundDefinition(id)?.delivery).toBe('master-ready')
    }
    const masteredPianoIds = new Set<string>(PIANO_PREMIUM_BACKGROUND_IDS)
    for (const id of NEW_EDITION_BACKGROUND_IDS.filter(
      (id) => !masteredPianoIds.has(id),
    )) {
      expect(getBackgroundDefinition(id)?.delivery).toBe('planned')
    }
  })

  it('keeps every supporter source protected and mapped to its explicit perk id', () => {
    const supporterBackgrounds = BACKGROUND_CATALOG.filter(
      (background) => background.access.kind === 'supporter',
    )
    expect(supporterBackgrounds.map((background) => background.id)).toEqual(
      BACKGROUND_PERK_IDS,
    )

    for (const background of supporterBackgrounds) {
      expect(background.assetSource.kind).toBe('protected')
      if (background.access.kind === 'supporter') {
        expect(background.access.explicitPerkId).toBe(background.id)
        expect(background.assetSource).toEqual({
          kind: 'protected',
          key: `backgrounds/${background.surface}/${background.id}`,
        })
      }
    }
  })

  it('lists only shipped choices unless future entries are requested', () => {
    expect(
      listBackgrounds('karaoke').map((background) => background.id),
    ).toEqual(['karaoke-theatre'])
    expect(
      listBackgrounds('karaoke', { includeUnshipped: true }).map(
        (background) => background.id,
      ),
    ).toEqual([
      'karaoke-theatre',
      'golden-hour-stage',
      'aurora-stage',
      'neon-velvet-stage',
      'midnight-rain-stage',
    ])
    expect(listBackgrounds('piano').map((background) => background.id)).toEqual(
      [
        'piano-afterglow',
        'piano-morning-conservatory',
        'piano-nocturne-studio',
        'piano-brick-practice-loft',
        'piano-quiet-music-library',
      ],
    )
    expect(
      listBackgrounds('piano', { includeUnshipped: true }).map(
        (background) => background.id,
      ),
    ).toEqual([
      'piano-afterglow',
      'piano-morning-conservatory',
      'piano-nocturne-studio',
      'piano-brick-practice-loft',
      'piano-quiet-music-library',
      'piano-velvet-recital',
      'piano-aurora-loft',
      'piano-midnight-rain',
      'piano-mercury-archive',
      'piano-rain-glasshouse',
      'piano-alpine-observatory',
      'piano-cedar-listening-room',
      'piano-desert-modern-salon',
      'piano-moonlit-gallery',
      'piano-coastal-fog-pavilion',
    ])
  })

  it('defines a shipped free fallback for all three surfaces', () => {
    for (const surface of ['karaoke', 'jam', 'piano'] as const) {
      const fallback = defaultBackground(surface)
      expect(fallback.surface).toBe(surface)
      expect(fallback.delivery).toBe('shipped')
      expect(fallback.access.kind).toBe('free')
    }
  })

  it('keeps Piano responsive artwork and contrast treatment in the shared catalog', () => {
    const afterglow = getBackgroundDefinition('piano-afterglow')
    const morning = getBackgroundDefinition('piano-morning-conservatory')
    const nocturne = getBackgroundDefinition('piano-nocturne-studio')
    const brick = getBackgroundDefinition('piano-brick-practice-loft')
    const library = getBackgroundDefinition('piano-quiet-music-library')
    expect(afterglow?.assetSource).toMatchObject({
      kind: 'public',
      portrait: '/piano-night/afterglow-studio-portrait.webp',
    })
    expect(morning?.assetSource).toMatchObject({
      kind: 'public',
      portrait: '/piano-night/morning-conservatory-portrait.webp',
    })
    expect(nocturne?.assetSource).toMatchObject({
      kind: 'public',
      portrait: '/piano-night/nocturne-studio-portrait.webp',
    })
    expect(brick?.assetSource).toMatchObject({
      kind: 'public',
      portrait: '/piano-night/brick-practice-loft-portrait.webp',
    })
    expect(library?.assetSource).toMatchObject({
      kind: 'public',
      portrait: '/piano-night/quiet-music-library-portrait.webp',
    })
    expect(afterglow?.treatment ?? 'dark').toBe('dark')
    expect(morning?.treatment).toBe('light')
    expect(nocturne?.treatment ?? 'dark').toBe('dark')
    expect(brick?.treatment).toBe('light')
    expect(library?.treatment ?? 'dark').toBe('dark')
  })
})
