// ============================================================
// Legend portraits ship a thumbnail
// ============================================================
//
// The history chips draw a 30x37 box. Pointing that at the 928x1152
// portrait asks the browser for a 31x downscale, and at 125%/200% zoom it
// abandons the high-quality path — the faces turn to mush while every
// other zoom looks fine. legendThumbSrc derives the small asset by
// convention, so the only way it can break is a missing file: this test
// is what turns that into a red suite instead of a blurry page.

import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { LEGENDS, legendThumbSrc } from '@/features/mirror/LegendCaricature'

const publicPath = (src: string): string =>
  resolve(__dirname, '../../public', src.replace(/^\//, ''))

describe('legend thumbnails', () => {
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

  it('has the thumb file on disk for each one', () => {
    const missing = withArt
      .map(([name]) => ({ name, src: legendThumbSrc(name)! }))
      .filter(({ src }) => !existsSync(publicPath(src)))
      .map(({ name }) => name)
    expect(missing).toEqual([])
  })

  it('points at the thumbs directory, not the full portrait', () => {
    for (const [name, art] of withArt) {
      expect(legendThumbSrc(name)).toBe(
        art.imageSrc!.replace('/legends/', '/legends/thumbs/'),
      )
      expect(legendThumbSrc(name)).not.toBe(art.imageSrc)
    }
  })

  it('returns undefined for a legend with no portrait', () => {
    expect(legendThumbSrc('nobody-by-this-name')).toBeUndefined()
  })
})
