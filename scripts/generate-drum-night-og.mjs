// Generate the Drum Night social-share card (public/drum-night-og.png).
//
// The composition is deterministic and self-contained: the route-owned room
// art and MercuryPitch mark are inlined before Playwright renders the poster.
//
//   node scripts/generate-drum-night-og.mjs
//   OUT=/tmp/drum-night-og.png node scripts/generate-drum-night-og.mjs
import { chromium } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(__dirname, '..')
const OUT = process.env.OUT || resolve(REPO, 'public/drum-night-og.png')
const W = 1200
const H = 630

const backdrop = readFileSync(
  resolve(REPO, 'public/drum-night/pocket-console-landscape.webp'),
)
const backdropUri = `data:image/webp;base64,${backdrop.toString('base64')}`
const mark = readFileSync(resolve(REPO, 'public/favicon.svg'), 'utf8')

const html = /* html */ `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; }
  html, body { width: ${W}px; height: ${H}px; margin: 0; overflow: hidden; background: #08090b; }
  body { color: #eee7db; font-family: Inter, ui-sans-serif, system-ui, sans-serif; -webkit-font-smoothing: antialiased; }
  .card { position: relative; width: 100%; height: 100%; overflow: hidden; }
  .room { position: absolute; inset: 0; background: url('${backdropUri}') 58% 54% / cover no-repeat; transform: scale(1.015); }
  .shade { position: absolute; inset: 0; background: linear-gradient(92deg, rgba(8,9,11,.98) 0%, rgba(8,9,11,.91) 34%, rgba(8,9,11,.38) 58%, rgba(8,9,11,.08) 82%), linear-gradient(180deg, rgba(8,9,11,.45), transparent 38%, rgba(8,9,11,.78)); }
  .glow { position: absolute; inset: 0; background: radial-gradient(38% 64% at 72% 45%, rgba(231,173,82,.22), transparent 70%), radial-gradient(30% 50% at 88% 72%, rgba(127,57,67,.26), transparent 70%); mix-blend-mode: screen; }
  .content { position: relative; z-index: 3; display: flex; height: 100%; flex-direction: column; padding: 54px 62px 46px; }
  .brand { display: flex; align-items: center; gap: 14px; }
  /* Floor under the gap to the headline. margin-top:auto on the headline only
     distributes LEFTOVER space, and a full card leaves almost none, so the
     lockup and the headline ended up nearly touching. */
  .brand { margin-bottom: 46px; }
  .mark { width: 46px; height: 46px; border-radius: 50%; overflow: hidden; box-shadow: 0 5px 20px rgba(231,173,82,.24); }
  .mark svg { width: 100%; height: 100%; }
  .wordmark { font-weight: 760; font-size: 27px; letter-spacing: -.02em; }
  .wordmark b { background: linear-gradient(120deg, #58a6ff 0%, #2dd4bf 50%, #bc8cff 100%); -webkit-background-clip: text; background-clip: text; color: transparent; }
  .divider { width: 1px; height: 26px; background: rgba(238,231,219,.28); }
  .kicker { color: #e7ad52; font-size: 14px; font-weight: 800; letter-spacing: .22em; text-transform: uppercase; }
  h1 { max-width: 610px; margin: auto 0 0; font-family: Georgia, 'Times New Roman', serif; font-size: 78px; font-weight: 520; letter-spacing: -.035em; line-height: .98; text-shadow: 0 4px 28px rgba(0,0,0,.8); }
  .sub { max-width: 580px; margin: 20px 0 0; color: #b8b2a8; font-size: 22px; line-height: 1.45; }
  .sub strong { color: #fffaf0; font-weight: 650; }
  .lenses { display: flex; gap: 10px; margin-top: 27px; }
  .lens { padding: 10px 15px; border: 1px solid rgba(238,231,219,.2); border-radius: 999px; background: rgba(8,9,11,.7); color: #d5d0c7; font-size: 15px; font-weight: 650; }
  .lens:first-child { border-color: rgba(231,173,82,.62); color: #08090b; background: #eee7db; }
  .foot { display: flex; margin-top: auto; align-items: center; gap: 12px; color: #8f8980; font-size: 15px; }
  .foot strong { color: #eee7db; }
  /* The pocket, as a timing lane rather than the concentric-ellipse orbit this
     card shipped with. Hits sit against a beat grid at the distance they were
     actually played from it -- which is the thing the room measures, and reads
     at thumbnail size in a way an orbit never did. */
  .lane { position: absolute; z-index: 2; right: 54px; top: 176px; width: 560px; height: 250px; opacity: .95; }
  .lane .grid { stroke: rgba(238,231,219,.34); stroke-width: 1.5; }
  .lane .centre { stroke: rgba(102,213,205,.45); stroke-width: 2; stroke-dasharray: 5 7; }
  .lane .hit { stroke-width: 8; stroke-linecap: round; }
  .lane .on { stroke: #66d5cd; }
  .lane .anchor { stroke: #e7ad52; }
  .lane .late { stroke: #c96c70; }
</style>
</head>
<body>
  <div class="card">
    <div class="room"></div><div class="shade"></div><div class="glow"></div>
    <svg class="lane" viewBox="0 0 560 250" aria-hidden="true">
      <line class="grid" x1="40" y1="58" x2="40" y2="192" /><line class="grid" x1="105" y1="58" x2="105" y2="192" /><line class="grid" x1="170" y1="58" x2="170" y2="192" /><line class="grid" x1="235" y1="58" x2="235" y2="192" /><line class="grid" x1="300" y1="58" x2="300" y2="192" /><line class="grid" x1="365" y1="58" x2="365" y2="192" /><line class="grid" x1="430" y1="58" x2="430" y2="192" /><line class="grid" x1="495" y1="58" x2="495" y2="192" />
      <line class="centre" x1="18" y1="125" x2="542" y2="125" />
      <line class="hit on" x1="33" y1="86" x2="33" y2="164" /><line class="hit anchor" x1="105" y1="86" x2="105" y2="164" /><line class="hit on" x1="173" y1="86" x2="173" y2="164" /><line class="hit on" x1="235" y1="86" x2="235" y2="164" /><line class="hit on" x1="296" y1="86" x2="296" y2="164" /><line class="hit anchor" x1="365" y1="86" x2="365" y2="164" /><line class="hit on" x1="432" y1="86" x2="432" y2="164" /><line class="hit late" x1="509" y1="86" x2="509" y2="164" />
    </svg>
    <div class="content">
      <div class="brand">
        <span class="mark">${mark}</span>
        <span class="wordmark">Mercury<b>Pitch</b></span>
        <span class="divider"></span>
        <span class="kicker">Drum Night</span>
      </div>
      <h1>Find the centre.<br />Let it move.</h1>
      <p class="sub">A focused drum room for playing the pocket and turning <strong>one timing insight</strong> into the next clean take.</p>
      <div class="lenses"><span class="lens">Pocket</span><span class="lens">Score</span><span class="lens">Kit</span></div>
      <div class="foot"><strong>mercurypitch.com/drum-night</strong><span>·</span><span>Pocket Console — runs in the browser</span></div>
    </div>
  </div>
</body>
</html>`

const browser = await chromium.launch({ args: ['--no-sandbox'] })
const page = await browser.newPage({
  viewport: { width: W, height: H },
  deviceScaleFactor: 1,
})
await page.setContent(html, { waitUntil: 'load' })
await page.screenshot({
  path: OUT,
  clip: { x: 0, y: 0, width: W, height: H },
})
await browser.close()
console.log(`wrote ${OUT} (${W}x${H})`)
