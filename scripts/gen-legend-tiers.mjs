// ============================================================
// Legend portraits — generate the sized asset tiers
// ============================================================
//
// The masters in public/legends/ are 928x1152. Handing one of those to a
// small box asks the browser for a big downscale, and past roughly 4x it
// stops taking the high-quality path at 125%/200% zoom: the face turns to
// mush while every other zoom looks fine. Upscaling fails the same way from
// the other side, so "just use the thumbnail everywhere" is not the answer
// either — a 120px asset in a 180px box is soft.
//
// So: ship the pixels each box actually needs.
//
//   thumbs/  120px wide — history chips and profile rows (~30-120px boxes)
//   mid/     360px wide — onboarding beats and cards     (~130-360px boxes)
//   (master) 928px wide — the reveal card
//
// Until now the thumbs were produced out of band, and legend-thumbs.test.ts
// only checked that a file EXISTED. That is how the onboarding ended up
// rendering masters into a 130px box at a 7.1x downscale. This script is the
// missing half: one command regenerates every tier, and the test asserts the
// dimensions rather than the filename.
//
//   pnpm assets:legends          regenerate every tier
//   pnpm assets:legends:check    verify, exit 1 on drift
//
// GENERATING needs ImageMagick on PATH. READING does not — dimensions come
// from the WebP header below, so --check and the test suite run anywhere.
// Deliberately not a node dependency: this runs when a legend is added,
// which is rare, and adding sharp to the install would cost every
// contributor a native build for it.

import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
export const legendsDir = resolve(here, '../public/legends')

/**
 * Tier widths. Heights follow the master's aspect ratio rather than being
 * pinned, so a master re-exported at a different shape is not silently
 * squashed here.
 */
export const TIERS = [
  { dir: 'thumbs', key: 'thumb', width: 120 },
  { dir: 'mid', key: 'mid', width: 360 },
]

/**
 * Width and height of a WebP, read straight from the header.
 *
 * All three container variants are handled, because which one you get is
 * not a property of the image — it is a property of whatever wrote it. A
 * fresh master converted WITHOUT `-strip` keeps the generator's metadata,
 * and metadata forces the extended 'VP8X' container; the same picture
 * converted with `-strip` comes out simple 'VP8 '. Reading only 'VP8 '
 * meant adding a portrait could throw here instead of measuring it.
 *
 *   VP8   simple lossy: frame tag (3) | sync 9d 01 2a | w (14b) | h (14b),
 *         the top two bits of each being scaling hints — hence 0x3fff.
 *   VP8L  lossless: signature 0x2f, then w-1 and h-1 as 14 bits each,
 *         packed little-endian.
 *   VP8X  extended: flags (4) | canvas w-1 (24b LE) | canvas h-1 (24b LE).
 */
export function webpSize(file) {
  const b = readFileSync(file)
  if (b.toString('ascii', 0, 4) !== 'RIFF' || b.toString('ascii', 8, 12) !== 'WEBP') {
    throw new Error(`${file}: not a WebP`)
  }
  const chunk = b.toString('ascii', 12, 16)
  if (chunk === 'VP8 ') {
    return {
      width: b.readUInt16LE(26) & 0x3fff,
      height: b.readUInt16LE(28) & 0x3fff,
    }
  }
  if (chunk === 'VP8X') {
    return {
      width: b.readUIntLE(24, 3) + 1,
      height: b.readUIntLE(27, 3) + 1,
    }
  }
  if (chunk === 'VP8L') {
    const bits = b.readUInt32LE(21)
    return {
      width: (bits & 0x3fff) + 1,
      height: ((bits >> 14) & 0x3fff) + 1,
    }
  }
  throw new Error(`${file}: unsupported WebP chunk "${chunk}"`)
}

/** The master portraits, i.e. every .webp directly in public/legends. */
export function legendMasters() {
  return readdirSync(legendsDir)
    .filter((f) => f.endsWith('.webp'))
    .sort()
}

/** The height a tier should be, from the master's aspect ratio. */
export function expectedTierHeight(master, width) {
  const m = webpSize(join(legendsDir, master))
  return Math.round((m.height / m.width) * width)
}

function generate() {
  let count = 0
  for (const tier of TIERS) {
    const outDir = join(legendsDir, tier.dir)
    if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true })
    for (const file of legendMasters()) {
      // -strip: the masters carry generator metadata that is pure weight
      // here. Lanczos rather than the default, because these are faces and
      // the whole point is that they stay legible small.
      execFileSync('magick', [
        join(legendsDir, file),
        '-strip',
        '-filter',
        'Lanczos',
        '-resize',
        `${tier.width}x`,
        '-quality',
        '82',
        join(outDir, file),
      ])
      count += 1
    }
  }
  console.log(
    `Generated ${count} files across ${TIERS.length} tiers for ${legendMasters().length} portraits.`,
  )
}

function check() {
  const drift = []
  for (const tier of TIERS) {
    for (const file of legendMasters()) {
      const out = join(legendsDir, tier.dir, file)
      if (!existsSync(out)) {
        drift.push(`missing: legends/${tier.dir}/${file}`)
        continue
      }
      const got = webpSize(out)
      const wantH = expectedTierHeight(file, tier.width)
      if (got.width !== tier.width || Math.abs(got.height - wantH) > 1) {
        drift.push(
          `wrong size: legends/${tier.dir}/${file} is ${got.width}x${got.height}, expected ${tier.width}x${wantH}`,
        )
      }
    }
  }
  if (drift.length > 0) {
    console.error('Legend tiers are stale:')
    for (const d of drift) console.error(`  ${d}`)
    console.error('\nRun: pnpm assets:legends')
    process.exit(1)
  }
  console.log('Legend tiers are up to date.')
}

// Guarded so the test suite can import webpSize and TIERS without the
// script running itself.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--check')) check()
  else generate()
}
