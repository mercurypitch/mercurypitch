/* ==========================================================================================
   CHLADNI PLATE, de-minified from the stats picker (dev.stats.maff.app, /_astro/index.astro_astro_
   type_script_index_0_lang.z3pGBJ-u.js; source names in that bundle: X = field, At = grain field,
   Lt = renderer, ft = modeFor, mt = openingMode, qt = burst, Et = tones). Behaviour is unchanged;
   the only additions are a seeded RNG and frame-addressed seeking, so the plate can live on a
   HyperFrames/GSAP timeline that must render the same pixels for the same frame every time.

   Physics in one line: the plate's displacement is
       u(x, y) = cos(n pi x) cos(m pi y) + sign * cos(m pi x) cos(n pi y)        (x, y in 0..1)
   Each grain slides down the gradient of u^2 / 2 (towards the nodal lines where u = 0) and is
   shaken by noise proportional to |u|, so grains on antinodes keep dancing and grains on nodes
   rest. That is exactly the Chladni story: sand gathers where the plate stays still.
   Teaching caveat: cos-cos superpositions are the membrane (Laplacian, free-edge) eigenmodes. A
   real metal plate obeys the biharmonic equation; the figures look right, but if a video quotes
   frequency ratios it should say "approximately" or use Chladni's law f ~ (m + 2n)^2.
   ========================================================================================== */

/* ---------------------------------------------------------------- the field */
export function field(mode, x, y, out = { u: 0, gx: 0, gy: 0 }) {
  const px = Math.PI * x,
    py = Math.PI * y,
    { n, m, sign } = mode
  const cnx = Math.cos(n * px),
    cmx = Math.cos(m * px),
    cny = Math.cos(n * py),
    cmy = Math.cos(m * py)
  const snx = Math.sin(n * px),
    smx = Math.sin(m * px),
    sny = Math.sin(n * py),
    smy = Math.sin(m * py)
  out.u = cnx * cmy + sign * cmx * cny
  out.gx = -Math.PI * (n * snx * cmy + sign * m * smx * cny)
  out.gy = -Math.PI * (m * cnx * smy + sign * n * cmx * sny)
  return out
}

/* ---------------------------------------------------------------- choosing a mode */
// The picker's rule: grain count picks a complexity band, the key's pitch class picks a pair in
// it, and minor keys add the two terms (sign +1) while major keys subtract them (sign -1).
export const MODE_BANDS = [
  {
    upTo: 900,
    pairs: [
      [3, 5],
      [2, 5],
    ],
  },
  {
    upTo: 2600,
    pairs: [
      [3, 7],
      [4, 7],
    ],
  },
  {
    upTo: Infinity,
    pairs: [
      [4, 9],
      [5, 8],
      [3, 8],
    ],
  },
]
export function modeFor(pitchClass, minor, grains) {
  const band =
    MODE_BANDS.find((b) => grains <= b.upTo) ||
    MODE_BANDS[MODE_BANDS.length - 1]
  const [n, m] = band.pairs[pitchClass % band.pairs.length]
  return { n, m, sign: minor ? 1 : -1 }
}
// clicking a project drives the plate one mode up while the grains explode outwards
export const openingMode = (mode, by = 1) => ({
  n: mode.n + by,
  m: mode.m + 2 * by,
  sign: mode.sign,
})
// For lessons: a ladder of modes to climb as pitch rises ("higher note, busier figure").
export const LADDER = [
  [1, 2],
  [2, 3],
  [1, 4],
  [3, 4],
  [2, 5],
  [3, 5],
  [4, 5],
  [3, 7],
  [4, 7],
  [5, 8],
  [4, 9],
]

/* ---------------------------------------------------------------- seeded randomness */
export function mulberry32(seed) {
  // same generator as the report's sound.js rng()
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), a | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/* ---------------------------------------------------------------- the grains */
const STEP = 0.085,
  MAX_MOVE = 0.012,
  JITTER = 0.5,
  JITTER_MAX = 0.03,
  REG = 0.6,
  FADE_IN = 1.6,
  FADE_OUT = 1.9
const smoothstep = (t) => {
  t = Math.min(1, Math.max(0, t))
  return t * t * (3 - 2 * t)
}

