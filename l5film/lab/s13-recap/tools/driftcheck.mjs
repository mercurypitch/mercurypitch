// The cards' drift in `card`, sampled every 60 fps frame in Chromium (the probe's harness, lab/s13-recap/probe.html): the
// vertical centroid of the "Voice Mirror" heading's ink, so a drift drawn at sub-pixel positions moves smoothly and one
// stepped by the raster moves in whole pixels. Writes lab/s13-recap/drift/d-<k>.png and drift.json; drift.py reads them.
//   $S/bin/heavy node lab/s13-recap/tools/driftcheck.mjs
import { createServer } from 'node:http'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '../../..')
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PW_MODULE || '/opt/node-tools/node_modules/playwright')
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.ttf': 'font/ttf', '.webm': 'video/webm' }
const server = createServer((req, res) => {
  const f = join(ROOT, normalize(decodeURIComponent(req.url.split('?')[0])))
  if (!existsSync(f)) { res.writeHead(404); res.end(); return }
  res.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' }); res.end(readFileSync(f))
})
await new Promise((r) => server.listen(0, '127.0.0.1', r))
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome' })
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 })
await page.goto(`http://127.0.0.1:${server.address().port}/lab/s13-recap/probe.html`, { waitUntil: 'load' })
await page.evaluate(async () => { await document.fonts.ready; await new Promise((r) => setTimeout(r, 100)) })
const A = await page.evaluate(() => window.__sceneProbe['s13-recap'].A)
mkdirSync(join(ROOT, 'lab/s13-recap/drift'), { recursive: true })
const rows = []
for (let k = -6; k <= 126; k += 3) {
  const t = A.DRIFT + k / 60
  await page.evaluate((t) => { window.__timelines['s13-recap'].seek(t, false) }, t)
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r())))
  await page.screenshot({ path: join(ROOT, `lab/s13-recap/drift/d-${String(k + 6).padStart(3, '0')}.png`), clip: { x: 260, y: 140, width: 460, height: 150 } })
  rows.push({ k, t, layer: await page.evaluate(() => window.__sceneProbe['s13-recap'].cardsLayer.style.transform) })
}
writeFileSync(join(ROOT, 'lab/s13-recap/drift/drift.json'), JSON.stringify(rows, null, 1))
await browser.close(); server.close()
