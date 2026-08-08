// Generate the Jam Rooms social-share card (public/jam-og.png).
//
// The sibling of scripts/generate-karaoke-og.mjs, and deliberately built the
// same way: a designed 1200x630 Open Graph image rendered from real page
// ingredients — the room-stage backdrop (public/jam/room-stage.webp) under the
// app's obsidian scrim, the MercuryPitch lockup, a gradient headline, and the
// per-singer lanes that are the thing a jam room actually is.
//
// Deterministic + self-contained: the backdrop is inlined as a data URI and the
// brand mark is inline SVG, so the render never depends on a dev server. Brand
// fonts (Outfit + Inter) load from Google Fonts with a system-ui fallback.
//
//   node scripts/generate-jam-og.mjs           # -> public/jam-og.png
//   OUT=/tmp/preview.png node scripts/generate-jam-og.mjs
import { chromium } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(__dirname, '..')
const OUT = process.env.OUT || resolve(REPO, 'public/jam-og.png')

const W = 1200
const H = 630

// Inline the room backdrop so the render is self-contained. The standard tier,
// not -4k: this is composited down to 1200x630, so the larger file would only
// cost render time.
const backdrop = readFileSync(resolve(REPO, 'public/jam/room-stage.webp'))
const backdropUri = `data:image/webp;base64,${backdrop.toString('base64')}`

// The soundglobe brand mark (public/favicon.svg), inline so it needs no fetch.
const mark = readFileSync(resolve(REPO, 'public/favicon.svg'), 'utf8')

// The lanes: one singer, one colour, the way the room draws them.
const SINGERS = [
  { name: 'Mara', part: 'Lead', color: '#58a6ff', bars: [38, 62, 84, 71, 52] },
  {
    name: 'Ivo',
    part: 'Harmony',
    color: '#2dd4bf',
    bars: [24, 40, 58, 76, 63],
  },
  {
    name: 'Kit',
    part: 'Low harmony',
    color: '#bc8cff',
    bars: [18, 30, 44, 39, 55],
  },
]