export class Grains {
  constructor(capacity, mode, random = mulberry32(7)) {
    this.capacity = capacity
    this.random = random
    this.x = new Float32Array(capacity)
    this.y = new Float32Array(capacity)
    this.alpha = new Float32Array(capacity)
    this.tone = new Uint8Array(capacity)
    this.count = 0
    this.drive = 1
    this.from = mode
    this.to = mode
    this.progress = 1
    this.blendSeconds = 0.9
    this._a = { u: 0, gx: 0, gy: 0 }
    this._b = { u: 0, gx: 0, gy: 0 }
    for (let i = 0; i < capacity; i++) this.scatter(i)
  }
  scatter(i) {
    this.x[i] = this.random()
    this.y[i] = this.random()
    this.alpha[i] = 0
  }
  // change the plate's mode (blends over `seconds` with a smoothstep), grain count and tones
  retune(mode, count, tones = [], seconds = 0.9) {
    this.from =
      this.progress >= 1 ? this.to : this.progress < 0.5 ? this.from : this.to
    this.to = mode
    this.progress = seconds > 0 ? 0 : 1
    this.blendSeconds = Math.max(seconds, 0.001)
    const c = Math.min(count, this.capacity)
    for (let i = this.count; i < c; i++)
      if (this.alpha[i] <= 0.01) this.scatter(i)
    for (let i = 0; i < c; i++) this.tone[i] = tones[i] || 0
    this.count = c
  }
  field(x, y) {
    const b = field(this.to, x, y, this._b)
    if (this.progress >= 1) return b
    const a = field(this.from, x, y, this._a),
      k = smoothstep(this.progress)
    a.u += (b.u - a.u) * k
    a.gx += (b.gx - a.gx) * k
    a.gy += (b.gy - a.gy) * k
    return a
  }
  step(dt) {
    if (!(dt > 0)) return
    const n = Math.min(dt * 60, 3)
    if (this.progress < 1)
      this.progress = Math.min(1, this.progress + dt / this.blendSeconds)
    const s = STEP * n,
      e = JITTER * this.drive * Math.sqrt(n),
      jmax = JITTER_MAX * this.drive,
      r = MAX_MOVE * n,
      rnd = this.random
    for (let i = 0; i < this.capacity; i++) {
      let a = this.alpha[i]
      if (i >= this.count) {
        // retired grains drift out from the centre and fade
        if (a <= 0) continue
        this.x[i] += (this.x[i] - 0.5) * 0.035 * n
        this.y[i] += (this.y[i] - 0.5) * 0.035 * n
        this.alpha[i] = Math.max(0, a - FADE_OUT * dt)
        continue
      }
      const h = this.field(this.x[i], this.y[i]),
        M = h.gx * h.gx + h.gy * h.gy + REG
      let vx = (-s * h.u * h.gx) / M,
        vy = (-s * h.u * h.gy) / M
      const v = Math.hypot(vx, vy)
      if (v > r) {
        vx *= r / v
        vy *= r / v
      }
      const jit = Math.min(jmax, (e * Math.abs(h.u)) / Math.sqrt(M))
      let X = this.x[i] + vx + (rnd() - 0.5) * jit,
        Y = this.y[i] + vy + (rnd() - 0.5) * jit
      X = X < 0 ? -X : X > 1 ? 2 - X : X
      Y = Y < 0 ? -Y : Y > 1 ? 2 - Y : Y // reflect at the rim
      this.x[i] = X
      this.y[i] = Y
      if (a < 1) this.alpha[i] = Math.min(1, a + FADE_IN * dt)
    }
  }
  settle(seconds) {
    for (let k = Math.ceil(seconds * 60); k > 0; k--) this.step(1 / 60)
    for (let i = 0; i < this.capacity; i++)
      this.alpha[i] = i < this.count ? 1 : 0
  }
  restlessness() {
    let t = 0
    for (let i = 0; i < this.count; i++)
      t += Math.abs(this.field(this.x[i], this.y[i]).u)
    return this.count ? t / this.count : 0
  }
}

/* ---------------------------------------------------------------- tones: newest grains brightest */
// Et() in the bundle: grains are dealt out across the weeks in proportion to each week's commits,
// and a grain's tone is its week's position in the history (0 oldest .. tones-1 newest).
export function tonesFromWeekly(weekly, count, tones = 8) {
  const out = new Uint8Array(count),
    n = weekly.length
  let total = 0
  for (const w of weekly) total += Math.max(0, w || 0)
  if (!count || !n || !total) return out.fill(tones - 1)
  let wk = 0,
    acc = Math.max(0, weekly[0] || 0)
  for (let i = 0; i < count; i++) {
    const at = ((i + 0.5) / count) * total
    while (at > acc && wk < n - 1) {
      wk++
      acc += Math.max(0, weekly[wk] || 0)
    }
    out[i] = n > 1 ? Math.round((wk / (n - 1)) * (tones - 1)) : tones - 1
  }
  return out
}

