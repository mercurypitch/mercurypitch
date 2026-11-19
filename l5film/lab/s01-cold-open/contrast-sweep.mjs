// A frame-fixed label's contrast over whatever passes under it, every frame of a window (group A's labs): the
// scene seeked in its probe harness (lab/<sid>/probe.html, written by lab/s01-cold-open/probe.mjs), each label's
// region shot as drawn and with the label's own glyphs hidden (the check tool's way of finding the pixels behind
// them), with its paint and its drawn opacity. lab/s01-cold-open/contrast_sweep.py measures the shots.
//
//   $S/bin/heavy node lab/s01-cold-open/contrast-sweep.mjs <sid> <name> <from> <to> <labels>
//
// <from> and <to> are expressions of the scene's probe handle S (S.A.SUPPORT, ...); <labels> an expression giving
// the label elements ([S.support]). Writes lab/<sid>/contrast-<name>/ (shots and meta.json).
import { createServer } from 'node:http'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '../..')
const [SID, NAME, FROM, TO, LABELS] = process.argv.slice(2)
const OUT = join(ROOT, 'lab', SID, `contrast-${NAME}`)
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
await page.goto(`http://127.0.0.1:${port}/lab/${SID}/probe.html`, { waitUntil: 'load' })
await page.evaluate(async () => {
  await document.fonts.ready
  for (const f of ["600 30px 'Outfit'", "500 26px 'JetBrains Mono'", "500 30px 'JetBrains Mono'"]) await document.fonts.load(f)
  await new Promise((r) => setTimeout(r, 50))
})

const plan = await page.evaluate(({ SID, FROM, TO }) => {
  const S = window.__sceneProbe[SID]
  return { from: eval(FROM), to: eval(TO) }
}, { SID, FROM, TO })
const meta = { sid: SID, name: NAME, plan, labelsExpr: LABELS, frames: [] }
for (let k = Math.ceil(plan.from * 30 - 1e-6); k / 30 <= plan.to + 1e-9; k++) {
  const t = k / 30
  const labels = await page.evaluate(async ({ SID, LABELS, t }) => {
    const S = window.__sceneProbe[SID]
    window.__timelines[SID].seek(t, false)
    await new Promise((r) => requestAnimationFrame(() => r()))
    const alphaOf = (el) => { let a = 1; for (let e = el; e && e.nodeType === 1; e = e.parentElement) a *= parseFloat(getComputedStyle(e).opacity || '1'); return a }
    return eval(LABELS).map((el, i) => {
      const r = el.getBoundingClientRect()
      return { i, text: el.textContent.trim(), fill: getComputedStyle(el).fill, alpha: alphaOf(el), box: [r.left, r.top, r.right, r.bottom] }
    })
  }, { SID, LABELS, t })
  const shown = labels.filter((l) => l.alpha > 0.05)
  if (!shown.length) continue
  const x0 = Math.max(0, Math.floor(Math.min(...shown.map((l) => l.box[0])) - 6))
  const y0 = Math.max(0, Math.floor(Math.min(...shown.map((l) => l.box[1])) - 6))
  const x1 = Math.min(1920, Math.ceil(Math.max(...shown.map((l) => l.box[2])) + 6))
  const y1 = Math.min(1080, Math.ceil(Math.max(...shown.map((l) => l.box[3])) + 6))
  const clip = { x: x0, y: y0, width: x1 - x0, height: y1 - y0 }
  const name = `f${String(k).padStart(4, '0')}`
  await page.screenshot({ path: join(OUT, `${name}-a.png`), clip })
  await page.evaluate(({ SID, LABELS }) => { const S = window.__sceneProbe[SID]; for (const el of eval(LABELS)) el.style.setProperty('fill', 'transparent', 'important') }, { SID, LABELS })
  await page.screenshot({ path: join(OUT, `${name}-b.png`), clip })
  await page.evaluate(({ SID, LABELS }) => { const S = window.__sceneProbe[SID]; for (const el of eval(LABELS)) el.style.removeProperty('fill') }, { SID, LABELS })
  meta.frames.push({ pass: NAME, k, t, name, clip, labels: shown })
}
writeFileSync(join(OUT, 'meta.json'), JSON.stringify(meta, null, 1) + '\n')
console.log(`${meta.frames.length} frames shot`)
if (errors.length) console.log('page errors:\n  ' + [...new Set(errors)].join('\n  '))
await browser.close()
server.close()
