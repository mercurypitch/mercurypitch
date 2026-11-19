// LAB-CHECKS 2 and the carried objects for group E's three cuts, each frame seeked in Chromium with the real kit and
// fonts (the hosts hidden on both sides: their passes are not seeked here; the lab clips show them). Adapted from group
// D's lab/s11-sing/cutprobe.mjs (left as it is), with S13 itself in place of its stand-in:
//   recap  S12's last 0.5 s (compositions/s12-your-turn.html, group D's) and S13's first 0.5 s: the matched cut, the frame
//          on F-turn's pixels (band, line, edges), the room crossfading from F-turn (L.roomCut)
//   next   S13's last 0.5 s and S14's first 0.5 s: the bead in flight on L.TEASE.carry, from film time on both sides
//   end    S14's last 0.5 s and S15's first 0.5 s: the tease figure on its shrink (L.TEASE.shrink), from film time
// Writes lab/<incoming scene>/cut-<which>/frame-NNN.png (30 fps, frame 15 the first after the cut), out.png and in.png
// (the last frame before the cut and the first after it, scene times D - 0.0005 and 0), out60.png and in60.png (the true
// 60 fps film frames either side), rects.json (the carried object either side) and cut-<which>.mp4.
//
//   $S/bin/heavy node lab/s13-recap/cutprobe.mjs recap|next|end
import { createServer } from 'node:http'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '../..')
const which = process.argv[2]
if (!['recap', 'next', 'end'].includes(which)) { console.error('usage: cutprobe.mjs recap|next|end'); process.exit(2) }
const A = { recap: 's12-your-turn', next: 's13-recap', end: 's14-next' }[which]
const B = { recap: 's13-recap', next: 's14-next', end: 's15-end' }[which]
const LABDIR = B
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
rmSync(OUT, { recursive: true, force: true })
mkdirSync(OUT, { recursive: true })
writeFileSync(join(OUT, 'cut.html'), `<!doctype html>
<!-- lab/s13-recap/cutprobe.mjs's harness (${which}): ${A}, then ${B}. -->
<html lang="en"><head><meta charset="UTF-8" />
${scripts}
<link rel="stylesheet" href="/assets/lib/lesson.css" />
<style>
${fonts}
.merc { display: none !important; }
#a, #b { position: absolute; left: 0; top: 0; width: 1920px; height: 1080px; }
</style></head><body>
<div id="a">${bodyOf(A)}</div>
<div id="b">${bodyOf(B)}</div>
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
  return page.evaluate(({ side, A, B, which }) => {
    const root = document.getElementById(side)
    const S = window.__sceneProbe[side === 'a' ? A : B]
    const r2 = (r) => [r.left, r.top, r.right, r.bottom].map((v) => +v.toFixed(2))
    const texts = [...root.querySelectorAll('text')].filter((e) => { let a = 1; for (let x = e; x && x.nodeType === 1; x = x.parentNode) { const cs = getComputedStyle(x); if (cs.display === 'none') return false; if (x.hasAttribute('opacity')) a *= parseFloat(x.getAttribute('opacity')); else a *= parseFloat(cs.opacity || '1') } return a > 0.01 && e.textContent.trim() }).map((e) => e.textContent.trim())
    if (which === 'recap') {
      const band = root.querySelector('.band-chart .band rect').getBoundingClientRect()
      const m = S.ch.merc.path.getBoundingClientRect(), sw = +S.ch.merc.path.getAttribute('stroke-width'), ctm = S.ch.merc.path.getScreenCTM()
      const edges = [...root.querySelectorAll('.band-chart .band > rect')].slice(1).map((e) => { const r = e.getBoundingClientRect(); return [+r.top.toFixed(2), +r.height.toFixed(2)] })
      return { band: r2(band), line: { y: +((m.top + m.bottom) / 2).toFixed(2), x0: +m.left.toFixed(2), x1: +m.right.toFixed(2), px: +(sw * ctm.a).toFixed(2) }, edges, texts }
    }
    if (which === 'next') {
      const c = S.bead.core.getBoundingClientRect()
      return { bead: { x: +((c.left + c.right) / 2).toFixed(2), y: +((c.top + c.bottom) / 2).toFixed(2), r: +(c.width / 2).toFixed(2) }, texts }
    }
    const beads = S.te.beads.map((Bd) => { const c = Bd.outline.getBoundingClientRect(); return [+((c.left + c.right) / 2).toFixed(2), +((c.top + c.bottom) / 2).toFixed(2), +(c.width / 2).toFixed(2)] })
    const copies = S.te.beads.map((Bd) => { const c = Bd.copy.getBoundingClientRect(); return [+((c.left + c.right) / 2).toFixed(2), +((c.top + c.bottom) / 2).toFixed(2)] })
    const q = S.te.g.querySelector('text').getBoundingClientRect()
    return { beads, copies, q: r2(q), rows: S.te.g.querySelector('g[mask]').getAttribute('opacity'), texts }
  }, { side, A, B, which })
}
const rects = { out: await box('a', DA - 0.0005), in: await box('b', 0) }
writeFileSync(join(OUT, 'rects.json'), JSON.stringify(rects, null, 1) + '\n')
// the largest movement of the carried object across the cut
let worst = 0
if (which === 'recap') {
  worst = Math.max(...rects.out.band.map((v, i) => Math.abs(v - rects.in.band[i])), Math.abs(rects.out.line.y - rects.in.line.y), Math.abs(rects.out.line.px - rects.in.line.px))
  console.log(`S12 last: band ${rects.out.band.join(' ')}, line y ${rects.out.line.y} ${rects.out.line.px} px, edges ${JSON.stringify(rects.out.edges)} | labels ${rects.out.texts.join(', ') || 'none'}`)
  console.log(`S13 first: band ${rects.in.band.join(' ')}, line y ${rects.in.line.y} ${rects.in.line.px} px, edges ${JSON.stringify(rects.in.edges)} | labels ${rects.in.texts.join(', ') || 'none'}`)
} else if (which === 'next') {
  worst = Math.max(Math.abs(rects.out.bead.x - rects.in.bead.x), Math.abs(rects.out.bead.y - rects.in.bead.y), Math.abs(rects.out.bead.r - rects.in.bead.r))
  console.log(`S13 last: bead ${JSON.stringify(rects.out.bead)} | texts ${rects.out.texts.join(', ') || 'none'}`)
  console.log(`S14 first: bead ${JSON.stringify(rects.in.bead)} | texts ${rects.in.texts.join(', ') || 'none'}`)
} else {
  worst = Math.max(...rects.out.beads.flatMap((b, i) => b.map((v, k) => Math.abs(v - rects.in.beads[i][k]))), ...rects.out.copies.flatMap((b, i) => b.map((v, k) => Math.abs(v - rects.in.copies[i][k]))), ...rects.out.q.map((v, i) => Math.abs(v - rects.in.q[i])))
  console.log(`S14 last: beads ${JSON.stringify(rects.out.beads)} "?" ${rects.out.q.join(' ')} rows ${rects.out.rows} | texts ${rects.out.texts.join(', ')}`)
  console.log(`S15 first: beads ${JSON.stringify(rects.in.beads)} "?" ${rects.in.q.join(' ')} rows ${rects.in.rows} | texts ${rects.in.texts.join(', ')}`)
}
console.log(`largest movement of the carried object across the cut: ${worst.toFixed(3)} px`)
await browser.close()
server.close()
const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-framerate', '30', '-i', join(OUT, 'frame-%03d.png'), '-c:v', 'libx264', '-crf', '16', '-pix_fmt', 'yuv420p', join(OUT, `cut-${which}.mp4`)], { stdio: 'inherit' })
console.log('clip', r.status === 0 ? `${OUT}/cut-${which}.mp4 (frame 15 is the first after the cut)` : 'failed')
if (errors.length) console.log('page errors:\n  ' + [...new Set(errors)].join('\n  '))
