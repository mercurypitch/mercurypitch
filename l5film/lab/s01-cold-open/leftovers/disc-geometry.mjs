// DECISIONS 178's proof, part 1: the bead's disc on screen (centre and radius) at every film frame from hook + 0.5
// to the cut on `title`, from the scene in its probe harness (lab/s01-cold-open/probe.html). amber_in_disc.py
// then counts Merc's amber in a clip's frames inside that disc.
//   $S/bin/heavy node lab/s01-cold-open/leftovers/disc-geometry.mjs
import { createServer } from 'node:http'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '../../..')
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
const out = await page.evaluate(async () => {
  const sid = 's01-cold-open', S = window.__sceneProbe[sid], A = S.A, tl = window.__timelines[sid]
  const rows = []
  for (let k = Math.ceil((A.HOOK + 0.5) * 30 - 1e-6); k / 30 <= A.D + 1e-9; k++) {
    const t = k / 30
    tl.seek(t, false); await new Promise((r) => requestAnimationFrame(() => r()))
    const [x, y] = S.cam.map(400, 400, t)
    const f = S.critLayer.style.filter
    rows.push({ k, t, x, y, r: S.rb, blur: f && f !== 'none' ? parseFloat(f.replace(/[^\d.]/g, '')) : 0, line: +(S.ch.merc.g.getAttribute('opacity') ?? 1), field: +(S.critLayer.style.opacity === '0') })
  }
  return { HOOK: A.HOOK, D: A.D, rows }
})
writeFileSync(join(HERE, 'disc-geometry.json'), JSON.stringify(out, null, 1) + '\n')
console.log(`${out.rows.length} frames`)
await browser.close(); server.close()
