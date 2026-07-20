// Generate the Karaoke Night social-share card (public/karaoke-og.png).
//
// A designed 1200x630 Open Graph image that mirrors the real /karaoke landing:
// the theatre backdrop (public/karaoke-night-stage.webp) under the page's plum
// scrim, the MercuryPitch lockup, the gradient headline, the three-step promise,
// and the "Tonight's opener" demo-song card lit by the stage spotlight.
//
// Deterministic + self-contained: the backdrop is inlined as a data URI and the
// brand mark is inline SVG, so the render never depends on a dev server. Brand
// fonts (Outfit + Inter) load from Google Fonts with a system-ui fallback.
//
//   node scripts/generate-karaoke-og.mjs           # -> public/karaoke-og.png
//   OUT=/tmp/preview.png node scripts/generate-karaoke-og.mjs
import { chromium } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(__dirname, '..')
const OUT = process.env.OUT || resolve(REPO, 'public/karaoke-og.png')

const W = 1200
const H = 630

// Inline the theatre backdrop so the render is self-contained.
const backdrop = readFileSync(resolve(REPO, 'public/karaoke-night-stage.webp'))
const backdropUri = `data:image/webp;base64,${backdrop.toString('base64')}`

// The soundglobe brand mark (public/favicon.svg), inline so it needs no fetch.
const mark = readFileSync(resolve(REPO, 'public/favicon.svg'), 'utf8')

