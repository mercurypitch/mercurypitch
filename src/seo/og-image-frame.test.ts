// ============================================================
// The shared card fills its frame
// ============================================================
//
// public/og-image.png was put together by hand from a key visual that carries
// its own letterbox, and from July to October 2026 it went out with 65 black
// rows above the art and 65 below. Nothing caught it: the file was the
// 1200x630 that index.html declares, so every check passed, and the bands
// only showed once a link was shared. scripts/generate-og-image.mjs now crops
// the art to the card. This is what says so if a regenerated card brings the
// bands back, or stops matching the tags that describe it.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'

const repo = resolve(__dirname, '../..')
const card = resolve(repo, 'public/og-image.png')
const shell = readFileSync(resolve(repo, 'index.html'), 'utf8')

/** A row or column this dark all the way across is letterbox, not sky. */
const BAND_MAX_CHANNEL = 24

function meta(key: string): string | undefined {
  const tag = new RegExp(
    `<meta\\s+(?:property|name)="${key}"\\s+content="([^"]*)"`,
  )
  return shell.match(tag)?.[1]
}

async function pixels() {
  const { data, info } = await sharp(card)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const at = (x: number, y: number) => {
    const i = (y * info.width + x) * info.channels
    return Math.max(data[i], data[i + 1], data[i + 2])
  }
  return { width: info.width, height: info.height, at }
}

/** How many edge lines in a row are near-black end to end. */
function bandFrom(
  lines: number[],
  length: number,
  brightest: (line: number, i: number) => number,
): number {
  let band = 0
  for (const line of lines) {
    let max = 0
    for (let i = 0; i < length && max <= BAND_MAX_CHANNEL; i++) {
      max = Math.max(max, brightest(line, i))
    }
    if (max > BAND_MAX_CHANNEL) break
    band++
  }
  return band
}

describe('the shared social card', () => {
  it('is the size index.html declares', async () => {
    const { width, height } = await sharp(card).metadata()
    expect([width, height]).toEqual([
      Number(meta('og:image:width')),
      Number(meta('og:image:height')),
    ])
  })

  it('has art on every edge, with no letterbox band', async () => {
    const { width, height, at } = await pixels()
    const rows = [...Array(height).keys()]
    const cols = [...Array(width).keys()]
    const row = (y: number, x: number) => at(x, y)
    const col = (x: number, y: number) => at(x, y)
    expect({
      top: bandFrom(rows, width, row),
      bottom: bandFrom([...rows].reverse(), width, row),
      left: bandFrom(cols, height, col),
      right: bandFrom([...cols].reverse(), height, col),
    }).toEqual({ top: 0, bottom: 0, left: 0, right: 0 })
  })

  it('reads the same to X as to everyone else', () => {
    expect(meta('twitter:image')).toBe(meta('og:image'))
    expect(meta('twitter:image:alt')).toBe(meta('og:image:alt'))
  })
})
