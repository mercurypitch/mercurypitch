// Generate the Piano Night social-share card (public/piano-night-og.png).
//
// Fourth of the set, after karaoke, jam and guitar-night, and built the same
// way: a designed 1200x630 Open Graph image made of the page's real
// ingredients — the Afterglow Studio room
// (public/piano-night/afterglow-studio-landscape.webp, the same one the home
// destination gallery uses for Piano Night), the MercuryPitch lockup, and the
// room list restaged as a poster.
//
// Piano Night was the only entry page in the repo with no Open Graph tags at
// all: every share of a /piano-night link unfurled bare. This is the picture
// half; piano-night.html carries the tags.
//
// The palette is lifted from PianoNightApp.module.css rather than the brand
// spectrum, the way the Guitar Night card lifts amber: Piano Night is brass
// and cyan on near-black, and a warm amber card would look like Guitar Night.
// It keeps Outfit/Inter rather than Guitar Night's serif, because the room
// itself is set in Avenir Next / Inter — the serif is Guitar Night's voice.
//
// Deterministic + self-contained: the backdrop is inlined as a data URI and
// the brand mark is inline SVG, so the render never depends on a dev server.
//
//   node scripts/generate-piano-night-og.mjs  # -> public/piano-night-og.png
//   OUT=/tmp/preview.png node scripts/generate-piano-night-og.mjs
import { chromium } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(__dirname, '..')
const OUT = process.env.OUT || resolve(REPO, 'public/piano-night-og.png')

const W = 1200
const H = 630

// Inline the room backdrop so the render is self-contained.
const backdrop = readFileSync(
  resolve(REPO, 'public/piano-night/afterglow-studio-landscape.webp'),
)
const backdropUri = `data:image/webp;base64,${backdrop.toString('base64')}`

// The soundglobe brand mark (public/favicon.svg), inline so it needs no fetch.
const mark = readFileSync(resolve(REPO, 'public/favicon.svg'), 'utf8')

// The rooms Piano Night actually ships, in catalog order
// (src/lib/backgrounds/background-catalog.ts). Afterglow leads because it is
// the room in the picture.
const ROOMS = [
  { name: 'Afterglow Studio', note: 'Low light, late hour', lead: true },
  { name: 'Morning Conservatory', note: 'Daylight and a long room' },
  { name: 'Nocturne Studio', note: 'Dark wood, one lamp' },
]

const roomRows = ROOMS.map(
  (r) => `
      <div class="room${r.lead ? ' lead' : ''}">
        <span class="r-name">${r.name}</span>
        <span class="r-note">${r.note}</span>
      </div>`,
).join('')

