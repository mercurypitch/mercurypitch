// LAB-CHECKS 2 for the matched cut on `sing` (S10 to S11), from group C's side: S10's last 0.5 s and a stand-in for
// S11's first 0.5 s, each frame seeked in Chromium with the real kit and fonts, written as PNGs and joined into a
// 30 fps clip for measure.py. The stand-in is what HANDOFFS § The cuts gives S11 (and lab/kit-src/cuts.html builds):
// its own room at F0 under L.roomCut(room, { from: 'F-hold' }), the dust from film time, and the hold frame drawn from
// the kit's one definition, L.bandChart(world, L.CHART.FRAME), with Merc's line at 4 px. s11-sing is group D's; this
// stand-in only proves S10's last frame against the frame the kit defines. The hosts are hidden on both sides (their
// passes are not seeked here; a clip of the film shows them).
//
//   $S/bin/heavy node lab/s10-steady/cutprobe.mjs
//
// Writes lab/s10-steady/cut/frame-NNN.png, cut/s10-last.png, cut/s11-first.png and cut/cut-s10-s11.mp4.
import { createServer } from 'node:http'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '../..')
const OUT = join(HERE, 'cut')
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
const src = readFileSync(join(ROOT, 'compositions', 's10-steady.html'), 'utf8')
const body = src.slice(src.indexOf('<body>') + 6, src.lastIndexOf('</body>')).replace(/src="assets\//g, 'src="/assets/')

rmSync(OUT, { recursive: true, force: true })
mkdirSync(OUT, { recursive: true })
writeFileSync(join(OUT, 'cut.html'), `<!doctype html>
<!-- lab/s10-steady/cutprobe.mjs's harness: S10, then a stand-in for S11's first 0.5 s (the kit's FRAME at F0). -->
<html lang="en"><head><meta charset="UTF-8" />
${scripts}
<link rel="stylesheet" href="/assets/lib/lesson.css" />
<style>
${fonts}
.merc { display: none !important; }
#a, #b { position: absolute; left: 0; top: 0; width: 1920px; height: 1080px; }
</style></head><body>
<div id="a">${body}</div>
<div id="b"><div class="scene" id="s11-standin-scene" style="position:absolute;left:0;top:0;width:1920px;height:1080px"></div></div>
<script>
;(function () {
  const SID = 's11-sing', D = 0.5, T0 = L.scene(SID).start
  const root = document.getElementById('s11-standin-scene')
  const room = L.room(root, { floor: true })
  const cut = L.roomCut(room, { from: 'F-hold' })
  const world = L.stage(room.mid)
  const dust = L.filmDust(room.near)
  const cam = L.frameRig(room, { from: 'F0' })
  const ch = L.bandChart(world, L.CHART.FRAME)
  const tl = gsap.timeline({ paused: true })
  L.clock(tl, D, (t) => { cam.apply(t); cut.draw(t, T0 + t); dust(T0 + t); ch.draw({ merc: { a: 1, w: 4 } }) })
  window.__timelines['s11-standin'] = tl
})()
</script></body></html>
`)
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome' })
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
await page.goto(`http://127.0.0.1:${port}/lab/s10-steady/cut/cut.html`, { waitUntil: 'load' })
await page.evaluate(async () => { await document.fonts.ready; await new Promise((r) => setTimeout(r, 50)) })
const D10 = await page.evaluate(() => L.dur('s10-steady'))
const shot = async (which, t, file) => {
  await page.evaluate(({ which, t }) => {
    document.getElementById('a').style.display = which === 'a' ? '' : 'none'
    document.getElementById('b').style.display = which === 'b' ? '' : 'none'
    window.__timelines[which === 'a' ? 's10-steady' : 's11-standin'].seek(t, false)
  }, { which, t })
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r())))
  await page.screenshot({ path: join(OUT, file) })
}
let n = 0
for (let k = 0; k < 15; k++) await shot('a', D10 - 0.5 + k / 30, `frame-${String(n++).padStart(3, '0')}.png`)
for (let k = 0; k <= 15; k++) await shot('b', k / 30, `frame-${String(n++).padStart(3, '0')}.png`)
await shot('a', D10 - 0.0005, 's10-last.png')
await shot('b', 0, 's11-first.png')
const rects = await page.evaluate(() => {
  document.getElementById('a').style.display = ''
  window.__timelines['s10-steady'].seek(L.dur('s10-steady') - 0.0005, false)
  const a = document.querySelector('#a .band rect').getBoundingClientRect()
  const ma = window.__sceneProbe['s10-steady'].ch.merc.path.getBoundingClientRect()
  document.getElementById('a').style.display = 'none'
  document.getElementById('b').style.display = ''
  window.__timelines['s11-standin'].seek(0, false)
  const b = document.querySelector('#b .band rect').getBoundingClientRect()
  const mb = document.querySelector('#b .band-chart path:not([stroke-opacity])') ? null : null
  return { a: [a.left, a.top, a.right, a.bottom], ma: [ma.left, ma.top, ma.right, ma.bottom], b: [b.left, b.top, b.right, b.bottom] }
})
console.log('S10 last frame: band', rects.a.map((v) => v.toFixed(2)).join(' '), '| Merc\'s line', rects.ma.map((v) => v.toFixed(2)).join(' '))
console.log('stand-in first frame: band', rects.b.map((v) => v.toFixed(2)).join(' '))
await browser.close()
server.close()
const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-framerate', '30', '-i', join(OUT, 'frame-%03d.png'), '-c:v', 'libx264', '-crf', '16', '-pix_fmt', 'yuv420p', join(OUT, 'cut-s10-s11.mp4')], { stdio: 'inherit' })
console.log('clip', r.status === 0 ? 'lab/s10-steady/cut/cut-s10-s11.mp4 (frame 15 is the cut)' : 'failed')
if (errors.length) console.log('page errors:\n  ' + errors.join('\n  '))
