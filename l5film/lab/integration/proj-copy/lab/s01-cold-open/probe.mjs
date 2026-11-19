// Group A's measuring pass (s01 to s04): a scene loaded alone in Chromium with the real fonts and the kit (as
// tools/lab.mjs and lab/kit-src/probe.mjs load them), its timeline seeked to each time its checks file names, and
// every check printed and written as JSON. The checks file (lab/<sid>/checks.js) sets
//   window.__groupA = { times: [...], check(t, S) -> [{ name, got, want, tol = 2 } | { name, got, want, pass }] }
// where S is the scene's own handle (window.__sceneProbe[sid], the objects the scene exposes for its lab).
//
//   $S/bin/heavy node lab/s01-cold-open/probe.mjs <sid> [<sid> ...]
//
// Writes lab/<sid>/probe.json and lab/<sid>/probe.html (the harness it loaded).
import { createServer } from 'node:http'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '../..')
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PW_MODULE || '/opt/node-tools/node_modules/playwright')
const sids = process.argv.slice(2)

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
const scripts = readFileSync(join(ROOT, 'assets/lib/scripts.txt'), 'utf8').split('\n').map((l) => l.trim())
  .filter((l) => l && !l.startsWith('#')).map((p) => `<script src="/${p}"></script>`).join('\n')
const fonts = readFileSync(join(ROOT, 'assets/lib/fonts.css.txt'), 'utf8').replace(/url\('assets\//g, "url('/assets/")

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome' })
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push('[console] ' + m.text()) })
page.on('response', (r) => { if (r.status() >= 400 && !/favicon/.test(r.url())) errors.push(`${r.status()} ${r.url()}`) })
let fails = 0
for (const sid of sids) {
  const src = readFileSync(join(ROOT, 'compositions', `${sid}.html`), 'utf8')
  const body = src.slice(src.indexOf('<body>') + 6, src.lastIndexOf('</body>')).replace(/src="assets\//g, 'src="/assets/')
  writeFileSync(join(ROOT, 'lab', sid, 'probe.html'), `<!doctype html>
<!-- The probe's harness for compositions/${sid}.html (lab/s01-cold-open/probe.mjs). -->
<html lang="en"><head><meta charset="UTF-8" />
${scripts}
<link rel="stylesheet" href="/assets/lib/lesson.css" />
<style>
${fonts}
</style></head><body><div id="root">${body}</div>
<script src="/lab/s01-cold-open/helpers.js"></script>
<script src="/lab/${sid}/checks.js"></script></body></html>
`)
  await page.goto(`http://127.0.0.1:${port}/lab/${sid}/probe.html`, { waitUntil: 'load' })
  await page.evaluate(async () => {
    await document.fonts.ready
    for (const f of ["600 30px 'Outfit'", "500 26px 'JetBrains Mono'", "italic 400 60px 'Instrument Serif'", "400 30px 'Inter'"]) await document.fonts.load(f)
    await new Promise((r) => setTimeout(r, 50))
  })
  const rows = await page.evaluate(async (sid) => {
    const G = window.__groupA, tl = window.__timelines[sid], S = (window.__sceneProbe || {})[sid]
    const out = []
    for (const t of G.times) {
      tl.seek(t, false)
      await new Promise((r) => requestAnimationFrame(() => r()))
      for (const c of G.check(t, S)) {
        const tol = c.tol ?? 2
        const pass = c.pass ?? (typeof c.got === 'number' && typeof c.want === 'number' ? Math.abs(c.got - c.want) <= tol : c.got === c.want)
        out.push({ t, ...c, got: typeof c.got === 'number' ? Math.round(c.got * 100) / 100 : c.got, pass })
      }
    }
    return out
  }, sid)
  writeFileSync(join(ROOT, 'lab', sid, 'probe.json'), JSON.stringify(rows, null, 1) + '\n')
  console.log(`\n${sid}`)
  for (const r of rows) {
    if (!r.pass) fails++
    console.log(`  ${r.pass ? 'ok  ' : 'FAIL'} t ${String(r.t).padEnd(7)} ${r.name}: ${r.got}${r.want !== undefined ? ` (want ${r.want})` : ''}`)
  }
}
if (errors.length) console.log('\npage errors:\n  ' + [...new Set(errors)].join('\n  '))
await browser.close()
server.close()
process.exit(fails ? 1 : 0)
