// Generate the shared social-share card (public/og-image.png).
//
// This is the card for every page that has none of its own: the cosmic
// terminator key visual with the orb-and-wordmark lockup in its sky. Until
// 0.9.20 it was put together by hand (ImageMagick, 2026-07-11) from the whole
// key visual. That image is 2.4:1 art inside its own black letterbox, so the
// 1200x630 card carried 65 black rows above the art and 65 below. Here the art
// is cropped to the card instead, and it reaches all four edges.
//
// Backdrop: assets/og-backdrops/cosmic-terminator.jpg is the key visual's art
// band, rows 200-1335 of the 2752x1536 master, cut losslessly so no letterbox
// row survives:
//
//   git show 0e579acff:docs/branding/imagery/cosmic-terminator.jpg > master.jpg
//   jpegtran -copy icc -perfect -crop 2752x1136+0+200 -outfile cosmic-terminator.jpg master.jpg
//
// The lockup is docs/branding/logo/meniscus2/lockup-horizontal.svg at the size
// the hand-made card used (orb radius 56.5 px), and Outfit is inlined from the
// bundled @fontsource file, so the render needs no network.
//
//   node scripts/generate-og-image.mjs                 # -> public/og-image.png + the docs master
//   OUT=preview.png node scripts/generate-og-image.mjs # -> preview.png only
//
// Then run `node scripts/gen-og-versions.mjs` and put the new stamp in the two
// `og-image.png?v=` URLs in index.html.
import { chromium } from '@playwright/test'
import { copyFileSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(__dirname, '..')
const SHIPPED = resolve(REPO, 'public/og-image.png')
// docs/agent/DOCS-AUDIT.md: the shipped card and the brand master are the
// same bytes, so a regenerated card replaces both.
const MASTER = resolve(REPO, 'docs/branding/logo/meniscus2/og-image.png')
const OUT = process.env.OUT ? resolve(process.env.OUT) : SHIPPED

const W = 1200
const H = 630

// 2160x1134 is exactly 40:21, the card's own shape, so the resize to 1200x630
// is a clean 5/9 with no stretch. `top: 1` centres it in the 1136 rows of the
// band. `left: 164` keeps the planet where the hand-made card had it, its
// centre a little over a quarter of the way in (x 333); the 428 px trimmed
// off the right are open sky.
const CROP = { left: 164, top: 1, width: 2160, height: 1134 }

// Where the orb's centre lands. The planet's lit edge now reaches x 483, and
// the lockup (orb plus wordmark, 460 px of ink) sits centred in the sky
// between it and the right edge, at the card's vertical middle, as before.
const ORB = { x: 668, y: 315, r: 56.5 }

const backdrop = await sharp(
  resolve(REPO, 'assets/og-backdrops/cosmic-terminator.jpg'),
)
  .extract(CROP)
  .resize(W, H)
  .png()
  .toBuffer()
const backdropUri = `data:image/png;base64,${backdrop.toString('base64')}`

const outfit = readFileSync(
  resolve(
    REPO,
    'node_modules/@fontsource-variable/outfit/files/outfit-latin-wght-normal.woff2',
  ),
)
const outfitUri = `data:font/woff2;base64,${outfit.toString('base64')}`

// lockup-horizontal.svg draws its orb at (130, 130) with radius 118 in a
// 1180x260 box. Its "Pitch" is filled with a bounding-box gradient, and at
// card size Chromium spreads that over about 1.11 times the word's width (at
// full size it does not), so the "h" stopped short of violet: 0.89 of the way
// along the spectrum against the hand-made card's 0.99. Pinning the gradient
// to the word's own box, x 292-980 in the lockup's units (getBBox of the text
// in Chromium), puts every letter back on the colour it had.
const WORD_SPECTRUM = /* svg */ `<linearGradient id="wordSpectrum" gradientUnits="userSpaceOnUse" x1="292" y1="0" x2="980" y2="0">
      <stop offset="0" stop-color="#58a6ff"/>
      <stop offset="0.5" stop-color="#2dd4bf"/>
      <stop offset="1" stop-color="#bc8cff"/>
    </linearGradient>
  </defs>`
const lockupSvg = readFileSync(
  resolve(REPO, 'docs/branding/logo/meniscus2/lockup-horizontal.svg'),
  'utf8',
)
const PITCH = '<tspan fill="url(#spectrum2)">Pitch</tspan>'
if (!lockupSvg.includes(PITCH) || !lockupSvg.includes('</defs>')) {
  throw new Error('lockup-horizontal.svg changed shape; update this script')
}
const lockup = lockupSvg
  .replace('<svg ', '<svg class="lockup" ')
  .replace('</defs>', WORD_SPECTRUM)
  .replace(PITCH, '<tspan fill="url(#wordSpectrum)">Pitch</tspan>')
const scale = ORB.r / 118
const lockupBox = {
  left: ORB.x - 130 * scale,
  top: ORB.y - 130 * scale,
  width: 1180 * scale,
  height: 260 * scale,
}

const html = /* html */ `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<style>
  @font-face {
    font-family: 'Outfit';
    font-style: normal;
    font-weight: 100 900;
    src: url('${outfitUri}') format('woff2');
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: ${W}px; height: ${H}px; overflow: hidden; background: #000; }
  .card {
    position: relative; width: ${W}px; height: ${H}px;
    background: url('${backdropUri}') 0 0 / ${W}px ${H}px no-repeat;
  }
  .lockup {
    position: absolute; display: block;
    left: ${lockupBox.left.toFixed(3)}px; top: ${lockupBox.top.toFixed(3)}px;
    width: ${lockupBox.width.toFixed(3)}px; height: ${lockupBox.height.toFixed(3)}px;
  }
</style>
</head>
<body>
  <div class="card">${lockup}</div>
</body>
</html>`

const browser = await chromium.launch({ args: ['--no-sandbox'] })
try {
  // deviceScaleFactor 1: the file is exactly the 1200x630 that index.html
  // declares in og:image:width and og:image:height.
  const page = await browser.newPage({
    viewport: { width: W, height: H },
    deviceScaleFactor: 1,
  })
  await page.setContent(html, { waitUntil: 'load' })
  const outfitReady = await page.evaluate(async () => {
    await document.fonts.ready
    return document.fonts.check('600 56px Outfit')
  })
  // The wordmark is the brand: never ship it in a fallback face.
  if (!outfitReady) throw new Error('Outfit did not load; nothing written')
  const shot = await page.screenshot({
    clip: { x: 0, y: 0, width: W, height: H },
  })
  // Lossless: the same pixels, packed tighter than the screenshot encoder.
  const png = await sharp(shot)
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer()
  writeFileSync(OUT, png)
  if (OUT === SHIPPED) copyFileSync(SHIPPED, MASTER)
  console.log(
    `wrote ${OUT}${OUT === SHIPPED ? ` and ${MASTER}` : ''} (${W}x${H})`,
  )
} finally {
  await browser.close()
}
