// Render one Merc performance to two videos the composition layers exactly.
//
//   node tools/merc-pass.mjs merc/shots/<id>.json [--draft]
//   node tools/merc-pass.mjs merc/shots/<id>.json --stills=1.2,3.4
//        (lab: PNGs of those shot times over the room's obsidian, in
//        lab/merc/<id>-<t>.png; no video is written)
//   node tools/merc-pass.mjs merc/shots/<id>.json --tall [--until=<frame>]
//        a drop seen whole: the same camera on a canvas TALL_PAD drawn px
//        taller above and below, its field of view widened to match, so its
//        middle square is the pass's own picture, pixel for pixel
//        (<id>-tall-merc.webm, frames 0 to <frame> - 1)
//   node tools/merc-pass.mjs merc/shots/<id>.json --chunk=<chunk id>
//        one chunk of a long performance (the shot's `chunks`: id, from, to,
//        size): pass frames from..to at the chunk's size, as
//        assets/merc/<chunk id>-merc.webm
//   node tools/merc-pass.mjs merc/shots/<id>.json --from=<frame> --to=<frame>
//        any range of pass frames (both included), as <id>-<from>-<to>-merc.webm
//   --dump=<frame>,...   also writes those pass frames' straight-alpha RGBA,
//        upright, to lab/merc/dump/<out>-f<frame>.rgba and .png (the join proof)
//   --no-video           renders and dumps, encodes nothing
//
// Chunks join exactly (Lesson 5, DECISIONS 129). A frame is a pure function of
// the simulation's step count and the state changes before it: the sim steps
// at a fixed 1/240 s (renderAt steps to the frame's step and draws), the pose
// bias and the arcs switch are read only when a frame is drawn, and nothing in
// the renderer carries one drawn frame into the next. So a range that starts
// at frame F first replays every state change before F's time with drawing
// switched off (__mercNoDraw: the WebGL draw calls return at once), then
// renders F onward exactly as one straight run from frame 0 would.
//
// Every output also gets a sidecar, <out>-merc.json: the pass and chunk, the
// frames, fps, size and drawn square, the render's time a frame, the pinned
// browser, Playwright and bundle, and `root`, Merc's root [x, y] in world
// units on each frame (the renderer's uRoot), so a scene that carries him
// across the floor can cancel the renderer's own root motion (a hop moves it).
//
// Pinned (DECISIONS 128): the bundle must match assets/merc-lib/BUILD.json
// (built at b5ddaf2d7), Playwright must be 1.63.0 and Chromium build 1243, or
// the pass refuses to start. MERC_UNPINNED=1 overrides it, for a lab only.
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
//   "sparkles": "around",
//   "light": { "stops": [0, 0, 0] }   optional: light slots over the variant's own (setLook)
// }
// Every value is a function of the shot's own time: the same file renders the
// same frames every time.
//
// Reads the shot file, the envelopes it names and assets/merc-lib/merc-<variant>.js (built by
// tools/build-merc.mjs: window.MercLib with mount, VIEWS and WARM, and the __mercSparkles and
// __mercArcs switches). Writes assets/merc/<id>-merc.webm (or -tall-merc.webm), under a .part name
// until complete; with --stills, lab/merc/<id>-<t>.png.
// Environment: MERCURYPITCH_REPO, PLAYWRIGHT_MODULE, CHROMIUM_PATH (defaults below: this container's
// Playwright and Chromium first, then the checkout's).

import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync, mkdirSync, existsSync, renameSync, realpathSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// Playwright, and the Chromium it drives: this container's (/opt), else the MercuryPitch checkout's.
// MERCURYPITCH_REPO, PLAYWRIGHT_MODULE and CHROMIUM_PATH override them.
const REPO = process.env.MERCURYPITCH_REPO ?? '/home/user/mercurypitch'
const firstOf = (...paths) => paths.find((p) => existsSync(p)) ?? paths[paths.length - 1]
const PW_MODULE =
  process.env.PLAYWRIGHT_MODULE ??
  firstOf('/opt/node-tools/node_modules/playwright/index.mjs', `${REPO}/node_modules/.pnpm/playwright@1.60.0/node_modules/playwright/index.mjs`)
