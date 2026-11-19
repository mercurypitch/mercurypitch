// DECISIONS 168: the two frame-fixed passes in s04, measured frame by frame. The band's fill passes under
// "FROM LESSON 3" in the crane down and under the parked four words in the crane up; for every frame of each
// pass (and 0.5 s either side) the scene is seeked in the probe's harness (lab/s04-recall/probe.html, written by
// lab/s01-cold-open/probe.mjs), each label's region is shot twice, as it is and with the label's own glyphs
// hidden (the check tool's way of finding the true pixels behind them), and the label's paint and opacity are
// recorded. lab/s04-recall/contrast_pass.py reads the shots and finds each label's worst frame.
//
//   $S/bin/heavy node lab/s04-recall/contrast-pass.mjs
//
// Writes lab/s04-recall/contrast/<pass>-<frame>-{a,b}.png and lab/s04-recall/contrast/meta.json.
import { createServer } from 'node:http'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '../..')
const OUT = join(HERE, 'contrast')
mkdirSync(OUT, { recursive: true })
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PW_MODULE || '/opt/node-tools/node_modules/playwright')

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.ttf': 'font/ttf', '.webm': 'video/webm', '.json': 'application/json', '.wav': 'audio/wav' }
const server = createServer((req, res) => {
  const p = normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^(\.\.[/\\])+/, '')
  const f = join(ROOT, p)
  if (!f.startsWith(ROOT) || !existsSync(f)) { res.writeHead(404); res.end(); return }
  res.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' })
  res.end(readFileSync(f))
})
await new Promise((r) => server.listen(0, '127.0.0.1', r))
const port = server.address().port

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome' })
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
await page.goto(`http://127.0.0.1:${port}/lab/s04-recall/probe.html`, { waitUntil: 'load' })
await page.evaluate(async () => {
  await document.fonts.ready
  for (const f of ["600 30px 'Outfit'", "500 26px 'JetBrains Mono'", "500 30px 'JetBrains Mono'"]) await document.fonts.load(f)
  await new Promise((r) => setTimeout(r, 50))
})

const plan = await page.evaluate(() => {
  const S = window.__sceneProbe['s04-recall'], A = S.A
  return {
    down: { from: A.CRANE - 0.5, to: A.CRANE + A.CRANE_D + 0.5, crane: [A.CRANE, A.CRANE + A.CRANE_D] },
    up: { from: A.UP - 0.5, to: A.UP + A.UP_D + 0.5, crane: [A.UP, A.UP + A.UP_D] },
  }
})

const meta = { plan, frames: [] }
for (const pass of ['down', 'up']) {
  const { from, to } = plan[pass]
  for (let k = Math.ceil(from * 30 - 1e-6); k / 30 <= to + 1e-9; k++) {
    const t = k / 30
    const labels = await page.evaluate(async ({ t, pass }) => {
      const S = window.__sceneProbe['s04-recall']
      window.__timelines['s04-recall'].seek(t, false)
      await new Promise((r) => requestAnimationFrame(() => r()))
      const els = pass === 'down' ? [S.kicker.el] : S.row.chips.map((c) => c.el)
      // the opacity the glyphs are drawn at: the computed opacity of the text and each ancestor (an SVG
      // `opacity` attribute is a presentation attribute, so it is in the computed value already)
      const alphaOf = (el) => { let a = 1; for (let e = el; e && e.nodeType === 1; e = e.parentElement) a *= parseFloat(getComputedStyle(e).opacity || '1'); return a }
      return els.map((el, i) => {
        const r = el.getBoundingClientRect()
        return { i, text: el.textContent.trim(), fill: getComputedStyle(el).fill, alpha: alphaOf(el), box: [r.left, r.top, r.right, r.bottom] }
      })
    }, { t, pass })
    const shown = labels.filter((l) => l.alpha > 0.05)
    if (!shown.length) continue
    const x0 = Math.max(0, Math.floor(Math.min(...shown.map((l) => l.box[0])) - 6))
    const y0 = Math.max(0, Math.floor(Math.min(...shown.map((l) => l.box[1])) - 6))
    const x1 = Math.min(1920, Math.ceil(Math.max(...shown.map((l) => l.box[2])) + 6))
    const y1 = Math.min(1080, Math.ceil(Math.max(...shown.map((l) => l.box[3])) + 6))
    const clip = { x: x0, y: y0, width: x1 - x0, height: y1 - y0 }
    const name = `${pass}-${String(k).padStart(4, '0')}`
    await page.screenshot({ path: join(OUT, `${name}-a.png`), clip })
    await page.evaluate(({ pass }) => {
      const S = window.__sceneProbe['s04-recall']
      for (const el of pass === 'down' ? [S.kicker.el] : S.row.chips.map((c) => c.el)) el.style.setProperty('fill', 'transparent', 'important')
    }, { pass })
    await page.screenshot({ path: join(OUT, `${name}-b.png`), clip })
    await page.evaluate(({ pass }) => {
      const S = window.__sceneProbe['s04-recall']
      for (const el of pass === 'down' ? [S.kicker.el] : S.row.chips.map((c) => c.el)) el.style.removeProperty('fill')
    }, { pass })
    meta.frames.push({ pass, k, t, name, clip, labels: shown })
  }
}
// one whole frame of each crane's middle, to set beside the clip's own frame (the harness renders as the clip does)
for (const pass of ['down', 'up']) {
  const [c0, c1] = plan[pass].crane
  const k = Math.round(((c0 + c1) / 2) * 30)
  await page.evaluate(async (t) => { window.__timelines['s04-recall'].seek(t, false); await new Promise((r) => requestAnimationFrame(() => r())) }, k / 30)
  await page.screenshot({ path: join(OUT, `full-${pass}-${k}.png`) })
  meta[`full_${pass}`] = { k, t: k / 30, path: `full-${pass}-${k}.png` }
}
writeFileSync(join(OUT, 'meta.json'), JSON.stringify(meta, null, 1) + '\n')
console.log(`${meta.frames.length} frames shot`)
if (errors.length) console.log('page errors:\n  ' + [...new Set(errors)].join('\n  '))
await browser.close()
server.close()
