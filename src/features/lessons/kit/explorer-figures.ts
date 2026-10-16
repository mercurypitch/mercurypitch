// ============================================================
// Explorer figures — the metronome and the Chladni plate's grains
// ============================================================
//
// Two of the season's motifs, drawn small for the lesson cards, both from
// the stats site. The metronome is instrument-figures.js's, recoloured with
// the page tokens (its arm swings in CSS). The plate is chladni-plate.js's:
// grains slide towards the nodal lines of
//   u = cos(n pi x) cos(m pi y) + sign cos(m pi x) cos(n pi y),
// shaken in proportion to |u|, so sand gathers where the plate stays still.

/** The metronome as SVG markup; one per page at a time (its gradient has a fixed id). */
export function metronomeSVG(): string {
  return `<svg class="metro" viewBox="0 0 170 220" aria-hidden="true"><defs><linearGradient id="mt-body" x1="0" x2="1"><stop offset="0" stop-color="#1b2430"/><stop offset=".45" stop-color="#5b6b7b"/><stop offset=".55" stop-color="#43505f"/><stop offset="1" stop-color="#151c26"/></linearGradient></defs>
  <path d="M30 212 L140 212 L112 22 Q85 10 58 22 Z" fill="url(#mt-body)" stroke="rgba(195,204,214,.35)"/>
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

/** The plate's displacement u at a point and its gradient. */
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
      let X = this.x[i] + vx + (rnd() - 0.5) * jit
      let Y = this.y[i] + vy + (rnd() - 0.5) * jit
      // the plate's edges reflect a grain back in
      X = X < 0 ? -X : X > 1 ? 2 - X : X
      Y = Y < 0 ? -Y : Y > 1 ? 2 - Y : Y
      this.x[i] = X
      this.y[i] = Y
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