const { chromium } = await import(PW_MODULE)
const CHROME = process.env.CHROMIUM_PATH ?? firstOf('/opt/pw-browsers/chromium', '/opt/pw-browsers/chromium-1194/chrome-linux/chrome')

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..')
const args = process.argv.slice(2)
const draft = args.includes('--draft')
const stillsArg = args.find((a) => a.startsWith('--stills='))
const stills = stillsArg ? stillsArg.slice('--stills='.length).split(',').map(Number).sort((a, b) => a - b) : null
const tall = args.includes('--tall')
const untilArg = args.find((a) => a.startsWith('--until='))
const until = untilArg ? Number(untilArg.slice('--until='.length)) : Infinity
const opt = (name) => {
  const a = args.find((x) => x.startsWith(`--${name}=`))
  return a === undefined ? undefined : a.slice(name.length + 3)
}
const chunkArg = opt('chunk')
const fromArg = opt('from')
const toArg = opt('to')
const dumps = new Set((opt('dump') ?? '').split(',').filter(Boolean).map(Number))
const noVideo = args.includes('--no-video')
// A tall render's padding in drawn px above and below the pass's square: a multiple of 8, so its
// quarter- and eighth-size glow buffers keep their grid. At a 225 px square it holds a drop's whole
// fall from the renderer's DROP_Y0 (1.75 units) above the view's top edge, with the fall's trails:
// the body's top climbs to 159 px above the square in the fall's first frames and the trails reach
// 26 px above that, so 0.71 (160 px) cut them for 14 frames; 0.91 (208 px) leaves about 20 to spare.
const TALL_PAD_SHARE = 0.91
const files = args.filter((a) => !a.startsWith('--'))
if (!files.length) {
  console.error('usage: node tools/merc-pass.mjs <shot.json>... [--draft]')
  process.exit(1)
}

// The pin (DECISIONS 128): this film's every pass renders on the same browser, driver and bundle.
const PIN = { commit: 'b5ddaf2d7', playwright: '1.63.0', chromium: 'chromium-1243' }
const BUILD = JSON.parse(readFileSync(join(ROOT, 'assets/merc-lib/BUILD.json'), 'utf8'))
const pwVersion = JSON.parse(readFileSync(join(dirname(PW_MODULE), 'package.json'), 'utf8')).version
const chromeReal = realpathSync(CHROME)
const sha = (f) => createHash('sha256').update(readFileSync(f)).digest('hex')
function pinProblems(variant) {
  const out = []
  const name = `merc-${variant}.js`
  const got = sha(join(ROOT, 'assets/merc-lib', name))
  if (BUILD.commit !== PIN.commit) out.push(`BUILD.json says commit ${BUILD.commit}, the pin is ${PIN.commit}`)
  if (BUILD.bundles?.[name]?.sha256 !== got) out.push(`${name} is ${got.slice(0, 12)}, BUILD.json says ${String(BUILD.bundles?.[name]?.sha256).slice(0, 12)}`)
  if (pwVersion !== PIN.playwright) out.push(`Playwright ${pwVersion}, the pin is ${PIN.playwright}`)
  if (!chromeReal.includes(`/${PIN.chromium}/`)) out.push(`Chromium ${chromeReal}, the pin is ${PIN.chromium}`)
  return out
}

