// Render one Merc performance to two videos the composition layers exactly.
//
//   node tools/merc-pass.mjs merc/shots/<id>.json [--draft]
//   node tools/merc-pass.mjs merc/shots/<id>.json --stills=1.2,3.4
//        (lab: PNGs of those shot times over the room's obsidian, in
//        lab/merc/<id>-<t>.png; no video is written)
//
// The app's renderer draws Merc with premultiplied alpha, and his light (the
// bloom, the floor pool, the sparkles) is additive: it carries colour where
// alpha is zero. A plain un-premultiply throws that light away, and a matte +
// plus-lighter pair breaks inside any transformed or faded layer (CSS blends
// only within its stacking context). So each pass is one straight-alpha video,
// <id>-merc.webm, with alpha a = max(A, R, G, B): normal compositing gives
// C + (1 - a) * ground, his light exact and the ground under it darkened by at
// most a few levels on this film's obsidian room.
//
// A shot file:
// {
//   "id": "s02-blue", "variant": "blue" | "orange", "size": 640,
//   "quality": "medium", "fps": 30, "duration": 4.0, "view": "hero",
//   "cues":  [{ "t": 0, "state": "idle" }, { "t": 1.2, "state": "sing" }],
//   "voice": [{ "t0": 1.2, "t1": 2.6, "level": 0.7, "cents": 0, "steady": 0.9 }]
//            or { "envelope": "assets/voice/<line>.env.json", "offset": 1.2 },
//            a sung span's edges: "edgeIn" 0.06 and "edgeOut" 0.08 s by default, 0 for a step
//   "bias":  [{ "t": 0, "yaw": 0.0, "lookX": 0.0, "lookY": 0.0 }],
//   "arcs":  [{ "t": 0, "v": 0 }]   sung sound arcs, 0 while he speaks
//   "sparkles": "around"
// }
// Every value is a function of the shot's own time: the same file renders the
// same frames every time.

import { spawn } from 'node:child_process'
import { readFileSync, mkdirSync, existsSync, renameSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// The MercuryPitch checkout's Playwright, and the Chromium it drives. MERCURYPITCH_REPO,
// PLAYWRIGHT_MODULE and CHROMIUM_PATH override them.
const REPO = process.env.MERCURYPITCH_REPO ?? '/home/user/mercurypitch'
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE ?? `${REPO}/node_modules/.pnpm/playwright@1.60.0/node_modules/playwright/index.mjs`
)

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..')
const args = process.argv.slice(2)
const draft = args.includes('--draft')
const stillsArg = args.find((a) => a.startsWith('--stills='))
const stills = stillsArg ? stillsArg.slice('--stills='.length).split(',').map(Number).sort((a, b) => a - b) : null
const files = args.filter((a) => !a.startsWith('--'))
if (!files.length) {
  console.error('usage: node tools/merc-pass.mjs <shot.json>... [--draft]')
  process.exit(1)
}

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
})

