// DECISIONS 172: which of S4's frame-fixed and world marks the four words' flight crosses. Every frame of the
// flight (FLY to FLY + FLY_D) in the probe's harness (lab/s04-recall/probe.html): each chip's box against the
// swatches, their names, the hairline, the heading and the strip's envelope, as placed at that frame, whatever
// their opacity. Prints, for each mark, the frames it is crossed and its nearest gap.
//   $S/bin/heavy node lab/s04-recall/flight-cross.mjs
import { createServer } from 'node:http'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '../..')
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PW_MODULE || '/opt/node-tools/node_modules/playwright')
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.ttf': 'font/ttf', '.webm': 'video/webm', '.json': 'application/json' }
const server = createServer((req, res) => {
  const f = join(ROOT, normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^(\.\.[/\\])+/, ''))
  if (!f.startsWith(ROOT) || !existsSync(f)) { res.writeHead(404); res.end(); return }
  res.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' }); res.end(readFileSync(f))
})
await new Promise((r) => server.listen(0, '127.0.0.1', r))
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome' })
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 })
await page.goto(`http://127.0.0.1:${server.address().port}/lab/s04-recall/probe.html`, { waitUntil: 'load' })
await page.evaluate(async () => { await document.fonts.ready; await new Promise((r) => setTimeout(r, 80)) })
const out = await page.evaluate(async () => {
  const S = window.__sceneProbe['s04-recall'], A = S.A, tl = window.__timelines['s04-recall'], H = window.__H
  const marks = () => {
    const m = {}
    S.SWATCH.forEach((s) => { m['swatch ' + s.name] = H.R(s.box); m['name ' + s.name] = H.R(s.label) })
    if (S.hair) m.hairline = H.R(S.hair)
    m.heading = H.R(S.heading)
    const a = S.cam.map(400, 690 - 28, tl.time()), b = S.cam.map(1520, 690 + 28, tl.time())
    m['strip envelope'] = { left: a[0], top: a[1], right: b[0], bottom: b[1] }
    return m
  }
  const res = {}
  for (let k = Math.ceil(A.FLY * 30); k / 30 <= A.FLY + A.FLY_D + 1e-9; k++) {
    tl.seek(k / 30, false); await new Promise((r) => requestAnimationFrame(() => r()))
    const chips = S.row.chips.map((c) => H.R(c.box))
    for (const [name, r] of Object.entries(marks())) {
      const g = Math.min(...chips.map((c) => H.gap(c, r)))
      const e = (res[name] = res[name] || { crossed: [], nearest: Infinity, at: null })
      if (g === 0) e.crossed.push(+(k / 30).toFixed(3))
      if (g < e.nearest) { e.nearest = g; e.at = +(k / 30).toFixed(3) }
    }
  }
  return { FLY: A.FLY, FLY_D: A.FLY_D, UP: A.UP, res }
})
console.log(JSON.stringify(out, null, 1))
await browser.close(); server.close()