const browser = await chromium.launch({
  executablePath: CHROME,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
})
const browserVersion = browser.version()

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
  const pinned = pinProblems(shot.variant)
  if (pinned.length && process.env.MERC_UNPINNED !== '1') {
    throw new Error(`${shot.id}: not the pinned renderer (DECISIONS 128):\n  ${pinned.join('\n  ')}\nMERC_UNPINNED=1 renders anyway, for a lab only`)
  }
  const quality = draft ? 'low' : (shot.quality ?? 'medium')
  const fps = shot.fps ?? 30
  const N = Math.round(shot.duration * fps)
  // the frames to render: a chunk, a range, or the whole pass (to --until)
  let chunk = null
  if (chunkArg) {
    chunk = (shot.chunks ?? []).find((c) => c.id === chunkArg)
    if (!chunk) throw new Error(`${shot.id} has no chunk ${chunkArg}`)
  }
  const from = chunk ? chunk.from : fromArg !== undefined ? Number(fromArg) : 0
  const to = chunk ? chunk.to : toArg !== undefined ? Number(toArg) : Math.min(N, until) - 1
  if (!(from >= 0 && to >= from && to <= N - 1)) throw new Error(`${shot.id}: frames ${from} to ${to} are not inside 0 to ${N - 1}`)
  const n = to - from + 1
  const size = chunk?.size ?? shot.size
  const outId = chunk ? chunk.id : from > 0 || (to < N - 1 && until === Infinity) ? `${shot.id}-${from}-${to}` : shot.id
  const outDir = join(ROOT, 'assets/merc')
  mkdirSync(outDir, { recursive: true })
  const base = join(outDir, outId + (tall ? '-tall' : '') + (draft ? '-draft' : ''))
  // The drawn square (quality's scale times size) and, for a tall render, the canvas whose middle
  // square it is: the same camera, its field of view widened so a drawn pixel covers the same ray.
  const scaleQ = { low: 0.5, medium: 0.75, high: 1, ultra: 1 }[quality] ?? 0.75
  const drawn = Math.round(size * scaleQ)
  const padY = tall ? 8 * Math.round((TALL_PAD_SHARE * drawn) / 8) : 0
  const drawnH = drawn + 2 * padY
  // The container's CSS size: the renderer draws round(css * scale) px (pixelRatio 1). A pass that
  // is not tall keeps the fixed-size square it always had.
  let cssH = Math.ceil(drawnH / scaleQ)
  while (Math.round(cssH * scaleQ) > drawnH) cssH--
  while (Math.round(cssH * scaleQ) < drawnH) cssH++

  const page = await browser.newPage({ viewport: { width: size + 20, height: (tall ? cssH : size) + 20 } })
  page.on('pageerror', (e) => console.error('pageerror', e.message))
  await page.setContent('<!doctype html><html><body style="margin:0;background:transparent"><div id="a"></div></body></html>')
  // Before the bundle: drawing that can be switched off (the pre-roll), and the root uniform read
  // back on every draw. The renderer is unchanged: only these WebGL2 calls are wrapped.
  await page.evaluate(() => {
    const G = WebGL2RenderingContext.prototype
    for (const name of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced', 'clear', 'blitFramebuffer', 'finish']) {
      const f = G[name]
      G[name] = function (...a) {
        if (window.__mercNoDraw) return
        return f.apply(this, a)
      }
    }
    const names = new WeakMap()
    const gul = G.getUniformLocation
    G.getUniformLocation = function (prog, name) {
      const loc = gul.call(this, prog, name)
      if (loc) names.set(loc, name)
      return loc
    }
    const u3 = G.uniform3fv
    G.uniform3fv = function (loc, v, ...rest) {
      if (loc && names.get(loc) === 'uRoot') window.__mercRoot = [v[0], v[1], v[2]]
      return u3.call(this, loc, v, ...rest)
    }
  })
  await page.addScriptTag({ path: join(ROOT, `assets/merc-lib/merc-${shot.variant}.js`) })
  const [w, h] = await page.evaluate(
    ({ shot, size, quality, cssH, widen }) => {
      const el = document.getElementById('a')
      el.style.width = size + 'px'
      el.style.height = (widen === 1 ? size : cssH) + 'px'
      const L = window.MercLib
      // the field of view is vertical: a canvas `widen` times taller sees `widen` times the tangent
      const view0 = L.VIEWS[shot.view ?? 'hero']
      const fov = (2 * Math.atan(widen * Math.tan((view0.fov * Math.PI) / 360)) * 180) / Math.PI
      const cues = [...(shot.cues ?? [{ t: 0, state: 'idle' }])].sort((a, b) => a.t - b.t)
      const m = L.mount(el, {
        capture: true,
        continuous: true,
        transparent: true,
        // a tall canvas follows its container (W x H); every other pass is the fixed square
        size: widen === 1 ? size : 0,
        pixelRatio: 1,
        quality,
        state: cues[0].state,
        view: widen === 1 ? (shot.view ?? 'hero') : { ...view0, fov },
        sparkles: shot.sparkles === 'none' ? 'around' : (shot.sparkles ?? 'around'),
        rings: shot.rings ?? true,
        // Lesson 2: `ride`'s mouth ('open' is the "ooh"); a shot without it keeps the renderer's default
        ...(shot.glideMouth ? { glideMouth: shot.glideMouth } : {}),
      })
      if (shot.variant === 'orange') m.setLook(L.WARM)
      if (shot.look) m.setLook(shot.look)
      // `light`: slots of the light set Merc casts, over the variant's own (LIGHT_SLOTS in
      // src/lib/merc/constants.ts), through the renderer's setLook; Lesson 5's m-blue sets `stops` to
      // 0, so a hop draws no floor stop marks (the slot lights nothing else; DECISIONS 162)
      if (shot.light) m.setLook({ light: { ...(shot.variant === 'orange' ? L.WARM_LIGHT : L.LIGHT), ...shot.light } })
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
      const changes = (T) => {
        while (cueIdx + 1 < cues.length && cues[cueIdx + 1].t <= T + 1e-9) {
          const next = cues[cueIdx + 1]
          m.renderAt(next.t - cueT)
          m.setState(next.state)
          cueT = next.t
          cueIdx++
        }
      }
      // A range's pre-roll: every state change up to shot time T, nothing drawn. The frame at T is
      // then drawn by __frame as a straight run draws it (see the header).
      window.__preroll = (T) => {
        window.__mercNoDraw = true
        try {
          changes(T)
        } finally {
          window.__mercNoDraw = false
        }
      }
      window.__frame = (T) => {
        changes(T)
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
        return [btoa(s), window.__mercRoot]
      }
      return [W, H]
    },
    { shot, size, quality, cssH, widen: drawnH / drawn },
  )
  if (w !== drawn || h !== drawnH) throw new Error(`${shot.id}: drew ${w}x${h}, expected ${drawn}x${drawnH}`)
  // the pass's own square inside the canvas (all of it, for a pass that is not tall)
  const pad = padY

  if (stills) {
    // Lab stills: straight-alpha frames composited over #0d1117, flipped upright.
    const labDir = join(ROOT, 'lab/merc')
    mkdirSync(labDir, { recursive: true })
    for (const T of stills) {
      await page.evaluate((T) => window.__preroll(T), T * k)
      const buf = Buffer.from((await page.evaluate((T) => window.__frame(T), T * k))[0], 'base64')
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
  const ff = noVideo ? null : spawn(
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
    for (let y = pad + Math.floor(drawn * 0.6); y < pad + drawn; y++) {
      for (let x = 0, o = (y * w) * 4; x < w; x++, o += 4) {
        if (buf[o + 3] > 200 && buf[o] < 25 && buf[o + 1] < 25 && buf[o + 2] < 25) bad++
      }
    }
    return bad > 40
  }
  const NUDGES = [1, -1, 2, -2, 3, -3].map((s) => s / 240)
  // A drop's fall carries the eyes down through the top 40 %, so every drop tripped the guard on its
  // frames 23 to 31 and no nudge within 12 ms cleared them: six wasted renders a frame, and a nudged
  // time where the eyes happened to cross the line. The guard skips the fall, the renderer's DROP_T
  // (0.55 s of simulation time) from each drop cue (src/lib/merc/sim-choreo.ts).
  const falls = (shot.cues ?? []).filter((c) => c.state === 'drop').map((c) => c.t)
  const falling = (T) => falls.some((t0) => T >= t0 && T < t0 + 0.55)
  const dumpDir = join(ROOT, 'lab/merc/dump')
  if (dumps.size) mkdirSync(dumpDir, { recursive: true })
  const dump = async (i, buf) => {
    // upright straight-alpha RGBA, raw (for a byte compare) and as a PNG (to look at)
    const up = Buffer.alloc(buf.length)
    const row = w * 4
    for (let y = 0; y < h; y++) buf.copy(up, y * row, (h - 1 - y) * row, (h - y) * row)
    const stem = join(dumpDir, `${outId}-f${i}`)
    writeFileSync(`${stem}.rgba`, up)
    await new Promise((res, rej) => {
      const p = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${w}x${h}`, '-i', '-', `${stem}.png`], { stdio: ['pipe', 'inherit', 'inherit'] })
      p.on('close', (c) => (c ? rej(new Error('ffmpeg ' + c)) : res()))
      p.stdin.end(up)
    })
  }
  const p0 = Date.now()
  if (from > 0) await page.evaluate((T) => window.__preroll(T), (from / fps) * k)
  const prerollMs = Date.now() - p0
  const t0 = Date.now()
  let fixed = 0
  const roots = []
  for (let i = from; i <= to; i++) {
    const T = (i / fps) * k
    let [b64, root] = await page.evaluate((T) => window.__frame(T), T)
    let buf = Buffer.from(b64, 'base64')
    if (!falling(T) && crescent(buf)) {
      for (const d of NUDGES) {
        const [a64, aroot] = await page.evaluate((T) => window.__frame(T), T + d * k)
        const alt = Buffer.from(a64, 'base64')
        if (!crescent(alt)) { buf = alt; root = aroot; fixed++; break }
      }
      if (crescent(buf)) console.warn(`\n${outId}: frame ${i} still shows the crescent after nudging`)
    }
    roots.push(root ? [Math.round(root[0] * 1e4) / 1e4, Math.round(root[1] * 1e4) / 1e4] : null)
    if (dumps.has(i)) await dump(i, buf)
    if (ff && !ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r))
    if ((i - from) % 30 === 29) process.stdout.write(`\r${outId} ${i - from + 1}/${n}`)
  }
  if (fixed) console.log(`\n${outId}: ${fixed} frames re-rendered at a nudged time (crescent guard)`)
  const msFrame = (Date.now() - t0) / n
  if (ff) {
    ff.stdin.end()
    await new Promise((r) => ff.on('close', r))
  }
  console.log(`\r${outId}: frames ${from} to ${to} (${n}), ${w}x${h}, ${msFrame.toFixed(0)} ms/frame, pre-roll ${(prerollMs / 1000).toFixed(1)} s`)
  await page.close()
  if (!ff) continue
  // Written under a .part name and renamed only when complete, so a render or
  // check that reads assets/merc/ mid-pass never sees a half-written file.
  if (!existsSync(`${base}-merc.part.webm`)) throw new Error('no output for ' + outId)
  const bundle = `merc-${shot.variant}.js`
  const side = {
    pass: shot.id,
    chunk: chunk ? chunk.id : null,
    scene: chunk?.scene ?? null,
    from,
    to,
    frames: n,
    fps,
    filmStart: shot.filmStart ?? null,
    size,
    drawn: [w, h],
    quality,
    msPerFrame: Math.round(msFrame),
    renderSeconds: Math.round((Date.now() - p0) / 1000),
    prerollSeconds: Math.round(prerollMs / 100) / 10,
    crescentFixed: fixed,
    pin: {
      chromium: browserVersion,
      chromiumPath: chromeReal,
      playwright: pwVersion,
      bundle,
      sha256: sha(join(ROOT, 'assets/merc-lib', bundle)),
      built: BUILD.commit,
      unpinned: pinned.length ? pinned : undefined,
    },
    rootNote: "Merc's root [x, y] in world units on each frame from `from`: the renderer's uRoot",
    root: roots,
  }
  writeFileSync(`${base}-merc.json`, JSON.stringify(side) + '\n')
  renameSync(`${base}-merc.part.webm`, `${base}-merc.webm`)
}
await browser.close()
