// LAB-CHECKS 2 for group D's two matched cuts, each frame seeked in Chromium with the real kit and fonts (the hosts
// hidden on both sides: their passes are not seeked here; the lab clips show them):
//   sing   S10's last 0.5 s (compositions/s10-steady.html, group C's) and S11's first 0.5 s (compositions/s11-sing.html)
//   b38    S11's last 0.5 s and S12's first 0.5 s (the plain cut at F0: every object of the turn on the same pixels)
//   recap  S12's last 0.5 s (compositions/s12-your-turn.html) and a stand-in for S13's first 0.5 s: what HANDOFFS § The
//          cuts gives S13 and the kit defines (lab/kit-src/cuts.html): its room at F0 under L.roomCut(room, { from:
//          'F-turn' }), the dust from film time, the frame from L.RECAP.FROM with Merc's line at L.RECAP.mercW(0).
//          s13-recap is group E's; the stand-in only proves S12's last frame against the frame the kit defines.
// Writes lab/<scene>/cut-<which>/frame-NNN.png (30 fps, frame 15 the first after the cut), out.png and in.png (the
// last frame before the cut and the first after it, scene times D - 0.0005 and 0), out60.png and in60.png (the true
// 60 fps film frames either side), rects.json (the carried object's boxes either side) and cut-<which>.mp4.
//
//   $S/bin/heavy node lab/s11-sing/cutprobe.mjs sing|b38|recap
import { createServer } from 'node:http'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '../..')
const which = process.argv[2]
if (!['sing', 'b38', 'recap'].includes(which)) { console.error('usage: cutprobe.mjs sing|b38|recap'); process.exit(2) }
const A = { sing: 's10-steady', b38: 's11-sing', recap: 's12-your-turn' }[which]
const B = { sing: 's11-sing', b38: 's12-your-turn', recap: 's13-recap' }[which]
const LABDIR = which === 'sing' ? 's11-sing' : 's12-your-turn'
const OUT = join(ROOT, 'lab', LABDIR, `cut-${which}`)
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
const bodyOf = (sid) => { const s = readFileSync(join(ROOT, 'compositions', `${sid}.html`), 'utf8'); return s.slice(s.indexOf('<body>') + 6, s.lastIndexOf('</body>')).replace(/src="assets\//g, 'src="/assets/') }
const standIn = `<div class="scene" id="s13-standin-scene" style="position:absolute;left:0;top:0;width:1920px;height:1080px"></div>
<script>
;(function () {
  const SID = 's13-recap', D = 0.5, T0 = L.scene(SID).start
  const root = document.getElementById('s13-standin-scene')
  const room = L.room(root, { floor: true })
  const cut = L.roomCut(room, { from: 'F-turn' })
  const world = L.stage(room.mid)
  const dust = L.filmDust(room.near)
  const cam = L.frameRig(room, { from: 'F0' })
  const ch = L.bandChart(world, { ...L.RECAP.FROM, strip: null })
  window.__standIn = { ch }
  const tl = gsap.timeline({ paused: true })
  L.clock(tl, D, (t) => { cam.apply(t); cut.draw(t, T0 + t); dust(T0 + t); ch.draw({ merc: { a: 1, w: L.RECAP.mercW(0) } }) })
  window.__timelines = window.__timelines || {}
  window.__timelines[SID] = tl
})()
</script>`

rmSync(OUT, { recursive: true, force: true })
mkdirSync(OUT, { recursive: true })
writeFileSync(join(OUT, 'cut.html'), `<!doctype html>
<!-- lab/s11-sing/cutprobe.mjs's harness (${which}): ${A}, then ${which === 'recap' ? 'a stand-in for S13 (the kit\'s RECAP.FROM at F0)' : B}. -->
<html lang="en"><head><meta charset="UTF-8" />
${scripts}
<link rel="stylesheet" href="/assets/lib/lesson.css" />
<style>
${fonts}
.merc { display: none !important; }
#a, #b { position: absolute; left: 0; top: 0; width: 1920px; height: 1080px; }
</style></head><body>
<div id="a">${bodyOf(A)}</div>
<div id="b">${which === 'recap' ? standIn : bodyOf(B)}</div>
</body></html>
`)
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome' })
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
await page.goto(`http://127.0.0.1:${port}/lab/${LABDIR}/cut-${which}/cut.html`, { waitUntil: 'load' })
await page.evaluate(async () => {
  await document.fonts.ready
  for (const f of ["600 30px 'Outfit'", "500 26px 'JetBrains Mono'", "italic 400 60px 'Instrument Serif'", "400 30px 'Inter'"]) await document.fonts.load(f)
  await new Promise((r) => setTimeout(r, 50))
})
const DA = await page.evaluate((a) => L.dur(a), A)
const startB = await page.evaluate((b) => L.scene(b).start, B)
const shot = async (side, t, file) => {
  await page.evaluate(({ side, t, A, B }) => {
    document.getElementById('a').style.display = side === 'a' ? '' : 'none'
    document.getElementById('b').style.display = side === 'b' ? '' : 'none'
    window.__timelines[side === 'a' ? A : B].seek(t, false)
  }, { side, t, A, B })
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r())))
  if (file) await page.screenshot({ path: join(OUT, file) })
}
let n = 0
for (let k = 0; k < 15; k++) await shot('a', DA - 0.5 + k / 30, `frame-${String(n++).padStart(3, '0')}.png`)
for (let k = 0; k <= 15; k++) await shot('b', k / 30, `frame-${String(n++).padStart(3, '0')}.png`)
await shot('a', DA - 0.0005, 'out.png')
await shot('b', 0, 'in.png')
// the true 60 fps film frames either side of the cut: the last film frame before B's start and the first at or after it
const nB = Math.ceil(startB * 60 - 1e-6)
await shot('a', DA - (startB - (nB - 1) / 60), 'out60.png')
await shot('b', nB / 60 - startB, 'in60.png')
// the carried object's boxes on both sides
const box = async (side, t) => {
  await shot(side, t, null)
  return page.evaluate(({ side, A, B }) => {
    const root = document.getElementById(side)
    const band = root.querySelector('.band-chart .band rect').getBoundingClientRect()
    const chart = side === 'a' ? window.__sceneProbe[A].ch : window.__sceneProbe[B] ? window.__sceneProbe[B].ch : window.__standIn.ch
    const m = chart.merc.path.getBoundingClientRect()
    const sw = +chart.merc.path.getAttribute('stroke-width')
    const ctm = chart.merc.path.getScreenCTM()
    const texts = [...root.querySelectorAll('text')].filter((e) => { let a = 1; for (let x = e; x && x.nodeType === 1; x = x.parentNode) { const cs = getComputedStyle(x); if (cs.display === 'none') return false; a *= parseFloat(cs.opacity || '1'); if (x.hasAttribute('opacity')) a *= parseFloat(x.getAttribute('opacity')) } return a > 0.01 && e.textContent.trim() }).map((e) => e.textContent.trim())
    return { band: [band.left, band.top, band.right, band.bottom].map((v) => +v.toFixed(2)), line: { y: +((m.top + m.bottom) / 2).toFixed(2), x0: +m.left.toFixed(2), x1: +m.right.toFixed(2), px: +(sw * ctm.a).toFixed(2) }, texts }
  }, { side, A, B })
}
const rects = { out: await box('a', DA - 0.0005), in: await box('b', 0) }
writeFileSync(join(OUT, 'rects.json'), JSON.stringify(rects, null, 1) + '\n')
console.log(`${A} last frame: band ${rects.out.band.join(' ')} | Merc's line y ${rects.out.line.y}, x ${rects.out.line.x0} to ${rects.out.line.x1}, ${rects.out.line.px} px | labels: ${rects.out.texts.join(', ') || 'none'}`)
console.log(`${which === 'recap' ? 'S13 stand-in' : B} first frame: band ${rects.in.band.join(' ')} | Merc's line y ${rects.in.line.y}, x ${rects.in.line.x0} to ${rects.in.line.x1}, ${rects.in.line.px} px | labels: ${rects.in.texts.join(', ') || 'none'}`)
await browser.close()
server.close()
const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-framerate', '30', '-i', join(OUT, 'frame-%03d.png'), '-c:v', 'libx264', '-crf', '16', '-pix_fmt', 'yuv420p', join(OUT, `cut-${which}.mp4`)], { stdio: 'inherit' })
console.log('clip', r.status === 0 ? `${OUT}/cut-${which}.mp4 (frame 15 is the first after the cut)` : 'failed')
if (errors.length) console.log('page errors:\n  ' + [...new Set(errors)].join('\n  '))
