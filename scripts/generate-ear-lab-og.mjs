// Generate the Ear Lab social-share card (public/ear-lab-og.png).
//
// Built the way the karaoke, jam and guitar-night cards are: a designed
// 1200x630 Open Graph image made of the page's real ingredients — the
// Regulator Room (public/ear-lab/regulator-room-landscape.webp) under the
// room's own scrim, the MercuryPitch lockup, and the bench's grammar: a
// parchment serif headline, brass rules, tabular readings, no percent.
//
// The Ear Lab is a tab of the main app rather than an entry of its own, so
// nothing references this file yet; it exists so a share route or a
// landing section can pick it up without a design pass. Preview it with
// OUT= before committing a PNG.
//
// Deterministic + self-contained: the backdrop is inlined as a data URI and
// the brand mark is inline SVG, so the render never depends on a dev
// server. Inter loads from Google Fonts; the serif is the bench's system stack.
//
//   node scripts/generate-ear-lab-og.mjs           # -> public/ear-lab-og.png
//   OUT=/tmp/preview.png node scripts/generate-ear-lab-og.mjs

import { chromium } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(__dirname, '..')
const OUT = process.env.OUT || resolve(REPO, 'public/ear-lab-og.png')
const W = 1200
const H = 630

const backdrop = readFileSync(
  resolve(REPO, 'public/ear-lab/regulator-room-landscape.webp'),
)
const backdropUrl = `data:image/webp;base64,${backdrop.toString('base64')}`
const mark = readFileSync(resolve(REPO, 'public/favicon.svg'), 'utf8')

const SERIF = `'Iowan Old Style', 'Palatino Linotype', Baskerville, Georgia,
    'Times New Roman', serif`