const check = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>`

const html = /* html */ `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  :root {
    /* Straight from PianoNightApp.module.css. */
    --ink: #050709;
    --ivory: #eee7da;
    --ivory-strong: #fffaf0;
    --muted: #b9b0a3;
    --quiet: #8f877d;
    --brass: #b58a50;
    --brass-soft: #d6b778;
    --cyan: #69c4dc;
  }
  html, body { width: ${W}px; height: ${H}px; background: var(--ink); overflow: hidden; }
  body {
    font-family: 'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
    color: var(--ivory);
    -webkit-font-smoothing: antialiased;
  }
  .card { position: relative; width: ${W}px; height: ${H}px; overflow: hidden; }

  .bg {
    position: absolute; inset: 0;
    background: url('${backdropUri}') center / cover no-repeat;
    transform: scale(1.02);
  }
  /* Same contract as the sibling cards: hold the copy column (left ~55%)
     dark enough for AA contrast, let the room read through on the right. */
  .scrim {
    position: absolute; inset: 0;
    background:
      linear-gradient(100deg,
        rgba(5,7,9,0.96) 0%,
        rgba(5,7,9,0.9) 32%,
        rgba(5,7,9,0.4) 52%,
        rgba(5,7,9,0.06) 76%,
        rgba(5,7,9,0) 100%),
      linear-gradient(180deg,
        rgba(5,7,9,0.66) 0%,
        rgba(5,7,9,0.06) 40%,
        rgba(5,7,9,0.2) 70%,
        rgba(5,7,9,0.86) 100%);
  }
  .bloom {
    position: absolute; inset: 0;
    background:
      radial-gradient(40% 58% at 70% 44%, rgba(181,138,80,0.26), transparent 64%),
      radial-gradient(26% 40% at 88% 34%, rgba(105,196,220,0.14), transparent 60%),
      radial-gradient(120% 90% at 2% 112%, rgba(181,138,80,0.1), transparent 46%);
    mix-blend-mode: screen;
  }

  .content {
    position: relative; z-index: 2;
    height: 100%;
    padding: 60px 64px 52px;
    display: flex; flex-direction: column;
  }

  .brand { display: flex; align-items: center; gap: 14px; }
  .brand .globe { width: 46px; height: 46px; border-radius: 50%; box-shadow: 0 4px 18px rgba(181,138,80,0.32); flex: none; display: block; }
  .brand .globe svg { display: block; width: 100%; height: 100%; }
  .wordmark { font-family: 'Outfit', sans-serif; font-weight: 700; font-size: 27px; letter-spacing: -0.01em; }
  .wordmark .p { color: var(--brass-soft); }
  .divider { width: 1px; height: 26px; background: rgba(238,231,218,0.28); }
  .kicker {
    font-family: 'Outfit', sans-serif; font-weight: 700;
    font-size: 15px; letter-spacing: 0.26em; text-transform: uppercase; color: var(--brass-soft);
  }

  /* Outfit, not a serif: the room is set in Avenir Next / Inter, and the
     serif belongs to Guitar Night. */
  .headline {
    font-family: 'Outfit', sans-serif;
    font-weight: 700;
    font-size: 84px; line-height: 1.0; letter-spacing: -0.035em;
    margin-top: auto; max-width: 620px;
    padding-bottom: 0.06em;
    background: linear-gradient(112deg, #fffaf0 6%, var(--brass-soft) 58%, var(--brass) 100%);
    -webkit-background-clip: text; background-clip: text; color: transparent;
    filter: drop-shadow(0 3px 26px rgba(5,7,9,0.7));
  }
  .sub {
    margin-top: 22px; max-width: 580px;
    font-size: 23px; line-height: 1.5; color: var(--muted);
    text-shadow: 0 1px 10px rgba(5,7,9,0.94);
  }
  .sub b { color: #fff; font-weight: 600; }

  .pills { display: flex; gap: 12px; margin-top: 30px; }
  .pill {
    display: inline-flex; align-items: center; gap: 9px;
    padding: 10px 16px 10px 13px; border-radius: 999px;
    background: rgba(9,11,14,0.72); border: 1px solid rgba(181,138,80,0.32);
    backdrop-filter: blur(6px);
    font-size: 17px; font-weight: 500; color: var(--muted);
  }
  .pill .dot {
    width: 22px; height: 22px; border-radius: 50%; flex: none;
    display: grid; place-items: center;
    background: linear-gradient(120deg, var(--brass-soft), var(--brass)); color: #120d07;
  }
  .pill .dot svg { width: 14px; height: 14px; display: block; }

  .spacer { flex: 1 1 auto; }

  .footline {
    display: flex; align-items: center; gap: 12px;
    font-size: 15px; color: var(--quiet);
  }
  .footline .url { color: var(--ivory); font-weight: 600; }
  .footline .sep { opacity: 0.5; }

  /* The room list, restaged — Piano Night's rooms are the thing it opens on. */
  .panel {
    position: absolute; z-index: 3; right: 60px; top: 150px; width: 342px;
    padding: 24px 24px 20px;
    border-radius: 16px;
    background: rgba(9,11,14,0.78);
    border: 1px solid rgba(181,138,80,0.3);
    box-shadow: 0 26px 64px rgba(2,3,4,0.7), 0 0 0 1px rgba(255,255,255,0.02) inset;
    backdrop-filter: blur(10px);
  }
  .panel .p-kicker {
    font-family: 'Inter', sans-serif; font-weight: 700;
    font-size: 12px; letter-spacing: 0.22em; text-transform: uppercase; color: var(--brass-soft);
  }
  .room {
    margin-top: 12px; padding: 12px 14px; border-radius: 10px;
    background: rgba(238,231,218,0.05);
    border: 1px solid rgba(238,231,218,0.08);
  }
  .room.lead {
    background: linear-gradient(110deg, var(--brass-soft), #e6cf9c);
    border-color: transparent;
  }
  .room .r-name {
    display: block; font-family: 'Inter', sans-serif; font-weight: 700;
    font-size: 18px; color: var(--ivory); line-height: 1.2;
  }
  .room.lead .r-name { color: #120d07; }
  .room .r-note { display: block; font-size: 13px; color: var(--quiet); margin-top: 3px; line-height: 1.35; }
  .room.lead .r-note { color: rgba(18,13,7,0.72); }
</style>
</head>
<body>
  <div class="card">
    <div class="bg"></div>
    <div class="scrim"></div>
    <div class="bloom"></div>

    <aside class="panel">
      <div class="p-kicker">Pick a room</div>
      ${roomRows}
    </aside>

    <div class="content">
      <div class="brand">
        <span class="globe">${mark}</span>
        <span class="wordmark">Mercury<span class="p">Pitch</span></span>
        <span class="divider"></span>
        <span class="kicker">Piano Night</span>
      </div>

      <h1 class="headline">Shape every phrase</h1>
      <p class="sub">A focused piano room for practising and performing. <b>Slow a phrase down</b>, loop the bar that will not sit, and play it back up to tempo.</p>

      <div class="pills">
        <span class="pill"><span class="dot">${check}</span>Phrase practice</span>
        <span class="pill"><span class="dot">${check}</span>Loop and slow down</span>
        <span class="pill"><span class="dot">${check}</span>Five rooms</span>
      </div>

      <div class="spacer"></div>

      <div class="footline">
        <span class="url">mercurypitch.com/piano-night</span>
        <span class="sep">•</span>
        <span>Afterglow Studio — no install, runs in the browser</span>
      </div>
    </div>
  </div>
</body>
</html>`

const browser = await chromium.launch({ args: ['--no-sandbox'] })
// deviceScaleFactor 1 -> the file is exactly 1200x630, matching the sibling
// cards and the og:image:width/height in piano-night.html.
const page = await browser.newPage({
  viewport: { width: W, height: H },
  deviceScaleFactor: 1,
})
await page.setContent(html, { waitUntil: 'networkidle' })
// Wait for the webfonts (or give up and fall back to system-ui).
await page
  .evaluate(() => document.fonts.ready.then(() => undefined))
  .catch(() => {})
await page.waitForTimeout(250)
await page.screenshot({ path: OUT, clip: { x: 0, y: 0, width: W, height: H } })
await browser.close()
console.log(`wrote ${OUT} (${W}x${H})`)
