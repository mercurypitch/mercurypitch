// The kit's measuring pass: each lab page in lab/kit-src/ loaded in Chromium with the real fonts and the
// kit (assets/lib/scripts.txt, lesson.css, fonts.css.txt, the same as tools/lab.mjs), seeked to the times
// its window.__kitProbe[id] names, and every check it returns compared with its HANDOFFS value
// (within 2 px unless the check says otherwise). type.html also runs window.__kitWidths(), the real font
// widths and LAB-CHECKS lines 4 to 15 and 21's clearances.
//
//   $S/bin/heavy node lab/kit-src/probe.mjs [name ...]      (default: every page)
//
// Writes lab/kit-probe/RESULTS.md and results.json, lab/kit-type/WIDTHS.md (from widths-md.mjs's
// template) and lab/kit-<name>/probe.html (the harness it loaded). One Chromium, one page at a time.
// Playwright and Chromium are the container's (/opt/node-tools, /opt/pw-browsers), as tools/merc-pass.mjs.

import { createServer } from 'node:http'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '../..')
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PW_MODULE || '/opt/node-tools/node_modules/playwright')

const names = process.argv.slice(2).length
  ? process.argv.slice(2)
  : readdirSync(HERE).filter((f) => f.endsWith('.html')).map((f) => f.slice(0, -5)).sort()

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.ttf': 'font/ttf', '.webm': 'video/webm', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.wav': 'audio/wav' }
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

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome', args: ['--autoplay-policy=no-user-gesture-required'] })
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 })
let cur = ''
const errors = []
page.on('pageerror', (e) => errors.push(`${cur}: ${e.message}`))
page.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !/Failed to load resource/.test(m.text())) errors.push(`${cur}: [${m.type()}] ${m.text()}`) })
page.on('response', (r) => { if (r.status() >= 400 && !/favicon/.test(r.url())) errors.push(`${cur}: ${r.status()} ${r.url()}`) })
const all = []
let widths = null
for (const name of names) {
  cur = name
  const src = readFileSync(join(HERE, `${name}.html`), 'utf8')
  const body = src.slice(src.indexOf('<body>') + 6, src.lastIndexOf('</body>')).replace(/src="assets\//g, 'src="/assets/')
  const out = join(ROOT, 'lab', `kit-${name}`)
  mkdirSync(out, { recursive: true })
  writeFileSync(join(out, 'probe.html'), `<!doctype html>
<!-- The probe's harness for lab/kit-src/${name}.html (lab/kit-src/probe.mjs): the kit, the fonts, the page. -->
<html lang="en"><head><meta charset="UTF-8" />
${scripts}
<link rel="stylesheet" href="/assets/lib/lesson.css" />
<style>
${fonts}
</style></head><body><div id="root">${body}</div></body></html>
`)
  await page.goto(`http://127.0.0.1:${port}/lab/kit-${name}/probe.html`, { waitUntil: 'load' })
  await page.evaluate(async () => {
    await document.fonts.ready
    for (const f of ["600 30px 'Outfit'", "500 26px 'JetBrains Mono'", "italic 400 60px 'Instrument Serif'", "400 30px 'Inter'", "400 30px 'Noto Music'"]) await document.fonts.load(f)
  })
  const id = `kit-${name}`
  const res = await page.evaluate(async (id) => {
    const P = (window.__kitProbe || {})[id]
    const tl = (window.__timelines || {})[id]
    if (!P || !tl) return { missing: true }
    const rows = []
    for (const t of P.times) {
      tl.seek(t, false)
      await new Promise((r) => requestAnimationFrame(() => r()))
      try { for (const c of P.check(t)) rows.push({ t, ...c }) } catch (e) { rows.push({ t, name: 'check threw', got: String(e.message), want: '-', pass: false }) }
    }
    return { rows }
  }, id)
  if (res.missing) { all.push({ page: name, t: '-', name: 'probe', got: 'no __kitProbe or timeline', want: '-', pass: false }); continue }
  for (const r of res.rows) {
    const tol = r.tol ?? 2
    let pass
    if (r.pass != null) pass = r.pass
    else if (typeof r.want === 'number') pass = Math.abs(r.got - r.want) <= tol
    else pass = String(r.got) === String(r.want)
    all.push({ page: name, ...r, tol, pass })
  }
  if (name === 'type') widths = await page.evaluate(() => (window.__kitWidths ? window.__kitWidths() : null))
}
await browser.close()
server.close()

const fmt = (v) => (typeof v === 'number' ? (Math.round(v * 100) / 100).toString() : String(v))
const dir = join(ROOT, 'lab/kit-probe')
mkdirSync(dir, { recursive: true })
writeFileSync(join(dir, 'results.json'), JSON.stringify({ rows: all, errors, widths }, null, 1))
const fails = all.filter((r) => !r.pass)
let md = `# Kit probe: every module at its HANDOFFS pixels\n\nWritten by \`lab/kit-src/probe.mjs\` (Chromium with the film's fonts). `
md += `Each row is a lab page seeked to a time, a value read from the DOM (screen px, after every layer's transform), `
md += `and the HANDOFFS value it must match within the tolerance (2 px unless given).\n\n`
md += `**${all.length - fails.length} of ${all.length} pass.**${fails.length ? ' Failures first.' : ''}\n\n`
md += `| Page | t | Check | Measured | HANDOFFS | Tol | Pass |\n| - | - | - | - | - | - | - |\n`
for (const r of [...fails, ...all.filter((r) => r.pass)]) md += `| ${r.page} | ${fmt(r.t)} | ${r.name} | ${fmt(r.got)} | ${fmt(r.want)} | ${r.tol} | ${r.pass ? 'yes' : '**no**'} |\n`
if (errors.length) md += `\n## Console\n\n${errors.map((e) => '- ' + e.replace(/\|/g, '/')).join('\n')}\n`
writeFileSync(join(dir, 'RESULTS.md'), md)
if (widths) {
  const { default: render } = await import('./widths-md.mjs')
  mkdirSync(join(ROOT, 'lab/kit-type'), { recursive: true })
  writeFileSync(join(ROOT, 'lab/kit-type/WIDTHS.md'), render(widths))
}
console.log(`${all.length - fails.length}/${all.length} pass; ${errors.length} console messages; lab/kit-probe/RESULTS.md`)
for (const r of fails) console.log('FAIL', r.page, r.t, r.name, fmt(r.got), 'want', fmt(r.want))
for (const e of errors.slice(0, 20)) console.log('console', e)