for (const file of files) {
  const shot = JSON.parse(readFileSync(resolve(file), 'utf8'))
  // Voice: a list of segments, each a sung span { t0, t1, level, cents } or a
  // spoken line { env: <envelope file>, offset, gain }. Envelopes are inlined.
  if (shot.voice && !Array.isArray(shot.voice)) {
    shot.voice = [{ env: shot.voice.envelope, offset: shot.voice.offset, gain: shot.voice.gain }]
  }
  for (const seg of shot.voice ?? []) {
    if (seg.env && typeof seg.env === 'string') seg.env = JSON.parse(readFileSync(join(ROOT, seg.env), 'utf8'))
  }
  // timeScale: the performance runs this many times faster than the film
  // (orange's double-time bounce). Every authored time is in shot time; the
  // simulation sees shot time x timeScale.
  const k = shot.timeScale ?? 1
  if (k !== 1) {
    for (const c of shot.cues ?? []) c.t *= k
    for (const s of shot.voice ?? []) { if ('t0' in s) { s.t0 *= k; s.t1 *= k } if ('offset' in s) s.offset *= k }
    for (const b of shot.bias ?? []) b.t *= k
    for (const a of shot.arcs ?? []) a.t *= k
  }
  const quality = draft ? 'low' : (shot.quality ?? 'medium')
  const fps = shot.fps ?? 30
  const n = Math.round(shot.duration * fps)
  const outDir = join(ROOT, 'assets/merc')
  mkdirSync(outDir, { recursive: true })
  const base = join(outDir, shot.id + (draft ? '-draft' : ''))

  const page = await browser.newPage({ viewport: { width: shot.size + 20, height: shot.size + 20 } })
  page.on('pageerror', (e) => console.error('pageerror', e.message))
  await page.setContent('<!doctype html><html><body style="margin:0;background:transparent"><div id="a"></div></body></html>')
  await page.addScriptTag({ path: join(ROOT, `assets/merc-lib/merc-${shot.variant}.js`) })
  const [w, h] = await page.evaluate(
    ({ shot, quality }) => {
      const el = document.getElementById('a')
      el.style.width = shot.size + 'px'
      el.style.height = shot.size + 'px'
      const L = window.MercLib
      const cues = [...(shot.cues ?? [{ t: 0, state: 'idle' }])].sort((a, b) => a.t - b.t)
      const m = L.mount(el, {
        capture: true,
        continuous: true,
        transparent: true,
        size: shot.size,
        pixelRatio: 1,
        quality,
        state: cues[0].state,
        view: shot.view ?? 'hero',
        sparkles: shot.sparkles === 'none' ? 'around' : (shot.sparkles ?? 'around'),
        rings: shot.rings ?? true,
        // Lesson 2: `ride`'s mouth ('open' is the "ooh"); a shot without it keeps the renderer's default
        ...(shot.glideMouth ? { glideMouth: shot.glideMouth } : {}),
      })
      if (shot.variant === 'orange') m.setLook(L.WARM)
      if (shot.look) m.setLook(shot.look)
      // Voice: note spans with soft edges, or a loudness envelope (speech).
      const span = (v, t) => {
        for (const s of v) {
          if (s.env) {
            const i = Math.floor((t - (s.offset ?? 0)) * s.env.rate)
            if (i >= 0 && i < s.env.level.length) {
              const level = s.env.level[i]
              if (level > 0.04) return { voiced: true, cents: 0, level: Math.min(1, level * (s.gain ?? 1)), steady: 0.95, midi: 57 }
            }
            continue
          }
          if (t >= s.t0 && t < s.t1) {
            // soft edges, 0.06 s in and 0.08 s out; `edgeIn` or `edgeOut` 0 is a step (a mouth lead into its note)
            const a = s.edgeIn ?? 0.06, b = s.edgeOut ?? 0.08
            const edge = Math.min(1, a > 0 ? (t - s.t0) / a : 1, b > 0 ? (s.t1 - t) / b : 1)
            return { voiced: true, cents: s.cents ?? 0, level: (s.level ?? 0.7) * Math.max(0, edge), steady: s.steady ?? 0.9, midi: s.midi ?? 57 }
          }
        }
        return null
      }
      const fromEnv = (v, t) => {
        const env = v.env
        const i = Math.floor((t - (v.offset ?? 0)) * env.rate)
        if (i < 0 || i >= env.level.length) return null
        const level = env.level[i]
        return level > 0.04 ? { voiced: true, cents: 0, level: Math.min(1, level * (v.gain ?? 1)), steady: 0.95, midi: 57 } : null
      }
      const silent = { voiced: false, cents: 0, level: 0, steady: 1, midi: 57 }
      // In continuous capture the renderer restarts voice time at every
      // setState, so the source adds back the last cue's time: shot voices
      // are written in shot time.
      let cueT = cues[0].t
      if (shot.voice) {
        m.setVoiceSource((t) => {
          const T = cueT + t
          return span(shot.voice, T) ?? silent
        })
      }
      const bias = [...(shot.bias ?? [])].sort((a, b) => a.t - b.t)
      const biasAt = (t) => {
        if (!bias.length) return null
        if (t <= bias[0].t) return bias[0]
        for (let i = 0; i < bias.length - 1; i++) {
          const a = bias[i], b = bias[i + 1]
          if (t < b.t) {
            const u = (t - a.t) / (b.t - a.t)
            const e = u * u * (3 - 2 * u)
            const mix = (k) => (a[k] ?? 0) + ((b[k] ?? 0) - (a[k] ?? 0)) * e
            return { yaw: mix('yaw'), lookX: mix('lookX'), lookY: mix('lookY') }
          }
        }
        return bias[bias.length - 1]
      }
      // Sound arcs: keys { t, v }, linear between; default 1 (sung).
      const arcs = [...(shot.arcs ?? [])].sort((a, b) => a.t - b.t)
      const arcsAt = (t) => {
        if (!arcs.length) return 1
        if (t <= arcs[0].t) return arcs[0].v
        for (let i = 0; i < arcs.length - 1; i++) {
          if (t < arcs[i + 1].t) return arcs[i].v + (arcs[i + 1].v - arcs[i].v) * ((t - arcs[i].t) / (arcs[i + 1].t - arcs[i].t))
        }
        return arcs[arcs.length - 1].v
      }
      window.__mercSparkles = shot.sparkles !== 'none'
      window.__mercArcs = arcsAt(0)
      let cueIdx = 0
      m.renderAt(0)
      const gl = m.canvas.getContext('webgl2')
      const W = gl.drawingBufferWidth, H = gl.drawingBufferHeight
      const buf = new Uint8Array(W * H * 4)
      window.__frame = (T) => {
        while (cueIdx + 1 < cues.length && cues[cueIdx + 1].t <= T + 1e-9) {
          const next = cues[cueIdx + 1]
          m.renderAt(next.t - cueT)
          m.setState(next.state)
          cueT = next.t
          cueIdx++
        }
        const b = biasAt(T)
        if (b) m.setPoseBias(b)
        window.__mercArcs = arcsAt(T)
        m.renderAt(T - cueT)
        gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, buf)
        // Premultiplied colour C with Merc's alpha A -> straight colour C / a with
        // a = max(A, max(C)): normal compositing then gives C + (1 - a) * ground,
        // so his additive light (bloom, floor pool, sparkles) survives a plain
        // alpha video that composites correctly in any stacking context.
        for (let i = 0; i < buf.length; i += 4) {
          const r = buf[i], g = buf[i + 1], b = buf[i + 2], a = buf[i + 3]
          const m = Math.max(a, r, g, b)
          if (m < 2) { buf[i] = 0; buf[i + 1] = 0; buf[i + 2] = 0; buf[i + 3] = 0; continue }
          const k = 255 / m
          buf[i] = Math.min(255, Math.round(r * k)); buf[i + 1] = Math.min(255, Math.round(g * k)); buf[i + 2] = Math.min(255, Math.round(b * k)); buf[i + 3] = m
        }
        let s = ''
        const CH = 0x8000
        for (let i = 0; i < buf.length; i += CH) s += String.fromCharCode.apply(null, buf.subarray(i, i + CH))
        return btoa(s)
      }
      return [W, H]
    },
    { shot, quality },
  )

  if (stills) {
    // Lab stills: straight-alpha frames composited over #0d1117, flipped upright.
    const labDir = join(ROOT, 'lab/merc')
    mkdirSync(labDir, { recursive: true })
    for (const T of stills) {
      const buf = Buffer.from(await page.evaluate((T) => window.__frame(T), T * k), 'base64')
      const out = Buffer.alloc(w * h * 3)
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = ((h - 1 - y) * w + x) * 4, o = (y * w + x) * 3, a = buf[i + 3] / 255
          out[o] = Math.round(buf[i] * a + 13 * (1 - a)); out[o + 1] = Math.round(buf[i + 1] * a + 17 * (1 - a)); out[o + 2] = Math.round(buf[i + 2] * a + 23 * (1 - a))
        }
      }
      const png = join(labDir, `${shot.id}-${T.toFixed(2)}.png`)
      await new Promise((res, rej) => {
        const p = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${w}x${h}`, '-i', '-', png], { stdio: ['pipe', 'inherit', 'inherit'] })
        p.on('close', (c) => (c ? rej(new Error('ffmpeg ' + c)) : res()))
        p.stdin.end(out)
      })
      console.log('still', png)
    }
    await page.close()
    continue
  }

  // One straight-alpha VP9 at the drawing buffer's own size: the composition
  // sizes the element, and the browser scales premultiplied, so edges stay clean.
  // format=rgba is forced first: left to negotiate, ffmpeg once picked a format
  // without alpha here and every matte came out opaque.
  const ff = spawn(
    'ffmpeg',
    [
      '-hide_banner', '-loglevel', 'error', '-y',
      '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${w}x${h}`, '-r', String(fps), '-i', '-',
      '-vf', 'format=rgba,vflip,format=yuva420p',
      '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p', '-b:v', '0', '-crf', draft ? '28' : '14', '-auto-alt-ref', '0', '-row-mt', '1',
      `${base}-merc.part.webm`,
    ],
    { stdio: ['pipe', 'inherit', 'inherit'] },
  )
  // Crescent guard. At the top of a fast stretch (hop take-off, celebrate) the
  // shader can paint an opaque black crescent along the crown for one frame,
  // at any quality (seen in m01-orange, m10, m21). A frame with more than 40
  // opaque near-black pixels in its top 40 % (the eyes never reach that high:
  // twelve passes without hops scan clean) is re-rendered at a nudged time,
  // the nearest clean one within 12 ms. The buffer is bottom-up (GL), so the
  // top of the picture is the end of the buffer.
  const crescent = (buf) => {
    let bad = 0
    for (let y = Math.floor(h * 0.6); y < h; y++) {
      for (let x = 0, o = (y * w) * 4; x < w; x++, o += 4) {
        if (buf[o + 3] > 200 && buf[o] < 25 && buf[o + 1] < 25 && buf[o + 2] < 25) bad++
      }
    }
    return bad > 40
  }
  const NUDGES = [1, -1, 2, -2, 3, -3].map((s) => s / 240)
  const t0 = Date.now()
  let fixed = 0
  for (let i = 0; i < n; i++) {
    const T = (i / fps) * k
    let buf = Buffer.from(await page.evaluate((T) => window.__frame(T), T), 'base64')
    if (crescent(buf)) {
      for (const d of NUDGES) {
        const alt = Buffer.from(await page.evaluate((T) => window.__frame(T), T + d * k), 'base64')
        if (!crescent(alt)) { buf = alt; fixed++; break }
      }
      if (crescent(buf)) console.warn(`\n${shot.id}: frame ${i} still shows the crescent after nudging`)
    }
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r))
    if (i % 30 === 29) process.stdout.write(`\r${shot.id} ${i + 1}/${n}`)
  }
  if (fixed) console.log(`\n${shot.id}: ${fixed} frames re-rendered at a nudged time (crescent guard)`)
  ff.stdin.end()
  await new Promise((r) => ff.on('close', r))
  console.log(`\r${shot.id}: ${n} frames, ${w}x${h}, ${((Date.now() - t0) / n).toFixed(0)} ms/frame`)
  await page.close()
  // Written under a .part name and renamed only when complete, so a render or
  // check that reads assets/merc/ mid-pass never sees a half-written file.
  if (!existsSync(`${base}-merc.part.webm`)) throw new Error('no output for ' + shot.id)
  renameSync(`${base}-merc.part.webm`, `${base}-merc.webm`)
}
await browser.close()
