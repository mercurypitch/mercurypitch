// Group E: the real advance and ink of every line group E sets, in the film's fonts (Chromium, the kit's
// fonts.css.txt), so each clearance is measured, not estimated (LAB-CHECKS 21).
//   $S/bin/heavy node lab/s13-recap/tools/widths.mjs > lab/s13-recap/widths.txt
import { createServer } from 'node:http'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '../../..')
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PW_MODULE || '/opt/node-tools/node_modules/playwright')
const TYPES = { '.html': 'text/html', '.ttf': 'font/ttf', '.css': 'text/css' }
const fonts = readFileSync(join(ROOT, 'assets/lib/fonts.css.txt'), 'utf8').replace(/url\('assets\//g, "url('/assets/")
const server = createServer((req, res) => {
  if (req.url === '/') { res.writeHead(200, { 'content-type': 'text/html' }); res.end(`<!doctype html><html><head><meta charset="UTF-8"><style>${fonts}</style></head><body><canvas id="c"></canvas></body></html>`); return }
  const f = join(ROOT, normalize(decodeURIComponent(req.url.split('?')[0])))
  if (!existsSync(f)) { res.writeHead(404); res.end(); return }
  res.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' }); res.end(readFileSync(f))
})
await new Promise((r) => server.listen(0, '127.0.0.1', r))
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome' })
const page = await browser.newPage()
await page.goto(`http://127.0.0.1:${server.address().port}/`)
const items = JSON.parse(process.argv[2] || 'null') || [
  ['600 40px Outfit', "What is your diaphragm's main job?"],
  ['600 40px Outfit', 'For a long, easy note, which start do many singing teachers aim for?'],
  ['600 40px Outfit', 'For a long, easy note,'], ['600 40px Outfit', 'which start do many singing teachers aim for?'],
  ['600 40px Outfit', 'For a long, easy note, which start'], ['600 40px Outfit', 'do many singing teachers aim for?'],
  ['600 40px Outfit', 'For a long, easy note, which start do'], ['600 40px Outfit', 'many singing teachers aim for?'],
  ['600 40px Outfit', 'What does a steady long note look like on the pitch line?'],
  ['600 40px Outfit', 'What does a steady long note look like'], ['600 40px Outfit', 'on the pitch line?'],
  ['600 40px Outfit', 'What does a steady long note'], ['600 40px Outfit', 'look like on the pitch line?'],
  ['italic 400 64px "Instrument Serif"', 'Breathing in.'],
  ['italic 400 56px "Instrument Serif"', 'Air and sound starting together:'], ['italic 400 56px "Instrument Serif"', 'the easy start.'],
  ['italic 400 56px "Instrument Serif"', 'It settles into the band'], ['italic 400 56px "Instrument Serif"', 'and stays there.'],
  ['600 30px Outfit', 'A, any octave'], ['600 30px Outfit', 'in the band'], ['600 30px Outfit', 'Air first'], ['600 30px Outfit', 'A catch'], ['600 30px Outfit', 'Together'],
  ['600 40px Outfit', 'Practise it.'], ['italic 400 96px "Instrument Serif"', 'Voice Mirror'],
  ['600 34px Outfit', 'Voice Mirror has you glide up and down,'], ['600 34px Outfit', 'hold any comfortable note for six seconds,'], ['600 34px Outfit', 'then sing back five notes it plays.'],
  ['400 32px Inter', 'For the hold, it shows in cents how fast the note drifted and how much it wobbled, and a vibrato isn’t counted against you.'],
  ['500 34px Outfit', 'Keep the glides comfortable.'], ['500 34px Outfit', 'Sore, hoarse or unwell today? Just listen along.'],
  ['600 40px Outfit', 'Free, no account: mercurypitch.com/mirror'], ['600 40px Outfit', 'Free, no account: '],
  ['400 34px Inter', 'Ten minutes, gently, most days.'], ['400 34px Inter', 'Missed a day? Just come back.'],
  ['400 34px Inter', 'Ten minutes, gently, most days. Missed a day? Just come back.'],
  ['400 32px Inter', 'Ten minutes, gently, most days. Missed a day? Just come back.'],
  ['400 30px Inter', 'Ten minutes, gently, most days. Missed a day? Just come back.'],
  ['500 28px Outfit', 'Felt uncomfortable, or listened'], ['500 28px Outfit', 'along today?'], ['italic 400 72px "Instrument Serif"', 'Rest today'],
  ['500 30px Outfit', 'Voice Mirror will be here when'], ['500 30px Outfit', 'your voice feels comfortable:'], ['600 36px Outfit', 'mercurypitch.com/mirror'],
  ['600 44px Outfit', 'Merc moves every single note of ‘Twinkle, Twinkle’ up.'],
  ['italic 400 60px "Instrument Serif"', 'Why can you start “Twinkle, Twinkle” on any note'], ['italic 400 60px "Instrument Serif"', 'and it is still the same tune?'],
  ['600 72px Outfit', 'mercurypitch.com/mirror'], ['500 44px Outfit', 'Voice Mirror is free, with no account'],
  ['500 30px "JetBrains Mono"', 'QUICK CHECK'], ['500 30px "JetBrains Mono"', 'NEXT TIME'], ['600 64px Outfit', '?'],
]
const out = await page.evaluate(async (items) => {
  await document.fonts.ready
  for (const [f] of items) await document.fonts.load(f.replace(/"/g, "'"))
  const cv = document.getElementById('c').getContext('2d')
  return items.map(([font, text]) => {
    cv.font = font
    const m = cv.measureText(text)
    return { font, text, adv: +m.width.toFixed(1), inkL: +(-m.actualBoundingBoxLeft).toFixed(1), inkR: +m.actualBoundingBoxRight.toFixed(1), up: +m.actualBoundingBoxAscent.toFixed(1), down: +m.actualBoundingBoxDescent.toFixed(1) }
  })
}, items)
for (const r of out) console.log(`${r.font.padEnd(36)} adv ${String(r.adv).padStart(7)}  ink ${r.inkL}..${r.inkR}  up ${r.up} down ${r.down}  | ${r.text}`)
await browser.close(); server.close()
