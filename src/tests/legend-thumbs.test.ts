// ============================================================
// Legend portraits ship every sized tier, at the right size
// ============================================================
//
// The history chips draw a 30x37 box. Pointing that at the 928x1152
// portrait asks the browser for a 31x downscale, and at 125%/200% zoom it
// abandons the high-quality path — the faces turn to mush while every
// other zoom looks fine. The tier sources are derived by convention, so
// this test is what turns a missing file into a red suite instead of a
// blurry page.
//
// It asserts DIMENSIONS, not just presence, because presence alone is what
// let the onboarding drift: the thumbs existed and were used correctly by
// the profile rows, while the onboarding rendered masters into a 130px box
// at 7.1x and nothing failed. A present-but-wrong-size file is the exact
// shape of that bug.

import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { LegendTier } from '@/features/mirror/LegendCaricature'
import { LEGENDS, legendThumbSrc, legendTierSrc, } from '@/features/mirror/LegendCaricature'
// The generator is the source of truth for the widths, so the test cannot
// drift from it by editing one number in one place. Importing it is safe:
// the script only runs itself when invoked directly.
// @ts-expect-error — plain .mjs build tooling, no types
import { TIERS, webpSize } from '../../scripts/gen-legend-tiers.mjs'

const publicPath = (src: string): string =>
  resolve(__dirname, '../../public', src.replace(/^\//, ''))

const TIER_WIDTH = Object.fromEntries(
  (TIERS as { key: string; width: number }[]).map((t) => [t.key, t.width]),
) as Record<Exclude<LegendTier, 'full'>, number>

const sizeOf = webpSize as (f: string) => { width: number; height: number }

describe('legend portrait tiers', () => {
  const withArt = Object.entries(LEGENDS).filter(
    ([, art]) => art.imageSrc != null && art.imageSrc !== '',
  )

  it('covers every legend that has a portrait', () => {
    expect(withArt.length).toBeGreaterThan(0)
    const missing = withArt
      .map(([name]) => name)
      .filter((name) => legendThumbSrc(name) === undefined)
    expect(missing).toEqual([])
  })

  for (const tier of ['thumb', 'mid'] as const) {
    it(`has every ${tier} file on disk`, () => {
      const missing = withArt
        .map(([name]) => ({ name, src: legendTierSrc(name, tier)! }))
        .filter(({ src }) => !existsSync(publicPath(src)))
        .map(({ name }) => name)
      expect(missing).toEqual([])
    })

    it(`renders ${tier} at ${TIER_WIDTH[tier]}px wide`, () => {
      const wrong = withArt
        .map(([name]) => ({
          name,
          size: sizeOf(publicPath(legendTierSrc(name, tier)!)),
        }))
        .filter(({ size }) => size.width !== TIER_WIDTH[tier])
        .map(({ name, size }) => `${name}: ${size.width}px`)
      expect(wrong).toEqual([])
    })

    it(`keeps the master's aspect ratio in ${tier}`, () => {
      const skewed: string[] = []
      for (const [name, art] of withArt) {
        const master = sizeOf(publicPath(art.imageSrc!))
        const scaled = sizeOf(publicPath(legendTierSrc(name, tier)!))
        const want = Math.round((master.height / master.width) * scaled.width)
        // One pixel of rounding slack; anything more is a squashed face.
        if (Math.abs(scaled.height - want) > 1) {
          skewed.push(`${name}: ${scaled.height}px, expected ~${want}px`)
        }
      }
      expect(skewed).toEqual([])
    })
  }

  it('is small enough to be worth shipping', () => {
    // A tier that is not meaningfully smaller than the master is a tier that
    // is not doing its job — most likely a copy rather than a resize.
    for (const [name, art] of withArt) {
      const master = sizeOf(publicPath(art.imageSrc!))
      for (const tier of ['thumb', 'mid'] as const) {
        const scaled = sizeOf(publicPath(legendTierSrc(name, tier)!))
        expect(scaled.width, `${name} ${tier}`).toBeLessThan(master.width)
      }
    }
  })

  it('points each tier at its own directory, never the master', () => {
    for (const [name, art] of withArt) {
      expect(legendTierSrc(name, 'thumb')).toBe(
        art.imageSrc!.replace('/legends/', '/legends/thumbs/'),
      )
      expect(legendTierSrc(name, 'mid')).toBe(
        art.imageSrc!.replace('/legends/', '/legends/mid/'),
      )
      expect(legendTierSrc(name, 'full')).toBe(art.imageSrc)
      expect(legendTierSrc(name, 'thumb')).not.toBe(art.imageSrc)
      expect(legendTierSrc(name, 'mid')).not.toBe(art.imageSrc)
    }
  })

  it('returns undefined for a legend with no portrait', () => {
    expect(legendThumbSrc('nobody-by-this-name')).toBeUndefined()
    expect(legendTierSrc('nobody-by-this-name', 'mid')).toBeUndefined()
  })
})
