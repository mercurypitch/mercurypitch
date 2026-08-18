// ============================================================
// A medallion has to survive the circle the app clips it to
// ============================================================
//
// `ProgressPage.module.css` draws badge art at 132px and clips it:
//
//     clip-path: circle(39% at 50% 50%)
//
// `circle(39%)` of a square resolves to a radius of 39% of the *width*, so
// only the central 78% of the image is ever seen. Anything beyond r = 0.78 in
// half-width units is cut away.
//
// The first batch of achievement medallions came back frame-filling and
// handsome with the rim's outer edge at r = 0.92 — every ring would have been
// sliced off. They were rescaled to r ≈ 0.69 to sit with the badges that were
// already there. None of that is visible in a diff, and the next batch will
// arrive the same way; this is what says so before it ships.
//
// Measured while writing this, and left alone deliberately: `fire` (0.81) and
// `rocket` (0.80) already overflow the clip by a few pixels of outer glow.
// They are lossy 192px files with no original to go back to, so re-encoding
// them to win four percent of a radius would cost more than it buys. The
// ceiling here is set to hold the line rather than to fail them.

import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'

/** Where the CSS clip cuts, in half-width units. */
const CLIP_RADIUS = 0.78
/** What the achievement medallions were built to. */
const RECIPE_RADIUS = 0.69
/** The line no art may cross, legacy included. */
const HARD_CEILING = 0.82

const badgesDir = resolve(__dirname, '../../public/badges')
const files = readdirSync(badgesDir)
  .filter((name) => name.endsWith('.webp'))
  .sort()

/** Icons the achievements introduced — the set drawn to one recipe. */
const recipeIcons = ((): Set<string> => {
  const seed = JSON.parse(
    readFileSync(resolve(__dirname, '../db/seed-data.json'), 'utf8'),
  ) as {
    achievementDefinitions: Array<{ icon: string }>
    badgeDefinitions: Array<{ icon: string }>
  }
  const badges = new Set(seed.badgeDefinitions.map((row) => row.icon))
  return new Set(
    seed.achievementDefinitions
      .map((row) => row.icon)
      .filter((icon) => !badges.has(icon)),
  )
})()

const luminance = (r: number, g: number, b: number): number =>
  0.2126 * r + 0.7152 * g + 0.0722 * b

interface Measured {
  size: number
  outerRadius: number
  opaque: boolean
}

/**
 * How far out the metal reaches, in half-width units.
 *
 * Measured against the file's OWN field rather than a fixed colour: badges
 * come in bronze, silver and gold, and a couple of the legacy ones sit on a
 * warm field that a "looks golden" test mistakes for the rim itself.
 */
async function measure(file: string): Promise<Measured> {
  const image = sharp(resolve(badgesDir, file))
  const { width = 0, height = 0 } = await image.metadata()
  const { data } = await image
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const centre = width / 2
  const field: number[] = []
  for (let y = 0; y < height; y += 2) {
    for (let x = 0; x < width; x += 2) {
      const i = (y * width + x) * 4
      if (Math.hypot(x - centre, y - centre) / centre < 0.75) {
        field.push(luminance(data[i], data[i + 1], data[i + 2]))
      }
    }
  }
  field.sort((a, b) => a - b)
  // The darkest decile is the enamel; anything well clear of it is metal.
  const threshold = field[Math.floor(field.length / 10)] + 60

  let outerRadius = 0
  let opaque = true
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4
      if (data[i + 3] < 255) opaque = false
      if (
        data[i + 3] > 128 &&
        luminance(data[i], data[i + 1], data[i + 2]) > threshold
      ) {
        const d = Math.hypot(x - centre, y - centre) / centre
        if (d > outerRadius) outerRadius = d
      }
    }
  }
  return { size: width === height ? width : -1, outerRadius, opaque }
}

describe('every medallion on disk', () => {
  it('has art to check, and covers the recipe set', () => {
    expect(files.length).toBeGreaterThanOrEqual(43)
    expect(recipeIcons.size).toBe(27)
  })

  it.each(files)('%s is sized and sealed like the rest', async (file) => {
    const { size, opaque, outerRadius } = await measure(file)

    // 192px is three times the 64px box, so a hi-DPI screen downscales
    // rather than stretching.
    expect(size).toBe(192)

    // Opaque to the corner: the annulus between the rim and the clip edge is
    // visible, and a transparent one would show the page through it.
    expect(opaque).toBe(true)

    // Nothing may be as far out as the batch that arrived at 0.92.
    expect(outerRadius).toBeLessThan(HARD_CEILING)
  })

  it.each(files.filter((f) => recipeIcons.has(f.replace('.webp', ''))))(
    '%s sits where the achievement set agreed to sit',
    async (file) => {
      const { outerRadius } = await measure(file)
      // Comfortably inside the clip, and tight enough across the set that a
      // shelf of them reads as one thing rather than a pile.
      expect(outerRadius).toBeLessThan(CLIP_RADIUS)
      expect(outerRadius).toBeGreaterThan(RECIPE_RADIUS - 0.03)
      expect(outerRadius).toBeLessThan(RECIPE_RADIUS + 0.03)
    },
  )
})
