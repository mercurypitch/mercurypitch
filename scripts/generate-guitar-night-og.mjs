// Generate the Guitar Night social-share card (public/guitar-night-og.png).
//
// Third of the set, after karaoke and jam, and built the same way: a designed
// 1200x630 Open Graph image made of the page's real ingredients — the velvet
// rehearsal room (public/guitar-night/velvet-rehearsal.webp) under the room's
// own scrim, the MercuryPitch lockup, and the entry panel restaged as a poster.
//
// The palette and the serif headline are lifted from
// GuitarNightApp.module.css rather than the brand spectrum: Guitar Night is a
// warm amber room, and a blue-teal card would look like a different product.
//
// Deterministic + self-contained: the backdrop is inlined as a data URI and the
// brand mark is inline SVG, so the render never depends on a dev server. Brand
// fonts (Outfit + Inter) load from Google Fonts with a system-ui fallback.
//
//   node scripts/generate-guitar-night-og.mjs  # -> public/guitar-night-og.png
//   OUT=/tmp/preview.png node scripts/generate-jam-og.mjs
import { chromium } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(__dirname, '..')
const OUT = process.env.OUT || resolve(REPO, 'public/guitar-night-og.png')

const W = 1200
const H = 630

// Inline the room backdrop so the render is self-contained.
const backdrop = readFileSync(
  resolve(REPO, 'public/guitar-night/velvet-rehearsal.webp'),
)
const backdropUri = `data:image/webp;base64,${backdrop.toString('base64')}`

// The soundglobe brand mark (public/favicon.svg), inline so it needs no fetch.
const mark = readFileSync(resolve(REPO, 'public/favicon.svg'), 'utf8')

// The room's three ways in, exactly as the entry panel offers them.
const WAYS = [
  { name: 'Start', note: 'Read your first bar on one open string', lead: true },
  { name: 'Load a song', note: 'A prepared song, or your own audio' },
  { name: 'I know my way around', note: 'Straight to the Guitar workspace' },
]