/* ---------------------------------------------------------------- the renderer */
const hexRgb = (h) => {
  const v = parseInt(h.replace('#', '').slice(0, 6), 16)
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255]
}
// eight tones from accent2 (oldest) to accent (newest); alpha .5 + .5 (i / 7)^1.2
export const toneRamp = (accent, accent2, n = 8) =>
  Array.from({ length: n }, (_, i) => {
    const t = i / (n - 1),
      a = hexRgb(accent),
      b = hexRgb(accent2)
    const c = [0, 1, 2].map((k) => Math.round(b[k] + (a[k] - b[k]) * t))
    return `rgba(${c[0]},${c[1]},${c[2]},${(0.5 + 0.5 * Math.pow(t, 1.2)).toFixed(3)})`
  })
// fixed sub-pixel offsets per grain (xorshift32 seeded 2654435769), so square grains never align to a grid
export function grit(n, amp) {
  const g = new Float32Array(n * 2)
  let s = 2654435769
  for (let i = 0; i < g.length; i++) {
    s = (s ^ (s << 13)) >>> 0
    s = (s ^ (s >>> 17)) >>> 0
    s = (s ^ (s << 5)) >>> 0
    g[i] = ((s / 4294967296) * 2 - 1) * amp
  }
  return g
}
// One frame. trail: the picker erases 36% of the last frame each frame (destination-out), which
// leaves short comet tails. Pass trail = 0 for a clean frame.
export function paintGrains(
  ctx,
  grains,
  { width, height, ratio = 1, styles, gritOffsets },
) {
  const sz = Math.max(2, Math.round(1.6 * ratio)),
    h = sz / 2,
    G = gritOffsets
  for (let i = 0; i < grains.capacity; i++) {
    const a = grains.alpha[i]
    if (a <= 0) continue
    ctx.globalAlpha = Math.min(1, a) * (ctx.__layerAlpha || 1)
    ctx.fillStyle = styles[grains.tone[i]] || styles[styles.length - 1]
    ctx.fillRect(
      Math.round(grains.x[i] * width - h + G[2 * i]),
      Math.round(grains.y[i] * height - h + G[2 * i + 1]),
      sz,
      sz,
    )
  }
  ctx.globalAlpha = 1
}
// The live picker's frame: fade the previous frame by `trail` (destination-out), then paint.
export function drawGrains(ctx, grains, opts) {
  const trail = opts.trail == null ? 0.36 : opts.trail
  ctx.globalCompositeOperation = 'destination-out'
  ctx.fillStyle = trail ? `rgba(0,0,0,${trail})` : 'rgba(0,0,0,1)'
  ctx.fillRect(0, 0, opts.width, opts.height)
  ctx.globalCompositeOperation = 'source-over'
  paintGrains(ctx, grains, opts)
}
// CSS that goes with it (picker.css): canvas { filter: drop-shadow(0 0 5px color-mix(in oklab, var(--accent) 55%, transparent)) }

