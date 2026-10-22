// ============================================================
// Explorer figures — the drawings on a lesson card
// ============================================================
//
// The figure beside a card (a lesson's poster, the metronome, the Chladni
// plate) and the string under its title. The metronome and the plate come
// from the stats site. The metronome is instrument-figures.js's, recoloured
// with the page tokens (its arm swings in CSS). The plate is
// chladni-plate.js's: grains slide towards the nodal lines of
//   u = cos(n pi x) cos(m pi y) + sign cos(m pi x) cos(n pi y),
// shaken in proportion to |u|, so sand gathers where the plate stays still.

import { mulberry32, TAU } from './dom'
import type { Surface } from './frame-loop'
import { surface } from './frame-loop'
import { Motion, reducedMotion } from './motion-switch'
import { COLOR } from './notes'
import type { Lesson } from './season'

/**
 * The metronome as SVG markup. Its body's gradient takes `id`, so a page
 * that shows several (Lesson 8's stage, hero, guide and free play, beside
 * the explorer card's) gives each copy its own; the card's keeps "mt-body".
 */
export function metronomeSVG(id = 'mt-body'): string {
  return `<svg class="metro" viewBox="0 0 170 220" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" x2="1"><stop offset="0" stop-color="#1b2430"/><stop offset=".45" stop-color="#5b6b7b"/><stop offset=".55" stop-color="#43505f"/><stop offset="1" stop-color="#151c26"/></linearGradient></defs>
  <path d="M30 212 L140 212 L112 22 Q85 10 58 22 Z" fill="url(#${id})" stroke="rgba(195,204,214,.35)"/>
  <path d="M52 186 L118 186 L101 44 Q85 36 69 44 Z" fill="#0a0d12" stroke="rgba(195,204,214,.18)"/>
  ${Array.from({ length: 9 }, (_, i) => `<line x1="${78 - i * 0.9}" x2="${92 + i * 0.9}" y1="${60 + i * 14}" y2="${60 + i * 14}" stroke="rgba(195,204,214,.25)"/>`).join('')}
  <g class="arm"><line x1="85" y1="186" x2="85" y2="34" stroke="#f4f8fd" stroke-width="3" stroke-linecap="round"/><path d="M77 70 h16 l-3 14 h-10 z" fill="#58a6ff" stroke="#a8cfff"/></g>
  <circle cx="85" cy="186" r="5" fill="#c3ccd6"/><rect x="24" y="210" width="122" height="7" rx="3" fill="#0a0d12" stroke="rgba(195,204,214,.25)"/></svg>`
}

/** A plate mode: n and m half-waves across, mixed with `sign`. */
export interface PlateMode {
  readonly n: number
  readonly m: number
  readonly sign: 1 | -1
}

/** The plate's displacement u at a point, and its gradient. */
export interface FieldSample {
  u: number
  gx: number
  gy: number
}

/** Writes u and its gradient at (x, y), both 0..1, into `out` (no allocation per grain). */
export function field(
  mode: PlateMode,
  x: number,
  y: number,
  out: FieldSample,
): FieldSample {
  const px = Math.PI * x
  const py = Math.PI * y
  const { n, m, sign } = mode
  const cnx = Math.cos(n * px)
  const cmx = Math.cos(m * px)
  const cny = Math.cos(n * py)
  const cmy = Math.cos(m * py)
  const snx = Math.sin(n * px)
  const smx = Math.sin(m * px)
  const sny = Math.sin(n * py)
  const smy = Math.sin(m * py)
  out.u = cnx * cmy + sign * cmx * cny
  out.gx = -Math.PI * (n * snx * cmy + sign * m * smx * cny)
  out.gy = -Math.PI * (m * cnx * smy + sign * n * cmx * sny)
  return out
}

/** The plate's edges reflect a grain back in: -0.1 lands at 0.1, 1.1 at 0.9. */
function reflect(v: number): number {
  return v < 0 ? -v : v > 1 ? 2 - v : v
}

/** Sand on the plate: positions 0..1 and a fade-in alpha per grain. */
export class Grains {
  readonly capacity: number
  readonly x: Float32Array
  readonly y: Float32Array
  readonly alpha: Float32Array
  /** How many grains move (the first `count`). */
  count: number
  mode: PlateMode
  private readonly random: () => number
  private readonly sample: FieldSample = { u: 0, gx: 0, gy: 0 }

  constructor(capacity: number, mode: PlateMode, random: () => number) {
    this.capacity = capacity
    this.random = random
    this.x = new Float32Array(capacity)
    this.y = new Float32Array(capacity)
    this.alpha = new Float32Array(capacity)
    this.count = capacity
    this.mode = mode
    for (let i = 0; i < capacity; i++) {
      this.x[i] = random()
      this.y[i] = random()
    }
  }

  retune(mode: PlateMode, count: number): void {
    this.mode = mode
    this.count = Math.min(count, this.capacity)
  }

