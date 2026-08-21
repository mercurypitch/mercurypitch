// ============================================================
// Background catalog tests
// ============================================================

import { readFileSync } from 'node:fs'
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { BACKGROUND_CATALOG, BACKGROUND_PERK_IDS, CURRENT_FREE_BACKGROUND_IDS, defaultBackground, DRUM_PREMIUM_BACKGROUND_IDS, EXISTING_PREMIUM_BACKGROUND_IDS, getBackgroundDefinition, listBackgrounds, NEW_EDITION_BACKGROUND_IDS, PIANO_PREMIUM_BACKGROUND_IDS, } from './background-catalog'

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
    for (const id of DRUM_PREMIUM_BACKGROUND_IDS) {
      expect(getBackgroundDefinition(id)?.delivery).toBe('master-ready')
    }
    const masteredIds = new Set<string>([
      ...PIANO_PREMIUM_BACKGROUND_IDS,
      ...DRUM_PREMIUM_BACKGROUND_IDS,
    ])
    for (const id of NEW_EDITION_BACKGROUND_IDS.filter(
      (id) => !masteredIds.has(id),
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
    ).toEqual(['karaoke-theatre', 'karaoke-tokyo-cyber'])
    expect(
      listBackgrounds('karaoke', { includeUnshipped: true }).map(
        (background) => background.id,
      ),
    ).toEqual([
      'karaoke-theatre',
      'karaoke-tokyo-cyber',
      'golden-hour-stage',
      'aurora-stage',
      'neon-velvet-stage',
      'midnight-rain-stage',
      'karaoke-floating-orb',
      'karaoke-nordic-amphitheatre',
      'karaoke-broadway-theater',
      'karaoke-jazz-club',
      'karaoke-nordic-amphitheater',
      'karaoke-rooftop-skyline',
      'karaoke-rustic-coffeehouse',
      'karaoke-speakeasy-vault',
      'karaoke-starlight-solarium',
      'karaoke-synthwave-80s',
    ])
    expect(listBackgrounds('piano').map((background) => background.id)).toEqual(
      [
        'piano-afterglow',
        'piano-morning-conservatory',
        'piano-nocturne-studio',
        'piano-brick-practice-loft',
        'piano-quiet-music-library',
        'piano-ambient-led-studio',
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
      'piano-ambient-led-studio',
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
      'piano-manor-library',
      'piano-parisian-salon',
      'piano-1950s-jazz-lounge',
      'piano-acoustic-chamber',
      'piano-alpine-villa',
      'piano-coastal-sunset',
      'piano-grand-hall',
      'piano-moonlit-conservatory',
    ])
    expect(listBackgrounds('drum').map((background) => background.id)).toEqual([
      'drum-pocket-console',
      'drum-tape-room',
      'drum-daylight-riser',
      'drum-after-hours-booth',
    ])
    expect(
      listBackgrounds('drum', { includeUnshipped: true }).map(
        (background) => background.id,
      ),
    ).toEqual([
      'drum-pocket-console',
      'drum-tape-room',
      'drum-daylight-riser',
      'drum-after-hours-booth',
      ...DRUM_PREMIUM_BACKGROUND_IDS,
    ])
  })

  it('defines a shipped free fallback for every surface', () => {
    for (const surface of [
      'karaoke',
      'jam',
      'piano',
      'guitar',
      'drum',
    ] as const) {
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

  it('keeps every Drum room responsive and the daylight rooms contrast-aware', () => {
    for (const id of [
      'drum-pocket-console',
      'drum-tape-room',
      'drum-daylight-riser',
      'drum-after-hours-booth',
    ] as const) {
      const source = getBackgroundDefinition(id)?.assetSource
      expect(source?.kind).toBe('public')
      if (source?.kind === 'public') expect(source.portrait).toBeDefined()
    }
    expect(getBackgroundDefinition('drum-daylight-riser')?.treatment).toBe(
      'light',
    )
    expect(getBackgroundDefinition('drum-sunrise-pavilion')?.treatment).toBe(
      'light',
    )
  })

  it('ships real, bounded landscape and portrait files for every free Drum room', async () => {
    for (const id of [
      'drum-pocket-console',
      'drum-tape-room',
      'drum-daylight-riser',
      'drum-after-hours-booth',
    ] as const) {
      const source = getBackgroundDefinition(id)?.assetSource
      expect(source?.kind).toBe('public')
      if (source?.kind !== 'public' || source.portrait === undefined) continue

      for (const [path, orientation] of [
        [source.landscape, 'landscape'],
        [source.portrait, 'portrait'],
      ] as const) {
        const publicPath = `public${path}`
        const bytes = readFileSync(publicPath)
        expect(bytes.subarray(0, 4).toString('ascii')).toBe('RIFF')
        expect(bytes.subarray(8, 12).toString('ascii')).toBe('WEBP')
        expect(bytes.byteLength).toBeGreaterThan(20_000)
        expect(bytes.byteLength).toBeLessThanOrEqual(600 * 1024)
        expect(path.endsWith(`-${orientation}.webp`)).toBe(true)

        const metadata = await sharp(publicPath).metadata()
        expect(metadata.width).toBeDefined()
        expect(metadata.height).toBeDefined()
        if (orientation === 'landscape') {
          expect(metadata.width).toBeGreaterThan(metadata.height ?? 0)
        } else {
          expect(metadata.height).toBeGreaterThan(metadata.width ?? 0)
        }
        if (id !== 'drum-pocket-console') {
          expect([metadata.width, metadata.height]).toEqual(
            orientation === 'landscape' ? [2048, 1152] : [1440, 2560],
          )
        }
      }
    }
  })
})