const html = /* html */ `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@500;600;700;800&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  :root {
    --plum: #12081f;
    --ink: #f4ecff;
    --lav: #e8dcfa;
    --lav-dim: #cdbde6;
    --purple: #b79ae0;
    --gold: #ffd9a0;
    --pink: #ff9ad5;
    --blue: #58a6ff;
  }
  html, body { width: ${W}px; height: ${H}px; background: var(--plum); overflow: hidden; }
  body {
    font-family: 'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
    color: var(--ink);
    -webkit-font-smoothing: antialiased;
  }
  .card { position: relative; width: ${W}px; height: ${H}px; overflow: hidden; }

  .bg {
    position: absolute; inset: 0;
    background: url('${backdropUri}') center / cover no-repeat;
    transform: scale(1.02);
  }
  /* Match the page scrim, but keep the copy column (left ~55%) dark for AA
     legibility while letting the theatre — mic, spotlight, curtains — read
     through on the right. */
  .scrim {
    position: absolute; inset: 0;
    background:
      linear-gradient(100deg,
        rgba(18,8,31,0.95) 0%,
        rgba(18,8,31,0.9) 30%,
        rgba(18,8,31,0.55) 50%,
        rgba(18,8,31,0.18) 72%,
        rgba(18,8,31,0.05) 100%),
      linear-gradient(180deg,
        rgba(18,8,31,0.7) 0%,
        rgba(18,8,31,0.12) 42%,
        rgba(18,8,31,0.34) 72%,
        rgba(18,8,31,0.82) 100%);
  }
  /* Warm spotlight bloom on the stage + a pink bloom bottom-left, echoing the
     stage lighting. */
  .bloom {
    position: absolute; inset: 0;
    background:
      radial-gradient(42% 58% at 73% 44%, rgba(255,214,160,0.16), transparent 62%),
      radial-gradient(120% 90% at 2% 110%, rgba(255,154,213,0.16), transparent 44%);
    mix-blend-mode: screen;
  }

  .content {
    position: relative; z-index: 2;
    height: 100%;
    padding: 60px 64px 52px;
    display: flex; flex-direction: column;
  }

  /* Brand lockup */
  .brand { display: flex; align-items: center; gap: 14px; }
  .brand .globe { width: 46px; height: 46px; border-radius: 50%; box-shadow: 0 4px 18px rgba(88,166,255,0.35); flex: none; display: block; }
  .brand .globe svg { display: block; width: 100%; height: 100%; }
  .wordmark { font-family: 'Outfit', sans-serif; font-weight: 700; font-size: 27px; letter-spacing: -0.01em; }
  .wordmark .p { color: var(--blue); }
  .divider { width: 1px; height: 26px; background: rgba(232,220,250,0.28); }
  .kicker {
    font-family: 'Outfit', sans-serif; font-weight: 700;
    font-size: 15px; letter-spacing: 0.26em; text-transform: uppercase; color: var(--gold);
  }

  .headline {
    font-family: 'Outfit', sans-serif; font-weight: 800;
    font-size: 74px; line-height: 1.04; letter-spacing: -0.015em;
    margin-top: auto; max-width: 720px;
    padding-bottom: 0.08em;
    background: linear-gradient(118deg, #ffe3b8 4%, var(--gold) 26%, var(--pink) 60%, #c3a8ff 100%);
    -webkit-background-clip: text; background-clip: text; color: transparent;
    filter: drop-shadow(0 3px 22px rgba(18,8,31,0.55));
  }
  .sub {
    margin-top: 22px; max-width: 600px;
    font-size: 24px; line-height: 1.46; color: var(--lav);
    text-shadow: 0 1px 10px rgba(18,8,31,0.9);
  }
  .sub b { color: #fff; font-weight: 600; }

  .pills { display: flex; gap: 12px; margin-top: 30px; }
  .pill {
    display: inline-flex; align-items: center; gap: 9px;
    padding: 10px 16px 10px 13px; border-radius: 999px;
    background: rgba(24,12,40,0.62); border: 1px solid rgba(183,154,224,0.34);
    backdrop-filter: blur(6px);
    font-size: 17px; font-weight: 500; color: var(--lav);
  }
  .pill .dot {
    width: 22px; height: 22px; border-radius: 50%; flex: none;
    display: grid; place-items: center;
    background: linear-gradient(120deg, var(--gold), var(--pink)); color: #1a0b2e;
  }
  .pill .dot svg { width: 14px; height: 14px; display: block; }

  .spacer { flex: 1 1 auto; }

  .footline {
    display: flex; align-items: center; gap: 12px;
    font-size: 15px; color: var(--lav-dim);
  }
  .footline .url { color: var(--ink); font-weight: 600; }
  .footline .sep { opacity: 0.5; }
  .footline .attr { opacity: 0.72; }

  /* Tonight's opener — the real rail card, lit by the spotlight. */
  .opener {
    position: absolute; z-index: 3; right: 66px; top: 150px; width: 316px;
    padding: 22px 24px 24px;
    border-radius: 18px;
    background: rgba(24,12,40,0.7);
    border: 1px solid rgba(255,214,160,0.38);
    box-shadow: 0 24px 60px rgba(9,4,16,0.6), 0 0 0 1px rgba(255,255,255,0.02) inset;
    backdrop-filter: blur(10px);
  }
  .opener .op-kicker {
    font-family: 'Outfit', sans-serif; font-weight: 700;
    font-size: 13px; letter-spacing: 0.2em; text-transform: uppercase; color: var(--gold);
  }
  .opener .op-title { font-family: 'Outfit', sans-serif; font-weight: 700; font-size: 30px; line-height: 1.12; margin-top: 12px; color: #fff; }
  .opener .op-artist { font-size: 18px; color: var(--lav-dim); margin-top: 6px; }
  .op-btn {
    margin-top: 20px; display: flex; align-items: center; justify-content: center; gap: 9px;
    padding: 13px 20px; border-radius: 999px;
    background: linear-gradient(120deg, var(--gold), var(--pink)); color: #1a0b2e;
    font-family: 'Outfit', sans-serif; font-weight: 700; font-size: 18px;
    box-shadow: 0 8px 22px rgba(255,154,213,0.28);
  }
  .op-btn svg { width: 17px; height: 17px; display: block; }
  .op-eq { display: inline-flex; align-items: flex-end; gap: 3px; height: 15px; margin-left: 2px; }
  .op-eq i { width: 3px; border-radius: 2px; background: #1a0b2e; }
  .op-eq i:nth-child(1){ height: 9px; } .op-eq i:nth-child(2){ height: 15px; } .op-eq i:nth-child(3){ height: 11px; }
</style>
</head>
<body>
  <div class="card">
    <div class="bg"></div>
    <div class="scrim"></div>
    <div class="bloom"></div>

    <aside class="opener">
      <div class="op-kicker">Tonight's opener</div>
      <div class="op-title">Goodbye to Spring</div>
      <div class="op-artist">Josh Woodward</div>
      <div class="op-btn">
        Sing this song
        <span class="op-eq"><i></i><i></i><i></i></span>
      </div>
    </aside>

    <div class="content">
      <div class="brand">
        <span class="globe">${mark}</span>
        <span class="wordmark">Mercury<span class="p">Pitch</span></span>
        <span class="divider"></span>
        <span class="kicker">Karaoke Night</span>
      </div>

      <h1 class="headline">Turn any song you own into karaoke</h1>
      <p class="sub">The vocals lift away, the lyrics light up line by line, and <b>every note you sing is scored live</b> — right in your browser.</p>

      <div class="pills">
        <span class="pill"><span class="dot"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></span>Vocals removed</span>
        <span class="pill"><span class="dot"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></span>Synced lyrics</span>
        <span class="pill"><span class="dot"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></span>Live pitch score</span>
      </div>

      <div class="spacer"></div>

      <div class="footline">
        <span class="url">mercurypitch.com/karaoke</span>
        <span class="sep">•</span>
        <span class="attr">Demo: "Goodbye to Spring" by Josh Woodward (CC BY 4.0)</span>
      </div>
    </div>
  </div>
</body>
</html>`

const browser = await chromium.launch({ args: ['--no-sandbox'] })
// deviceScaleFactor 1 -> the file is exactly 1200x630, matching the sibling
// public/og-image.png and the og:image:width/height declared in karaoke.html.
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
