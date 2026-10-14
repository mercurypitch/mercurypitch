// Generate wordmark v2, the logo the mails show above their card.
//
//   node scripts/generate-mail-wordmark.mjs   # -> public/email/wordmark-v2-2x.png
//
// v2 is wordmark v1 (public/email/wordmark-v1-2x.png, 408x80, a 2x picture
// shown at 204x40) laid on a rounded plate in the mail page colour, with
// 16 px of plate on every side and transparent corners: 440x112, shown at
// 220x56.
//
// Why the plate: the mails are dark, but Gmail on iPhone in dark mode
// recolours them light, page and card included. It never recolours a
// picture, so v1's white "Mercury" ended up white on light grey. On our dark
// page the plate is the page colour and cannot be seen; on a recoloured page
// it reads as a dark badge, and the wordmark on it stays readable.
//
// v1 is the source rather than the brand lockup SVG: nothing in the repo
// records how v1 was drawn, and the lockup SVG does not reproduce it (its
// text comes out about 1.37 times smaller against the orb). Compositing v1
// keeps the logo exactly as the mails already show it, and needs no network
// or font to regenerate.
//
// A sent mail can never be changed, so a changed wordmark gets a new name and
// the old files stay in public/email.
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(__dirname, '..')
const SOURCE = resolve(REPO, 'public/email/wordmark-v1-2x.png')
const OUT = process.env.OUT || resolve(REPO, 'public/email/wordmark-v2-2x.png')

/** The mail page colour, W.page in workers/db-worker/src/email-layout.ts. */
const PAGE = '#010409'
/** 8 px of plate around the wordmark in the mail, 12 px corners; 2x here. */
const PAD = 16
const RADIUS = 24

const { width, height } = await sharp(SOURCE).metadata()
if (width !== 408 || height !== 80)
  throw new Error(`expected v1 at 408x80, found ${width}x${height}`)

const plateW = width + 2 * PAD
const plateH = height + 2 * PAD
const plate = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${plateW}" height="${plateH}"><rect width="${plateW}" height="${plateH}" rx="${RADIUS}" ry="${RADIUS}" fill="${PAGE}"/></svg>`,
)

await sharp(plate)
  .composite([{ input: SOURCE, left: PAD, top: PAD }])
  .png({ compressionLevel: 9, adaptiveFiltering: true })
  .toFile(OUT)

console.log(
  `wrote ${OUT} (${plateW}x${plateH}, shown at ${plateW / 2}x${plateH / 2})`,
)
