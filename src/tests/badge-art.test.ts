// ============================================================
// Badge art — every drawn medallion has a file
// ============================================================
//
// The art is keyed by the badge row's `icon` string rather than its id,
// because ids are UUIDs minted per database — dev and prod disagree
// about the same badge, and a mapping on id would work in one and
// silently fall back to a glyph in the other.
//
// That makes the icon list the contract, and a missing file the one way
// it can break. This test is what turns that into a red suite rather
// than a badge that quietly reverts to a toolbar glyph.

import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { badgeArtIcons, badgeArtSrc } from '@/features/challenges/badge-art'

const publicPath = (src: string): string =>
  resolve(__dirname, '../../public', src.replace(/^\//, ''))

describe('badge medallions', () => {
  it('covers every seeded icon that has art', () => {
    // Nineteen badges plus twenty-seven achievement icons. The achievement
    // count is icons, not rows: they share icons, and these 27 light up all
    // 46 achievements that used to fall back to a glyph.
    expect(badgeArtIcons()).toHaveLength(46)
  })

  it('leaves no seeded badge without a medallion', () => {
    // Every badge has art now, podium places included — a badge someone
    // competed for rendering as a toolbar glyph is the exact thing this
    // module exists to stop.
    const seed = JSON.parse(
      readFileSync(resolve(__dirname, '../db/seed-data.json'), 'utf8'),
    ) as { badgeDefinitions: Array<{ icon: string; name: string }> }
    const drawn = new Set(badgeArtIcons())
    const bare = seed.badgeDefinitions
      .filter((row) => !drawn.has(row.icon))
      .map((row) => row.name)
    expect(bare).toEqual([])
  })

  it('leaves no seeded achievement without a medallion', () => {
    // The regression this catches: seeding a new achievement with a fresh
    // icon name and no picture, which renders as a glyph among medallions.
    const seed = JSON.parse(
      readFileSync(resolve(__dirname, '../db/seed-data.json'), 'utf8'),
    ) as { achievementDefinitions: Array<{ icon: string; name: string }> }
    const drawn = new Set(badgeArtIcons())
    const bare = [
      ...new Set(
        seed.achievementDefinitions
          .filter((row) => !drawn.has(row.icon))
          .map((row) => row.icon),
      ),
    ]
    expect(bare).toEqual([])
  })

  it('has a file on disk for every icon it claims', () => {
    const missing = badgeArtIcons()
      .map((icon) => ({ icon, src: badgeArtSrc(icon)! }))
      .filter(({ src }) => !existsSync(publicPath(src)))
      .map(({ icon }) => icon)
    expect(missing).toEqual([])
  })

  it('falls back rather than guessing a path', () => {
    // A newly seeded badge with no art must render its glyph, not a 404.
    expect(badgeArtSrc('some-new-icon')).toBeUndefined()
    expect(badgeArtSrc(undefined)).toBeUndefined()
    expect(badgeArtSrc('')).toBeUndefined()
  })

  it('points into the badges directory', () => {
    expect(badgeArtSrc('crown')).toBe('/badges/crown.webp')
  })
})
