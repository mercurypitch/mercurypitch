// DECISIONS 171's pass into the bead, frame by frame before a render: the scene in the probe's harness
// (lab/s01-cold-open/probe.html, written by probe.mjs), seeked to every film frame (1/30 s) from hook - 0.1 to the
// cut and shot whole, with the bead's radius on screen at each. approach_metrics.py then measures the shots as
// measure.py measures a clip (the mean luma change at 320 px wide, the share of pixels at 960 px wide that change
// by more than 24, its pop rule). The harness draws no host video, so the slide-out's frames read a little calm.
//   $S/bin/heavy node lab/s01-cold-open/approach-sim.mjs [outdir]
import { createServer } from 'node:http'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '../..')
const OUT = process.argv[2] || join(HERE, 'approach-sim')
mkdirSync(OUT, { recursive: true })
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
await page.goto(`http://127.0.0.1:${server.address().port}/lab/s01-cold-open/probe.html`, { waitUntil: 'load' })
await page.evaluate(async () => { await document.fonts.ready; await new Promise((r) => setTimeout(r, 80)) })
const A = await page.evaluate(() => window.__sceneProbe['s01-cold-open'].A)
const frames = []
for (let k = Math.floor((A.HOOK - 0.1) * 30); k / 30 <= A.D + 1e-9; k++) {
  const rb = await page.evaluate(async (t) => {
    window.__timelines['s01-cold-open'].seek(t, false)
    await new Promise((r) => requestAnimationFrame(() => r()))
    return window.__sceneProbe['s01-cold-open'].rb
  }, k / 30)
  const name = `f${String(k).padStart(4, '0')}.png`
  await page.screenshot({ path: join(OUT, name) })
  frames.push({ k, t: k / 30, rb, name })
}
writeFileSync(join(OUT, 'frames.json'), JSON.stringify({ A, frames }, null, 1))
console.log(`${frames.length} frames`)
await browser.close(); server.close()
