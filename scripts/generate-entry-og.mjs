// Generate the social-share card for any crawlable entry page.
//
// The six sibling generate-*-og.mjs scripts each carry their own copy of the
// same 1200x630 composition — brand lockup, gradient headline, sub, pills,
// footer URL over a scrimmed backdrop. That was fine for six bespoke rooms,
// each with its own palette and its own furniture. It is the wrong shape for
// the measurement entries, which all want the SAME card with different art
// and different words, so those live here as data instead.
//
// The words are not repeated: `src/seo/entry-pages.ts` already holds the
// og.description a sharer sees and the navLabel the nav shows, so this reads
// them from the model and only the display-specific bits — the headline at
// 70px, the pills, the accent hue, the backdrop — are authored per card.
// Change a description in the model and the card follows.
//
//   node --experimental-strip-types scripts/generate-entry-og.mjs            # every card
//   node --experimental-strip-types scripts/generate-entry-og.mjs voice-type-test
//   OUT_DIR=/tmp/preview node --experimental-strip-types scripts/generate-entry-og.mjs
//
// The flag is needed because entry-pages.ts is TypeScript; it is import-free,
// so stripping types is all it takes. Nothing in CI runs this — the PNG is
// committed, like every sibling card.

import { chromium } from '@playwright/test'
import { readFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ENTRY_PAGES, canonicalPath, SITE_ORIGIN, } from '../src/seo/entry-pages.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(__dirname, '..')
const ART = resolve(REPO, 'assets/og-backdrops')
const OUT_DIR = process.env.OUT_DIR || resolve(REPO, 'public')
const W = 1200
const H = 630

/** Per-card display copy. Everything else comes from ENTRY_PAGES.
 *
 *  `pills` have to be read against that page's og.description, which sits
 *  directly above them on the card: three of the four descriptions already
 *  say "Free" and one already says "semitone span", so a pill repeating it
 *  spends a slot saying nothing.
 *
 *  `art` nudges the backdrop when a generated subject sits badly. `size` is a
 *  CSS background-size, `pos` a background-position. Mind the direction: a
 *  background-position percentage picks which part of an oversized image is
 *  shown, so a HIGHER x% reveals ground further right and therefore drags the
 *  subject LEFT — the opposite of what it reads like. Zooming also crops, so a
 *  subject that already spans most of the frame loses an end. Both current
 *  backdrops frame themselves and use no transform; re-roll the art before
 *  reaching for this.
 *
 *  `headline` is authored rather than reused: og.title is written for a search
 *  result and runs to 60-odd characters, which sets as four cramped lines at
 *  70px. The card wants the question, not the SEO string. */
const CARDS = {
  'voice-type-test': {
    backdrop: 'voice-type-test.png',
    headline: 'Soprano, alto, tenor or bass?',
    pills: ['Four voice bands', 'Takes one minute', 'No sign-up'],
    accent: '#58a6ff',
  },
  'which-singer-has-my-vocal-range': {
    backdrop: 'which-singer-has-my-vocal-range.png',
    headline: 'Which singer has my vocal range?',
    pills: ['One glide', 'Measured in semitones', 'No sign-up'],
    accent: '#bc8cff',
  },
  mirror: {
    backdrop: 'mirror.png',
    headline: 'See your voice in 60 seconds',
    pills: ['Two glides, one note', 'Range and accuracy', 'Free'],
    accent: '#2dd4bf',
  },
  'vocal-range-test': {
    backdrop: 'vocal-range-test.png',
    headline: 'Find your lowest and highest note',
    pills: ['Your lowest note', 'Your highest note', 'Free'],
    accent: '#2dd4bf',
  },
  'pitch-training': {
    backdrop: 'pitch-training.png',
    headline: 'Practice on pitch, and see the proof',
    pills: ['Live feedback', 'Hold, scale or chase', 'No sign-up'],
    accent: '#2dd4bf',
  },
}

const mark = readFileSync(resolve(REPO, 'public/favicon.svg'), 'utf8')
const FONTS =
  'https://fonts.googleapis.com/css2?family=Outfit:wght@500;600;700;800&family=Inter:wght@400;500;600;700&display=swap'
const check = `<svg viewBox="0 0 24 24" fill="none" stroke="#0d1117" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>`