const laneRows = SINGERS.map(
  (s) => `
      <div class="lane">
        <span class="dot" style="background:${s.color}"></span>
        <div class="who">
          <span class="name">${s.name}</span>
          <span class="part">${s.part}</span>
        </div>
        <div class="trail">
          ${s.bars
            .map(
              (b, i) =>
                `<i style="height:${Math.round(b * 0.34)}px;background:${s.color};opacity:${0.45 + i * 0.11}"></i>`,
            )
            .join('')}
        </div>
      </div>`,
).join('')

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
    --ground: #0d1117;
    --ink: #e6edf3;
    --ink-2: #a8b3bf;
    --ink-3: #6e7681;
    --blue: #58a6ff;
    --teal: #2dd4bf;
    --violet: #bc8cff;
  }
  html, body { width: ${W}px; height: ${H}px; background: var(--ground); overflow: hidden; }
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
  /* Same contract as the karaoke card: hold the copy column (left ~55%) dark
     enough for AA contrast, let the room read through on the right. */
  .scrim {
    position: absolute; inset: 0;
    background:
      linear-gradient(100deg,
        rgba(13,17,23,0.96) 0%,
        rgba(13,17,23,0.92) 30%,
        rgba(13,17,23,0.58) 50%,
        rgba(13,17,23,0.2) 74%,
        rgba(13,17,23,0.06) 100%),
      linear-gradient(180deg,
        rgba(13,17,23,0.72) 0%,
        rgba(13,17,23,0.12) 42%,
        rgba(13,17,23,0.3) 70%,
        rgba(13,17,23,0.84) 100%);
  }
  .bloom {
    position: absolute; inset: 0;
    background:
      radial-gradient(40% 56% at 74% 42%, rgba(88,166,255,0.18), transparent 62%),
      radial-gradient(120% 90% at 2% 110%, rgba(45,212,191,0.14), transparent 44%);
    mix-blend-mode: screen;
  }

  .content {
    position: relative; z-index: 2;
    height: 100%;
    padding: 60px 64px 52px;
    display: flex; flex-direction: column;
  }

  .brand { display: flex; align-items: center; gap: 14px; }
  .brand .globe { width: 46px; height: 46px; border-radius: 50%; box-shadow: 0 4px 18px rgba(88,166,255,0.35); flex: none; display: block; }
  .brand .globe svg { display: block; width: 100%; height: 100%; }
  .wordmark { font-family: 'Outfit', sans-serif; font-weight: 700; font-size: 27px; letter-spacing: -0.01em; }
  .wordmark .p { color: var(--blue); }
  .divider { width: 1px; height: 26px; background: rgba(230,237,243,0.28); }
  .kicker {
    font-family: 'Outfit', sans-serif; font-weight: 700;
    font-size: 15px; letter-spacing: 0.26em; text-transform: uppercase; color: var(--teal);
  }

  .headline {
    font-family: 'Outfit', sans-serif; font-weight: 800;
    font-size: 74px; line-height: 1.04; letter-spacing: -0.015em;
    margin-top: auto; max-width: 660px;
    padding-bottom: 0.08em;
    background: linear-gradient(118deg, #d6e9ff 4%, var(--blue) 30%, var(--teal) 62%, var(--violet) 100%);
    -webkit-background-clip: text; background-clip: text; color: transparent;
    filter: drop-shadow(0 3px 22px rgba(13,17,23,0.6));
  }
  .sub {
    margin-top: 22px; max-width: 580px;
    font-size: 24px; line-height: 1.46; color: var(--ink-2);
    text-shadow: 0 1px 10px rgba(13,17,23,0.92);
  }
  .sub b { color: #fff; font-weight: 600; }

  .pills { display: flex; gap: 12px; margin-top: 30px; }
  .pill {
    display: inline-flex; align-items: center; gap: 9px;
    padding: 10px 16px 10px 13px; border-radius: 999px;
    background: rgba(22,27,34,0.66); border: 1px solid rgba(88,166,255,0.3);
    backdrop-filter: blur(6px);
    font-size: 17px; font-weight: 500; color: var(--ink-2);
  }
  .pill .dot {
    width: 22px; height: 22px; border-radius: 50%; flex: none;
    display: grid; place-items: center;
    background: linear-gradient(120deg, var(--blue), var(--teal)); color: #0d1117;
  }
  .pill .dot svg { width: 14px; height: 14px; display: block; }

  .spacer { flex: 1 1 auto; }

  .footline {
    display: flex; align-items: center; gap: 12px;
    font-size: 15px; color: var(--ink-3);
  }
  .footline .url { color: var(--ink); font-weight: 600; }
  .footline .sep { opacity: 0.5; }

  /* The room itself: a lane per singer, which is what the tab draws. */
  .room {
    position: absolute; z-index: 3; right: 62px; top: 132px; width: 330px;
    padding: 22px 24px 24px;
    border-radius: 18px;
    background: rgba(22,27,34,0.72);
    border: 1px solid rgba(88,166,255,0.32);
    box-shadow: 0 24px 60px rgba(4,7,12,0.62), 0 0 0 1px rgba(255,255,255,0.02) inset;
    backdrop-filter: blur(10px);
  }
  .room .rm-kicker {
    font-family: 'Outfit', sans-serif; font-weight: 700;
    font-size: 13px; letter-spacing: 0.2em; text-transform: uppercase; color: var(--teal);
    display: flex; align-items: center; gap: 8px;
  }
  .room .live { width: 8px; height: 8px; border-radius: 50%; background: var(--teal); box-shadow: 0 0 0 4px rgba(45,212,191,0.16); }
  .lane { display: flex; align-items: center; gap: 11px; margin-top: 17px; }
  .lane .dot { width: 10px; height: 10px; border-radius: 50%; flex: none; }
  .lane .who { width: 118px; flex: none; }
  .lane .name { display: block; font-family: 'Outfit', sans-serif; font-weight: 700; font-size: 18px; color: #fff; line-height: 1.15; }
  .lane .part { display: block; font-size: 13px; color: var(--ink-3); margin-top: 1px; }
  .lane .trail { display: flex; align-items: flex-end; gap: 4px; height: 30px; flex: 1; }
  .lane .trail i { width: 7px; border-radius: 3px; display: block; }
  .room .score {
    margin-top: 20px; padding-top: 16px; border-top: 1px solid rgba(230,237,243,0.1);
    display: flex; align-items: baseline; justify-content: space-between;
  }
  .room .score .lab { font-size: 14px; color: var(--ink-3); }
  .room .score .val { font-family: 'Outfit', sans-serif; font-weight: 800; font-size: 26px; color: #fff; }
</style>
</head>
<body>
  <div class="card">
    <div class="bg"></div>
    <div class="scrim"></div>
    <div class="bloom"></div>

    <aside class="room">
      <div class="rm-kicker"><span class="live"></span>In the room</div>
      ${laneRows}
      <div class="score">
        <span class="lab">Shared score</span>
        <span class="val">92%</span>
      </div>
    </aside>

    <div class="content">
      <div class="brand">
        <span class="globe">${mark}</span>
        <span class="wordmark">Mercury<span class="p">Pitch</span></span>
        <span class="divider"></span>
        <span class="kicker">Jam Rooms</span>
      </div>

      <h1 class="headline">Sing it together, from anywhere</h1>
      <p class="sub">Open a room, share the link, and take a part. Lyrics down the left, <b>a pitch lane for every singer</b>, and one scoreboard for the whole room.</p>

      <div class="pills">
        <span class="pill"><span class="dot"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></span>Live together</span>
        <span class="pill"><span class="dot"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></span>Take a part</span>
        <span class="pill"><span class="dot"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></span>Counts as practice</span>
      </div>

      <div class="spacer"></div>

      <div class="footline">
        <span class="url">mercurypitch.com/jam</span>
        <span class="sep">•</span>
        <span>No install — it runs in the browser</span>
      </div>
    </div>
  </div>
</body>
</html>`

const browser = await chromium.launch({ args: ['--no-sandbox'] })
// deviceScaleFactor 1 -> the file is exactly 1200x630, matching the sibling
// public/karaoke-og.png and the og:image:width/height declared in jam.html.
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
