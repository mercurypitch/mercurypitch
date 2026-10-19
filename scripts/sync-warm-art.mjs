#!/usr/bin/env node
// ============================================================
// The Warm-up path's art, from the Codex plates into the feature
// ============================================================
//
// The path screen (src/features/warm-up/WarmUpPath.tsx) draws two kinds of
// painted art, both chosen by the owner on 18 Oct 2026 from the Codex
// plates of 15 Oct (codex-plates/INDEX.md):
//
//   warm-sky      the night and its glass floor, version 1 (cx-warm-sky
//                 "v1"). Shipped at the width it was painted (830 px): it
//                 is a smooth gradient with one line of light, and the
//                 phone scales it.
//   warm-stops    the glass orbs, version 2 after its post-fix (cx-warm-
//                 stops "v2"): the background crushed to black and each
//                 rim scaled to the guide (postfix/postfix-fit.json). The
//                 sheet's four quarters are the four states: waiting (top
//                 left), next (top right), done (bottom left) and lit
//                 (bottom right), each 627 px with its orb at the centre.
//
// The orbs are painted on black. Each quarter becomes a sprite with its
// light as its alpha (the brightest channel), so it lies over the sky the
// way light does, and the glass lets a little of the night through.
//
// This writes src/features/warm-up/art/ and prints the numbers the path
// draws with (path-art.ts holds them, with where each came from). Re-run it
// whenever the art changes; nothing it writes is edited by hand.
//
//   node scripts/sync-warm-art.mjs <codex-plates folder>

import { existsSync, mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import sharp from 'sharp'

const ROOT = process.cwd()
const SOURCE = process.argv[2]
const SKY = 'warm-sky/warm-sky__codex_1.png'
const STOPS = 'postfix/warm-stops__codex_2__postfix.png'
if (
  SOURCE === undefined ||
  !existsSync(join(SOURCE, SKY)) ||
  !existsSync(join(SOURCE, STOPS))
) {
  console.error('usage: node scripts/sync-warm-art.mjs <codex-plates folder>')
  process.exit(2)
}
const PLATES = resolve(SOURCE)
const ART = join(ROOT, 'src/features/warm-up/art')
mkdirSync(ART, { recursive: true })

/** The sheet's quarters, in reading order. */
const QUARTERS = [
  ['waiting', 0, 0],
  ['next', 1, 0],
  ['done', 0, 1],
  ['lit', 1, 1],
]

// ---- the sky ----------------------------------------------------------------

const sky = sharp(join(PLATES, SKY))
const skyMeta = await sky.metadata()
await sky
  .clone()
  .webp({ quality: 92, smartSubsample: true, effort: 6 })
  .toFile(join(ART, 'warm-sky.webp'))

// Where the floor's line of light is: the brightest row in the lower half.
const { data: skyRaw, info: skyInfo } = await sky
  .clone()
  .removeAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true })
let floorRow = 0
let floorLight = -1
for (let y = Math.floor(skyInfo.height / 2); y < skyInfo.height; y += 1) {
  let sum = 0
  for (let x = 0; x < skyInfo.width; x += 1) {
    const at = (y * skyInfo.width + x) * skyInfo.channels
    sum += skyRaw[at] + skyRaw[at + 1] + skyRaw[at + 2]
  }
  if (sum > floorLight) {
    floorLight = sum
    floorRow = y
  }
}

/** The mean colour of a band of rows, as #rrggbb. */
function bandColour(fromRow, toRow) {
  const total = [0, 0, 0]
  let n = 0
  for (let y = fromRow; y < toRow; y += 1) {
    for (let x = 0; x < skyInfo.width; x += 1) {
      const at = (y * skyInfo.width + x) * skyInfo.channels
      total[0] += skyRaw[at]
      total[1] += skyRaw[at + 1]
      total[2] += skyRaw[at + 2]
      n += 1
    }
  }
  return `#${total
    .map((v) =>
      Math.round(v / n)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`
}

// ---- the orbs ---------------------------------------------------------------

const sheet = sharp(join(PLATES, STOPS)).removeAlpha()
const sheetMeta = await sheet.metadata()
const side = Math.floor(sheetMeta.width / 2)

for (const [name, col, row] of QUARTERS) {
  const { data, info } = await sheet
    .clone()
    .extract({ left: col * side, top: row * side, width: side, height: side })
    .raw()
    .toBuffer({ resolveWithObject: true })
  const rgba = Buffer.alloc(info.width * info.height * 4)
  for (let i = 0; i < info.width * info.height; i += 1) {
    const r = data[i * 3]
    const g = data[i * 3 + 1]
    const b = data[i * 3 + 2]
    const a = Math.max(r, g, b)
    const k = a === 0 ? 0 : 255 / a
    rgba[i * 4] = Math.min(255, Math.round(r * k))
    rgba[i * 4 + 1] = Math.min(255, Math.round(g * k))
    rgba[i * 4 + 2] = Math.min(255, Math.round(b * k))
    rgba[i * 4 + 3] = a
  }
  await sharp(rgba, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .webp({ quality: 90, alphaQuality: 100, effort: 6 })
    .toFile(join(ART, `warm-stop-${name}.webp`))
}

console.log(
  JSON.stringify(
    {
      sky: {
        width: skyMeta.width,
        height: skyMeta.height,
        floor: +(floorRow / skyMeta.height).toFixed(4),
        top: bandColour(0, 8),
        bottom: bandColour(skyInfo.height - 8, skyInfo.height),
      },
      stops: { side },
    },
    null,
    2,
  ),
)