const esc = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function buildHtml(page, card, backdropUri) {
  const url = `${SITE_ORIGIN}${canonicalPath(page)}`.replace(/^https?:\/\//, '')
  const art = { size: 'cover', pos: 'center', ...(card.art ?? {}) }
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="${FONTS}" rel="stylesheet" />
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  :root {
    --obsidian:#0d1117; --ink:#e6edf3; --dim:#a8b3bf; --muted:#6e7681;
    --blue:#58a6ff; --aqua:#2dd4bf; --violet:#bc8cff;
  }
  html, body { width:${W}px; height:${H}px; background:var(--obsidian); overflow:hidden; }
  body { font-family:'Inter',system-ui,sans-serif; color:var(--ink); -webkit-font-smoothing:antialiased; }
  .card { position:relative; width:${W}px; height:${H}px; overflow:hidden; }
  .bg { position:absolute; inset:0; background:url('${backdropUri}') ${art.pos} / ${art.size} no-repeat; transform:scale(1.02); }
  /* The copy column (left ~55%) stays dark for AA legibility; the art reads
     through on the right, which is where every backdrop puts its subject. */
  .scrim { position:absolute; inset:0; background:
      linear-gradient(100deg, rgba(13,17,23,0.97) 0%, rgba(13,17,23,0.94) 32%,
        rgba(13,17,23,0.62) 52%, rgba(13,17,23,0.20) 74%, rgba(13,17,23,0.04) 100%),
      linear-gradient(180deg, rgba(13,17,23,0.66) 0%, rgba(13,17,23,0.10) 40%,
        rgba(13,17,23,0.30) 70%, rgba(13,17,23,0.80) 100%); }
  .bloom { position:absolute; inset:0; mix-blend-mode:screen; background:
      radial-gradient(46% 60% at 74% 46%, ${card.accent}22, transparent 64%),
      radial-gradient(120% 90% at 2% 108%, rgba(88,166,255,0.13), transparent 46%); }
  .content { position:relative; z-index:2; height:100%; padding:56px 64px 52px; display:flex; flex-direction:column; }

  .brand { display:flex; align-items:center; gap:14px; }
  /* The lockup and the headline used to sit a hair apart: margin-top auto on
     the headline only ever adds LEFTOVER space, and a tall card leaves almost
     none. This floor is what keeps them apart. */
  .brand { margin-bottom:46px; }
  .brand .globe { width:46px; height:46px; border-radius:50%; box-shadow:0 2px 8px rgba(0,0,0,0.45); flex:none; display:block; }
  .brand .globe svg { display:block; width:100%; height:100%; }
  .wordmark { font-family:'Outfit',sans-serif; font-weight:700; font-size:27px; letter-spacing:-0.01em; }
  /* The app's own lockup, character for character: App.module.css's
     .appOpeningWordmark > span and entry-prelude.css's
     .entry-prelude__wordmark > span both set exactly this gradient. A card is
     the first frame of the page it links to, so a flat blue "Pitch" here read
     as a different brand the moment the page painted. */
  .wordmark .p { background: linear-gradient(120deg, #58a6ff 0%, #2dd4bf 50%, #bc8cff 100%); -webkit-background-clip: text; background-clip: text; color: transparent; }
  .divider { width:1px; height:26px; background:rgba(230,237,243,0.28); }
  .kicker { font-family:'Outfit',sans-serif; font-weight:700; font-size:15px;
    letter-spacing:0.26em; text-transform:uppercase; color:${card.accent}; }

  .headline { font-family:'Outfit',sans-serif; font-weight:800; font-size:68px; line-height:1.06;
    letter-spacing:-0.015em; margin-top:auto; max-width:660px; padding-bottom:0.08em;
    background:linear-gradient(118deg,#f4f8fd 4%,var(--blue) 34%,var(--aqua) 64%,var(--violet) 100%);
    -webkit-background-clip:text; background-clip:text; color:transparent;
    filter:drop-shadow(0 3px 22px rgba(13,17,23,0.6)); }
  .sub { margin-top:24px; max-width:560px; font-size:23px; line-height:1.46; color:var(--dim);
    text-shadow:0 1px 10px rgba(13,17,23,0.9); }
  .pills { display:flex; gap:12px; margin-top:30px; }
  .pill { display:inline-flex; align-items:center; gap:9px; padding:10px 16px 10px 13px; border-radius:999px;
    background:rgba(22,27,34,0.66); border:1px solid rgba(88,166,255,0.30); backdrop-filter:blur(6px);
    font-size:17px; font-weight:500; color:var(--dim); }
  .pill .dot { width:22px; height:22px; border-radius:50%; flex:none; display:grid; place-items:center;
    background:linear-gradient(120deg,var(--blue),var(--aqua)); }
  .pill .dot svg { width:14px; height:14px; display:block; }
  .spacer { flex:1 1 auto; }
  .footline { display:flex; align-items:center; gap:12px; font-size:15px; color:var(--muted); }
  .footline .url { color:var(--ink); font-weight:600; }
</style></head>
<body><div class="card">
  <div class="bg"></div><div class="scrim"></div><div class="bloom"></div>
  <div class="content">
    <div class="brand">
      <span class="globe">${mark}</span>
      <span class="wordmark">Mercury<span class="p">Pitch</span></span>
      <span class="divider"></span>
      <span class="kicker">${esc(page.navLabel)}</span>
    </div>
    <h1 class="headline">${esc(card.headline)}</h1>
    <p class="sub">${esc(page.og.description)}</p>
    <div class="pills">${card.pills.map((p) => `<span class="pill"><span class="dot">${check}</span>${esc(p)}</span>`).join('')}</div>
    <div class="spacer"></div>
    <div class="footline"><span class="url">${esc(url)}</span></div>
  </div>
</div></body></html>`
}

const wanted = process.argv.slice(2)
const slugs = wanted.length > 0 ? wanted : Object.keys(CARDS)
for (const slug of slugs) {
  if (!CARDS[slug]) throw new Error(`no card configured for slug "${slug}"`)
}

const browser = await chromium.launch({ args: ['--no-sandbox'] })
// deviceScaleFactor 1 -> exactly 1200x630, matching the sibling cards and the
// og:image:width/height the entry pages declare.
const page = await browser.newPage({
  viewport: { width: W, height: H },
  deviceScaleFactor: 1,
})

for (const slug of slugs) {
  const entry = ENTRY_PAGES.find((p) => p.slug === slug)
  if (!entry) throw new Error(`"${slug}" is not an entry page`)
  const card = CARDS[slug]
  const art = resolve(ART, card.backdrop)
  if (!existsSync(art)) throw new Error(`backdrop missing: ${art}`)
  const backdropUri = `data:image/png;base64,${readFileSync(art).toString('base64')}`

  await page.setContent(buildHtml(entry, card, backdropUri), {
    waitUntil: 'networkidle',
  })
  await page
    .evaluate(() => document.fonts.ready.then(() => undefined))
    .catch(() => {})
  await page.waitForTimeout(250)
  const out = resolve(OUT_DIR, `${slug}-og.png`)
  await page.screenshot({
    path: out,
    clip: { x: 0, y: 0, width: W, height: H },
  })
  console.log(`wrote ${out} (${W}x${H})`)
}

await browser.close()