/* ---------------------------------------------------------------- seekable plate for HyperFrames */
// A plate whose state is a pure function of the frame number. `script(frame)` returns the cue that
// applies at that frame ({ mode, count, tones, blend, drive }), e.g. from the voice-over timing.
// State is rebuilt by stepping 1/fps from the nearest cached checkpoint, never from wall time.
export class SeekablePlate {
  constructor({
    capacity = 6000,
    fps = 30,
    seed = 7,
    mode,
    script,
    checkpointEvery = 30,
  }) {
    Object.assign(this, { capacity, fps, seed, script, checkpointEvery })
    this.mode0 = mode
    this.cache = new Map()
    this.reset()
  }
  reset() {
    const r = mulberry32(this.seed),
      self = this
    this.rngCalls = 0
    this.g = new Grains(this.capacity, this.mode0, () => {
      self.rngCalls++
      return r()
    })
    this.rawRng = r
    this.frame = 0
    this.cue = null
  }
  applyCue(f) {
    const c = this.script(f)
    if (!c || c === this.cue) return
    this.cue = c
    if (c.mode)
      this.g.retune(
        c.mode,
        c.count != null ? c.count : this.g.count || this.capacity,
        c.tones || [],
        c.blend != null ? c.blend : 0.9,
      )
    if (c.drive != null) this.g.drive = c.drive
  }
  // seek forward only by stepping; seeking backwards restores the closest checkpoint first
  seek(frame) {
    if (frame < this.frame) {
      let best = -1
      for (const k of this.cache.keys()) if (k <= frame && k > best) best = k
      if (best < 0) this.reset()
      else this.restore(best)
    }
    while (this.frame < frame) {
      this.applyCue(this.frame)
      this.g.step(1 / this.fps)
      this.frame++
      if (
        this.frame % this.checkpointEvery === 0 &&
        !this.cache.has(this.frame)
      )
        this.cache.set(this.frame, this.save())
    }
    this.applyCue(frame)
    return this.g
  }
  save() {
    const g = this.g
    return {
      x: g.x.slice(),
      y: g.y.slice(),
      alpha: g.alpha.slice(),
      tone: g.tone.slice(),
      count: g.count,
      drive: g.drive,
      from: g.from,
      to: g.to,
      progress: g.progress,
      blendSeconds: g.blendSeconds,
      cue: this.cue,
      rng: this.cloneRng(),
    }
  }
  // mulberry32 keeps its state in a closure, so a checkpoint replays the generator to the same call count
  cloneRng() {
    return this.rngCalls
  }
  restore(f) {
    const s = this.cache.get(f)
    this.reset()
    const g = this.g
    g.x.set(s.x)
    g.y.set(s.y)
    g.alpha.set(s.alpha)
    g.tone.set(s.tone)
    Object.assign(g, {
      count: s.count,
      drive: s.drive,
      from: s.from,
      to: s.to,
      progress: s.progress,
      blendSeconds: s.blendSeconds,
    })
    for (let i = this.rngCalls; i < s.rng; i++) this.rawRng()
    this.rngCalls = s.rng
    this.cue = s.cue
    this.frame = f
  }
  // A frame with comet trails that does not depend on what was painted before: the last few states
  // are painted oldest first, each at (1 - .36)^age, which is what the live 36% fade converges to.
  draw(ctx, frame, opts, tail = 5) {
    ctx.clearRect(0, 0, opts.width, opts.height)
    for (let age = Math.min(tail, frame); age >= 0; age--) {
      const g = this.seek(frame - age)
      ctx.__layerAlpha = Math.pow(1 - 0.36, age)
      paintGrains(ctx, g, opts)
    }
    ctx.__layerAlpha = 1
    return this.seek(frame)
  }
}
// Cost: draw() seeks backwards for the tail, so keep checkpointEvery small (e.g. 10) when rendering
// with tails, or render frames in order (HyperFrames renders sequentially) and cache the last states.

/* ---------------------------------------------------------------- the burst (page transition) */
// qt() in the bundle, as a pure function of time: every lit grain flies out along its own ray,
// radius r(t) = r0 * exp(f t) with f = ln(diagonal / 2) / seconds, drawn as a short streak with
// 'lighter' blending, while the next page's background fades in with alpha .16 + .84 (t/T)^2.
export function drawBurst(
  ctx,
  rays,
  {
    t,
    seconds = 0.62,
    cx,
    cy,
    width,
    height,
    styles,
    background = [13, 17, 23],
    streak = 1 / 60,
  },
) {
  const diag = Math.hypot(width, height),
    f = Math.log(diag / 2) / seconds,
    u = Math.min(1, t / seconds)
  ctx.globalCompositeOperation = 'source-over'
  ctx.fillStyle = `rgba(${background[0]},${background[1]},${background[2]},${(0.16 + 0.84 * u * u).toFixed(3)})`
  ctx.fillRect(0, 0, width, height)
  ctx.globalCompositeOperation = 'lighter'
  ctx.lineWidth = 1.4
  ctx.lineCap = 'round'
  for (const ray of rays) {
    const r0 = ray.r * Math.exp(f * Math.max(0, t - streak)),
      r1 = ray.r * Math.exp(f * t)
    if (r0 > diag) continue
    ctx.strokeStyle = styles[ray.tone] || styles[styles.length - 1]
    ctx.beginPath()
    ctx.moveTo(cx + ray.dx * r0, cy + ray.dy * r0)
    ctx.lineTo(cx + ray.dx * r1, cy + ray.dy * r1)
    ctx.stroke()
  }
  ctx.globalCompositeOperation = 'source-over'
}
// rays from a plate: angle from the plate centre plus +/-0.04 rad of seeded wobble, r at least 2 px
export function raysFrom(grains, rect, random = mulberry32(11)) {
  const cx = rect.left + rect.width / 2,
    cy = rect.top + rect.height / 2,
    out = []
  for (let i = 0; i < grains.count; i++) {
    if (grains.alpha[i] < 0.5) continue
    const dx = rect.left + grains.x[i] * rect.width - cx,
      dy = rect.top + grains.y[i] * rect.height - cy,
      a = Math.atan2(dy, dx) + (random() - 0.5) * 0.08
    out.push({
      dx: Math.cos(a),
      dy: Math.sin(a),
      r: Math.max(2, Math.hypot(dx, dy)),
      tone: grains.tone[i],
    })
  }
  return out
}
