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

import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { badgeArtIcons, badgeArtSrc } from '@/features/challenges/badge-art'

const publicPath = (src: string): string =>
  resolve(__dirname, '../../public', src.replace(/^\//, ''))

describe('badge medallions', () => {
  it('covers all sixteen seeded badge icons', () => {
    expect(badgeArtIcons()).toHaveLength(16)
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