  /** One shake of `dt` seconds: each grain slides down |u| and jitters in proportion to it. */
  step(dt: number): void {
    if (!(dt > 0)) return
    const n = Math.min(dt * 60, 3)
    const s = 0.085 * n
    const e = 0.5 * Math.sqrt(n)
    const jmax = 0.03
    const r = 0.012 * n
    const rnd = this.random
    for (let i = 0; i < this.count; i++) {
      const h = field(this.mode, this.x[i], this.y[i], this.sample)
      const M = h.gx * h.gx + h.gy * h.gy + 0.6
      let vx = (-s * h.u * h.gx) / M
      let vy = (-s * h.u * h.gy) / M
      const v = Math.hypot(vx, vy)
      if (v > r) {
        vx *= r / v
        vy *= r / v
      }
      const jit = Math.min(jmax, (e * Math.abs(h.u)) / Math.sqrt(M))
      const X = this.x[i] + vx + (rnd() - 0.5) * jit
      const Y = this.y[i] + vy + (rnd() - 0.5) * jit
      this.x[i] = reflect(X)
      this.y[i] = reflect(Y)
      if (this.alpha[i] < 1) {
        this.alpha[i] = Math.min(1, this.alpha[i] + 1.6 * dt)
      }
    }
  }

  /** Runs `seconds` of shaking at 60 steps a second and shows every grain. */
  settle(seconds: number): void {
    for (let k = Math.ceil(seconds * 60); k > 0; k--) this.step(1 / 60)
    for (let i = 0; i < this.capacity; i++) this.alpha[i] = 1
  }
}

const PLATE: PlateMode = { n: 3, m: 5, sign: -1 }

/** Lesson 13's plate in its canvas, shaken on every frame it is drawn. */
export interface PlateFigure {
  draw(dt: number): void
}

/** The card's plate, already settled into its pattern; null without a 2D canvas. */
export function plateFigure(canvas: HTMLCanvasElement): PlateFigure | null {
  let sf: Surface
  try {
    sf = surface(canvas)
  } catch {
    return null
  }
  const grains = new Grains(1500, PLATE, mulberry32(7))
  grains.retune(PLATE, 1500)
  grains.settle(Motion.paused ? 3 : 0.4)
  return {
    draw(dt) {
      const { ctx, w, h } = sf.fit()
      if (!Motion.paused) grains.step(dt)
      ctx.fillStyle = COLOR.blue
      for (let i = 0; i < grains.capacity; i++) {
        const a = grains.alpha[i]
        if (a <= 0) continue
        ctx.globalAlpha = Math.min(1, a) * 0.9
        ctx.fillRect(
          Math.round(grains.x[i] * w - 1),
          Math.round(grains.y[i] * h - 1),
          2,
          2,
        )
      }
      ctx.globalAlpha = 1
    },
  }
}

/**
 * The figure beside a lesson's card, or null for none: a poster figure
 * needs the poster's URL from the page, set as a property, never markup.
 */
export function cardFigure(
  L: Lesson,
  poster: string | undefined,
): HTMLElement | null {
  const fig = L.fig
  if (fig === undefined || (fig === 'poster' && poster === undefined))
    return null
  const f = document.createElement('figure')
  f.className = 'ex-fig'
  f.style.margin = '0'
  if (fig === 'poster') {
    const img = document.createElement('img')
    img.src = poster ?? ''
    img.alt = L.posterAlt ?? ''
    img.setAttribute('loading', 'lazy')
    const cap = document.createElement('figcaption')
    cap.textContent = 'From the episode: the title card'
    f.append(img, cap)
  } else if (fig === 'metronome') {
    f.innerHTML = `${metronomeSVG()}<figcaption>A metronome, its arm on beats 2 and 4</figcaption>`
  } else {
    f.innerHTML =
      '<div class="plate"><canvas aria-hidden="true"></canvas></div><figcaption>A vibrating plate: sand gathers where the plate stays still</figcaption>'
  }
  return f
}

/** Plucks the string under a card's title once (its first two modes, dying away over 1.5 s). */
export function pluckString(card: HTMLElement): void {
  const path = card.querySelector('.string path')
  if (path === null || reducedMotion()) return
  const t0 = performance.now()
  const frame = (now: number): void => {
    const t = (now - t0) / 1000
    if (t >= 1.5) {
      path.setAttribute('d', 'M0 12 L1000 12')
      return
    }
    const env = Math.exp(-t * 3.2)
    const a = Math.cos(t * TAU * 7.5)
    const b = Math.cos(t * TAU * 15 + 0.6) * 0.35
    let d = 'M0 12'
    for (let i = 1; i <= 48; i++) {
      const l = i / 48
      const y =
        12 + 9 * env * (Math.sin(Math.PI * l) * a + Math.sin(TAU * l) * b)
      d += ` L${(l * 1000).toFixed(1)} ${y.toFixed(2)}`
    }
    path.setAttribute('d', d)
    requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)
}