const wayRows = WAYS.map(
  (w) => `
      <div class="way${w.lead ? ' lead' : ''}">
        <span class="w-name">${w.name}</span>
        <span class="w-note">${w.note}</span>
      </div>`,
).join('')

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
    --night: #0d0b09;
    --ivory: #f4eadb;
    --muted: #baac99;
    --dim: #8c7f6e;
    --amber: #e0a45d;
    --amber-bright: #f0bd78;
    --teal: #6acabd;
  }
  html, body { width: ${W}px; height: ${H}px; background: var(--night); overflow: hidden; }
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
  /* Same contract as the karaoke card: hold the copy column (left ~55%) dark
     enough for AA contrast, let the room read through on the right. */
  .scrim {
    position: absolute; inset: 0;
    background:
      linear-gradient(100deg,
        rgba(13,11,9,0.96) 0%,
        rgba(13,11,9,0.9) 32%,
        rgba(13,11,9,0.4) 52%,
        rgba(13,11,9,0.06) 76%,
        rgba(13,11,9,0) 100%),
      linear-gradient(180deg,
        rgba(13,11,9,0.66) 0%,
        rgba(13,11,9,0.06) 40%,
        rgba(13,11,9,0.2) 70%,
        rgba(13,11,9,0.86) 100%);
  }
  .bloom {
    position: absolute; inset: 0;
    background:
      radial-gradient(40% 58% at 70% 44%, rgba(224,164,93,0.28), transparent 64%),
      radial-gradient(26% 40% at 88% 34%, rgba(106,202,189,0.12), transparent 60%),
      radial-gradient(120% 90% at 2% 112%, rgba(224,164,93,0.1), transparent 46%);
    mix-blend-mode: screen;
  }

  .content {
    position: relative; z-index: 2;
    height: 100%;
    padding: 60px 64px 52px;
    display: flex; flex-direction: column;
  }

  .brand { display: flex; align-items: center; gap: 14px; }
  .brand .globe { width: 46px; height: 46px; border-radius: 50%; box-shadow: 0 4px 18px rgba(224,164,93,0.32); flex: none; display: block; }
  .brand .globe svg { display: block; width: 100%; height: 100%; }
  .wordmark { font-family: 'Outfit', sans-serif; font-weight: 700; font-size: 27px; letter-spacing: -0.01em; }
  .wordmark .p { color: var(--amber-bright); }
  .divider { width: 1px; height: 26px; background: rgba(244,234,219,0.28); }
  .kicker {
    font-family: 'Outfit', sans-serif; font-weight: 700;
    font-size: 15px; letter-spacing: 0.26em; text-transform: uppercase; color: var(--amber);
  }

  /* The room's own face: a quiet serif, not the brand's Outfit. Guitar Night
     is the one surface that speaks in it. */
  .headline {
    font-family: 'Iowan Old Style', 'Palatino Linotype', 'Book Antiqua', Georgia, serif;
    font-weight: 500;
    font-size: 82px; line-height: 0.98; letter-spacing: -0.045em;
    margin-top: auto; max-width: 620px;
    padding-bottom: 0.06em;
    background: linear-gradient(112deg, #fdf3e4 6%, var(--amber-bright) 58%, var(--amber) 100%);
    -webkit-background-clip: text; background-clip: text; color: transparent;
    filter: drop-shadow(0 3px 26px rgba(13,11,9,0.7));
  }
  .sub {
    margin-top: 22px; max-width: 580px;
    font-size: 23px; line-height: 1.5; color: var(--muted);
    text-shadow: 0 1px 10px rgba(13,11,9,0.94);
  }
  .sub b { color: #fff; font-weight: 600; }

  .pills { display: flex; gap: 12px; margin-top: 30px; }
  .pill {
    display: inline-flex; align-items: center; gap: 9px;
    padding: 10px 16px 10px 13px; border-radius: 999px;
    background: rgba(23,19,15,0.7); border: 1px solid rgba(224,164,93,0.3);
    backdrop-filter: blur(6px);
    font-size: 17px; font-weight: 500; color: var(--muted);
  }
  .pill .dot {
    width: 22px; height: 22px; border-radius: 50%; flex: none;
    display: grid; place-items: center;
    background: linear-gradient(120deg, var(--amber-bright), var(--amber)); color: #1b120a;
  }
  .pill .dot svg { width: 14px; height: 14px; display: block; }

  .spacer { flex: 1 1 auto; }

  .footline {
    display: flex; align-items: center; gap: 12px;
    font-size: 15px; color: var(--dim);
  }
  .footline .url { color: var(--ivory); font-weight: 600; }
  .footline .sep { opacity: 0.5; }

  /* The entry panel, restaged: the same three ways in the room offers, in the
     same order, with Start carrying the amber the button carries. */
  .panel {
    position: absolute; z-index: 3; right: 60px; top: 150px; width: 342px;
    padding: 24px 24px 20px;
    border-radius: 16px;
    background: rgba(20,16,13,0.76);
    border: 1px solid rgba(224,164,93,0.28);
    box-shadow: 0 26px 64px rgba(6,4,3,0.66), 0 0 0 1px rgba(255,255,255,0.02) inset;
    backdrop-filter: blur(10px);
  }
  .panel .p-kicker {
    font-family: 'Inter', sans-serif; font-weight: 700;
    font-size: 12px; letter-spacing: 0.22em; text-transform: uppercase; color: var(--amber);
  }
  .way {
    margin-top: 12px; padding: 12px 14px; border-radius: 10px;
    background: rgba(244,234,219,0.05);
    border: 1px solid rgba(244,234,219,0.08);
  }
  .way.lead {
    background: linear-gradient(110deg, var(--amber-bright), #f7c98a);
    border-color: transparent;
  }
  .way .w-name {
    display: block; font-family: 'Inter', sans-serif; font-weight: 700;
    font-size: 18px; color: var(--ivory); line-height: 1.2;
  }
  .way.lead .w-name { color: #1b120a; }
  .way .w-note { display: block; font-size: 13px; color: var(--dim); margin-top: 3px; line-height: 1.35; }
  .way.lead .w-note { color: rgba(27,18,10,0.72); }
</style>
</head>
<body>
  <div class="card">
    <div class="bg"></div>
    <div class="scrim"></div>
    <div class="bloom"></div>

    <aside class="panel">
      <div class="p-kicker">The room is quiet</div>
      ${wayRows}
    </aside>

    <div class="content">
      <div class="brand">
        <span class="globe">${mark}</span>
        <span class="wordmark">Mercury<span class="p">Pitch</span></span>
        <span class="divider"></span>
        <span class="kicker">Guitar Night</span>
      </div>

      <h1 class="headline">Your room is ready</h1>
      <p class="sub">Begin with one string, bring a song, or step straight into the full workspace. <b>The room listens</b> and reads the bar back to you.</p>

      <div class="pills">
        <span class="pill"><span class="dot"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></span>One string to start</span>
        <span class="pill"><span class="dot"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></span>Bring your own song</span>
        <span class="pill"><span class="dot"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></span>Tab and notation</span>
      </div>

      <div class="spacer"></div>

      <div class="footline">
        <span class="url">mercurypitch.com/guitar-night</span>
        <span class="sep">•</span>
        <span>Velvet Rehearsal — no install, runs in the browser</span>
      </div>
    </div>
  </div>
</body>
</html>`

const browser = await chromium.launch({ args: ['--no-sandbox'] })
// deviceScaleFactor 1 -> the file is exactly 1200x630, matching the sibling
// the sibling cards and the og:image:width/height in guitar-night.html.
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
