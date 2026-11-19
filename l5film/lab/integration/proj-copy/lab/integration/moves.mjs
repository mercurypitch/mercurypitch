// Integration (item 5): every camera move in the film, seen at normal exposure. Each scene with a move is loaded
// alone in Chromium with the kit and the real fonts (as lab/s05-push/probe.mjs loads it), its timeline seeked, and for
// each move: the near layer's slide speed and the bokeh's and staves' shown alpha through the move (JSON), and
// screenshots at its start, middle and end, each a pair 0.1 s apart (lab/integration/moves/<sid>-<n>-*.png).
// The hosts' passes are not played here (no video is seeked): the room and the diagram are what is compared.
//
//   $S/bin/heavy node lab/integration/moves.mjs [<sid> ...]     (default: every scene with a camera move)
import { createServer } from 'node:http'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '../..')
const OUT = join(HERE, 'moves')
mkdirSync(OUT, { recursive: true })
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PW_MODULE || '/opt/node-tools/node_modules/playwright')
const sids = process.argv.slice(2).length ? process.argv.slice(2) : ['s01-cold-open', 's03-promise', 's04-recall', 's06-diaphragm', 's10-steady', 's12-your-turn', 's15-end']
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
const report = {}
for (const sid of sids) {
  const src = readFileSync(join(ROOT, 'compositions', `${sid}.html`), 'utf8')
  const body = src.slice(src.indexOf('<body>') + 6, src.lastIndexOf('</body>')).replace(/src="assets\//g, 'src="/assets/')
  writeFileSync(join(OUT, `${sid}.html`), `<!doctype html><html lang="en"><head><meta charset="UTF-8" />\n${scripts}\n<link rel="stylesheet" href="/assets/lib/lesson.css" />\n<style>\n${fonts}\nhtml,body{margin:0;background:#0d1117}</style></head><body><div id="root">${body}</div></body></html>\n`)
  await page.goto(`http://127.0.0.1:${port}/lab/integration/moves/${sid}.html`, { waitUntil: 'load' })
  await page.evaluate(async () => { await document.fonts.ready; for (const f of ["600 30px 'Outfit'", "500 26px 'JetBrains Mono'", "italic 400 60px 'Instrument Serif'", "400 30px 'Inter'"]) await document.fonts.load(f) })
  await page.waitForTimeout(300)
  const moves = await page.evaluate((sid) => {
    const cam = window.__sceneProbe[sid].cam, tl = window.__timelines[sid]
    const room = document.querySelector('#' + sid + ' .layer.under') ? null : null
    return cam.moves.filter((m) => m.kind === 'to' && m.dur >= 0.1 && m.dur <= 20).map((m) => {
      const prof = []
      for (let k = 0; k <= 40; k++) {
        const t = m.at + (m.dur * k) / 40
        tl.seek(t, false)
        const bok = document.querySelector('#' + sid + ' .bokeh') || document.querySelector('.bokeh')
        const stv = document.querySelector('.staves')
        prof.push({ t: +t.toFixed(3), v: +cam.slide(t).toFixed(1), vfy: +cam.slide(t, 'far', 'y').toFixed(1), bokeh: bok ? +bok.style.opacity : null, staves: stv ? +stv.style.opacity : null })
      }
      return { at: m.at, dur: m.dur, to: m.to, ease: typeof m.ease === 'string' ? m.ease : 'fn', prof }
    })
  }, sid)
  report[sid] = moves
  let n = 0
  for (const m of moves) {
    n++
    for (const [tag, u] of [['start', 0.12], ['mid', 0.5], ['end', 0.86]]) {
      for (const [k, dt] of [['a', 0], ['b', 0.1]]) {
        const t = m.at + m.dur * u + dt
        await page.evaluate(({ sid, t }) => window.__timelines[sid].seek(t, false), { sid, t })
        await page.waitForTimeout(30)
        await page.screenshot({ path: join(OUT, `${sid}-${n}-${tag}-${k}.png`) })
      }
    }
    for (const t of [m.at - 0.3, m.at + m.dur + 0.3]) {
      await page.evaluate(({ sid, t }) => window.__timelines[sid].seek(t, false), { sid, t })
      await page.waitForTimeout(30)
      await page.screenshot({ path: join(OUT, `${sid}-${n}-${t < m.at ? 'before' : 'after'}.png`) })
    }
  }
  console.log(sid, moves.map((m) => `${m.at.toFixed(2)}+${m.dur.toFixed(2)} peak v ${Math.max(...m.prof.map((p) => p.v)).toFixed(0)} px/s, bokeh shown ${Math.max(...m.prof.map((p) => p.bokeh || 0)).toFixed(3)}`).join('; '))
}
writeFileSync(join(OUT, 'moves.json'), JSON.stringify(report, null, 1))
if (errors.length) console.log('page errors:', [...new Set(errors)].join('\n  '))
await browser.close(); server.close()