// The bench's serif is a system stack (Iowan Old Style, Palatino, Georgia),
// so only Inter comes from Google Fonts.
const FONT_LINK =
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap'

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<link rel="stylesheet" href="${FONT_LINK}" />
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: ${W}px; height: ${H}px; overflow: hidden; }
  body {
    position: relative;
    background: #0a0b0d;
    color: #efe6d6;
    font-family: Inter, system-ui, sans-serif;
  }
  .room {
    position: absolute; inset: 0;
    background: url("${backdropUrl}") center 40% / cover no-repeat;
  }
  .scrim {
    position: absolute; inset: 0;
    background:
      linear-gradient(90deg, rgba(10, 11, 13, 0.92) 0%, rgba(10, 11, 13, 0.78) 46%, rgba(10, 11, 13, 0.28) 100%),
      linear-gradient(180deg, rgba(10, 11, 13, 0.1) 0%, rgba(10, 11, 13, 0.55) 100%);
  }
  .lamp {
    position: absolute; inset: 0;
    background: radial-gradient(60% 50% at 78% 12%, rgba(231, 198, 125, 0.28), transparent 70%);
    mix-blend-mode: soft-light;
  }
  .brand {
    position: absolute; left: 72px; top: 60px;
    display: flex; align-items: center; gap: 14px;
    font-weight: 600; font-size: 22px; letter-spacing: 0.01em; color: #efe6d6;
  }
  .brand svg { width: 34px; height: 34px; }
  .eyebrow {
    position: absolute; left: 72px; top: 178px;
    font-size: 15px; font-weight: 600; letter-spacing: 0.22em; text-transform: uppercase;
    color: #c9a45e;
  }
  .rule {
    position: absolute; left: 72px; top: 212px; width: 120px; height: 1px;
    background: linear-gradient(90deg, #e7c67d, rgba(231, 198, 125, 0));
  }
  h1 {
    position: absolute; left: 68px; top: 236px; width: 640px;
    font-family: ${SERIF};
    font-weight: 400; font-size: 96px; line-height: 0.98; letter-spacing: -0.01em;
    color: #efe6d6;
  }
  .lede {
    position: absolute; left: 72px; top: 372px; width: 560px;
    font-family: ${SERIF};
    font-size: 27px; line-height: 1.32; color: #d9cfbd;
  }
  .lede em { font-style: italic; color: #e7c67d; }
  .readings {
    position: absolute; left: 72px; bottom: 58px;
    display: flex; gap: 40px;
  }
  .reading { display: grid; gap: 6px; }
  .reading b {
    font-family: ${SERIF};
    font-weight: 500; font-size: 34px; line-height: 1; color: #efe6d6;
    font-variant-numeric: tabular-nums;
  }
  .reading b small { font-size: 18px; color: #c9a45e; margin-left: 4px; }
  .reading span {
    font-size: 12px; letter-spacing: 0.16em; text-transform: uppercase; color: #b9b1a4;
  }
  .column {
    position: absolute; right: 118px; top: 96px; width: 150px; height: 440px;
  }
</style>
</head>
<body>
  <div class="room"></div>
  <div class="scrim"></div>
  <div class="lamp"></div>
  <div class="brand">${mark}<span>MercuryPitch</span></div>
  <div class="eyebrow">Measured, not scored</div>
  <div class="rule"></div>
  <h1>Ear Lab</h1>
  <p class="lede">A chronometer workshop for the ear. Thresholds in cents and milliseconds, chords named — <em>one number that moves only when your ear does.</em></p>
  <div class="readings">
    <div class="reading"><b>6.4<small>¢</small></b><span>Hairline</span></div>
    <div class="reading"><b>18<small>ms</small></b><span>The Grid</span></div>
    <div class="reading"><b>618</b><span>Mercury Index</span></div>
  </div>
  <svg class="column" viewBox="0 0 150 440" fill="none">
    <rect x="53" y="18" width="44" height="380" rx="22" stroke="#c9a45e" stroke-opacity="0.75" stroke-width="1.5" />
    <rect x="61" y="150" width="28" height="240" rx="14" fill="#c5ced8" fill-opacity="0.92" />
    <rect x="61" y="150" width="28" height="240" rx="14" fill="url(#g)" />
    <defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#ffffff" stop-opacity="0.35" /><stop offset="0.5" stop-color="#ffffff" stop-opacity="0" /><stop offset="1" stop-color="#000000" stop-opacity="0.25" /></linearGradient></defs>
    <circle cx="75" cy="392" r="30" fill="#c5ced8" fill-opacity="0.92" stroke="#c9a45e" stroke-opacity="0.75" stroke-width="1.5" />
    <g stroke="#e7c67d" stroke-opacity="0.9" stroke-width="1.2">
      <line x1="100" y1="60" x2="118" y2="60" /><line x1="100" y1="120" x2="112" y2="120" />
      <line x1="100" y1="180" x2="118" y2="180" /><line x1="100" y1="240" x2="112" y2="240" />
      <line x1="100" y1="300" x2="118" y2="300" /><line x1="100" y1="360" x2="112" y2="360" />
    </g>
    <g font-family="Inter, system-ui, sans-serif" font-size="11" fill="#c9a45e" letter-spacing="0.08em">
      <text x="124" y="64">1000</text><text x="124" y="184">750</text><text x="124" y="304">500</text>
    </g>
    <line x1="40" y1="150" x2="110" y2="150" stroke="#e7c67d" stroke-width="1.5" />
    <text x="8" y="146" font-family="Inter, system-ui, sans-serif" font-size="11" fill="#e7c67d" letter-spacing="0.08em">618</text>
  </svg>
</body>
</html>`

const browser = await chromium.launch()
try {
  const page = await browser.newPage({
    viewport: { width: W, height: H },
    deviceScaleFactor: 1,
  })
  await page.setContent(html, { waitUntil: 'networkidle' })
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(150)
  await page.screenshot({
    path: OUT,
    type: 'png',
    clip: { x: 0, y: 0, width: W, height: H },
  })
  console.log(`wrote ${OUT}`)
} finally {
  await browser.close()
}
