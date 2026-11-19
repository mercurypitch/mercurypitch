// Group D's fix round (D-01): load the kit and the film's fonts in Chromium, optionally one scene (hosts hidden), and
// run a measuring script in the page. The script file defines `async function measure({ seek, shot })` and returns
// JSON; `seek(t)` seeks the scene's timeline, `shot(name)` saves a screenshot into this folder's out/.
//
//   $S/bin/heavy node lab/s12-your-turn/fix-D-01/evalpage.mjs <script.js> [<sid>]
import { createServer } from 'node:http'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, extname, join, normalize, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '../../..')
// OUT_NAME picks the output folder (default out); REPLACE is a JSON list of [from, to] pairs applied to the scene's
// source before it loads (to measure an earlier geometry with the same harness)
const OUT = join(HERE, process.env.OUT_NAME || 'out')
mkdirSync(OUT, { recursive: true })
const [scriptFile, sid] = process.argv.slice(2)
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
const scripts = readFileSync(join(ROOT, 'assets/lib/scripts.txt'), 'utf8').split('\n').map((l) => l.trim())
  .filter((l) => l && !l.startsWith('#')).map((p) => `<script src="/${p}"></script>`).join('\n')
const fonts = readFileSync(join(ROOT, 'assets/lib/fonts.css.txt'), 'utf8').replace(/url\('assets\//g, "url('/assets/")
const body = sid ? (() => { const s = readFileSync(join(ROOT, 'compositions', `${sid}.html`), 'utf8'); let b = s.slice(s.indexOf('<body>') + 6, s.lastIndexOf('</body>')).replace(/src="assets\//g, 'src="/assets/'); for (const [a, c] of JSON.parse(process.env.REPLACE || '[]')) { if (!b.includes(a)) throw new Error('REPLACE: not found: ' + a); b = b.split(a).join(c) } return b })() : ''
writeFileSync(join(OUT, 'harness.html'), `<!doctype html>
<!-- lab/s12-your-turn/fix-D-01/evalpage.mjs's harness${sid ? ': ' + sid : ''} -->
<html lang="en"><head><meta charset="UTF-8" />
${scripts}
<link rel="stylesheet" href="/assets/lib/lesson.css" />
<style>
${fonts}
.merc { display: none !important; }
</style></head><body>
${body}
</body></html>
`)
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome' })
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
await page.goto(`http://127.0.0.1:${port}/lab/s12-your-turn/fix-D-01/${process.env.OUT_NAME || 'out'}/harness.html`, { waitUntil: 'load' })
await page.evaluate(async () => {
  await document.fonts.ready
  for (const f of ["600 30px 'Outfit'", "500 30px 'Outfit'", "700 30px 'Outfit'", "500 26px 'JetBrains Mono'", "italic 400 60px 'Instrument Serif'", "400 30px 'Inter'"]) await document.fonts.load(f)
  await new Promise((r) => setTimeout(r, 80))
})
await page.exposeFunction('__shot', async (name) => { await page.screenshot({ path: join(OUT, name) }); return name })
const src = readFileSync(resolve(scriptFile), 'utf8')
const result = await page.evaluate(async ({ src, sid }) => {
  const seek = async (t) => { window.__timelines[sid].seek(t, false); await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))) }
  const shot = (name) => window.__shot(name)
  const fn = new Function('return (' + src + ')')()
  return fn({ seek, shot, sid })
}, { src, sid })
console.log(JSON.stringify(result, null, 1))
if (errors.length) console.log('page errors:\n  ' + [...new Set(errors)].join('\n  '))
await browser.close()
server.close()
