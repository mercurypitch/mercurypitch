// ============================================================
// CanvasGlassRenderer — the "lite" mirror backend (plan §5.3).
//
// Ported from the look-dev prototype's pane painter
// (docs/plans/prototypes/glass-shatter-prototype.html): the
// quicksilver pane with a chrome bevel, the live waveform ribbon
// dancing inside it, the gold target etch, resonance ripples, a
// perimeter charge meter, permanent cracks, and a drifting
// specular sheen. Serves every browser in P2 and stays as the
// non-WebGPU fallback once the TypeGPU backend lands (P3).
// ============================================================

import { CalCamera } from '../cal-camera'
import { CrackField } from '../crack-field'
import { drawGlassFrame } from '../frame'
import type { GlassRenderer, GlassSceneUpdate } from '../GlassRenderer'
import { ShardBurst } from '../shard-burst'

const VIEW_CENTS = 340 // half-range of the pane's vertical pitch view
// Calibration shows a whole glide, so it gets a wider, calmer view.
const CALIBRATE_VIEW_CENTS = 700
const RIBBON_LENGTH = 150
const DPR_CAP = 2

const IDLE_STATE: GlassSceneUpdate = {
  mode: 'idle',
  offCents: null,
  level: 0,
  resonance: 0,
  fatigue: 0,
  crackStep: 0,
  targetLabel: '',
}

export class CanvasGlassRenderer implements GlassRenderer {
  readonly backend = 'canvas2d' as const
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D | null
  private observer: ResizeObserver | null = null
  private rafId = 0
  private disposed = false
  private width = 0
  private height = 0
  private dpr = 1

  private state: GlassSceneUpdate = IDLE_STATE
  /** Ribbon trail — cents offsets (nulls are breaths) newest-last. */
  private ribbon: Array<{ off: number; level: number } | null> = []
  /** Dead-zone view camera for calibrate mode (holding a note never pans). */
  private calCamera = new CalCamera()
  private crackField = new CrackField()
  private burst: ShardBurst | null = null
  private reduceMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  constructor() {
    this.canvas = document.createElement('canvas')
    this.canvas.className = 'glass-scene-canvas'
    this.ctx = this.canvas.getContext('2d')
    const loop = (): void => {
      if (this.disposed) return
      this.rafId = requestAnimationFrame(loop)
      this.draw(performance.now() / 1000)
    }
    this.rafId = requestAnimationFrame(loop)
  }

  mount(host: HTMLElement): void {
    host.replaceChildren(this.canvas)
    this.observer?.disconnect()
    this.observer = new ResizeObserver(() => this.resize(host))
    this.observer.observe(host)
    this.resize(host)
  }

  private resize(host: HTMLElement): void {
    const rect = host.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return
    const dpr = Math.min(DPR_CAP, window.devicePixelRatio || 1)
    // Setting canvas.width clears the surface (a visible flash) — skip
    // observer callbacks that didn't actually change the backing size.
    if (
      rect.width === this.width &&
      rect.height === this.height &&
      dpr === this.dpr
    )
      return
    this.dpr = dpr
    this.width = rect.width
    this.height = rect.height
    this.canvas.width = Math.round(rect.width * this.dpr)
    this.canvas.height = Math.round(rect.height * this.dpr)
    this.ctx?.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
  }

  update(state: GlassSceneUpdate): void {
    this.state = state

    // Ribbon sample per update (~30 Hz from the app loop). A null is a
    // BREAK: breaths AND out-of-view pitches cut the line instead of
    // pinning at the pane edge (no more vertical swings when the singer
    // leaves the visible range — the line resumes when they're back).
    if (state.mode === 'calibrate') {
      if (state.offCents === null) {
        this.ribbon.push(null)
      } else {
        // No target yet: a dead-zone camera follows the voice — a held
        // note stays put; only a real glide pans the view.
        const center = this.calCamera.track(
          state.offCents,
          CALIBRATE_VIEW_CENTS,
        )
        const off = state.offCents - center
        this.ribbon.push(
          Math.abs(off) > CALIBRATE_VIEW_CENTS
            ? null
            : { off, level: state.level },
        )
      }
    } else if (state.mode === 'live' || state.mode === 'playback') {
      this.ribbon.push(
        state.offCents === null || Math.abs(state.offCents) > VIEW_CENTS
          ? null
          : { off: state.offCents, level: state.level },
      )
    }
    if (this.ribbon.length > RIBBON_LENGTH) this.ribbon.shift()

    // Physics crossed a crack threshold → grow a new permanent crack.
    this.crackField.sync(state.crackStep)
  }

  beginTake(): void {
    this.ribbon = []
    this.calCamera.reset()
  }

  shatter(options: { epicness: number; seed: number }): void {
    if (this.width === 0 || this.burst !== null) return
    // Snapshot the pane's final pixels (device resolution) — the frame,
    // ribbon and cracks all travel with the shards.
    const snapshot = document.createElement('canvas')
    snapshot.width = this.canvas.width
    snapshot.height = this.canvas.height
    snapshot.getContext('2d')?.drawImage(this.canvas, 0, 0)
    this.burst = new ShardBurst(snapshot, this.width, this.height, {
      epicness: options.epicness,
      seed: options.seed,
      impact: [this.width / 2, this.centsToY(0)],
      reduceMotion: this.reduceMotion,
    })
  }

  dispose(): void {
    this.disposed = true
    cancelAnimationFrame(this.rafId)
    this.observer?.disconnect()
    this.canvas.remove()
  }

  // ── painting ────────────────────────────────────────────────

  private viewCents(): number {
    return this.state.mode === 'calibrate' ? CALIBRATE_VIEW_CENTS : VIEW_CENTS
  }

  private centsToY(off: number): number {
    const inner = this.height / 2 - 18
    return this.height / 2 - (off / this.viewCents()) * inner
  }

  private roundedRect(
    c: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
  ): void {
    c.beginPath()
    c.moveTo(x + r, y)
    c.arcTo(x + w, y, x + w, y + h, r)
    c.arcTo(x + w, y + h, x, y + h, r)
    c.arcTo(x, y + h, x, y, r)
    c.arcTo(x, y, x + w, y, r)
    c.closePath()
  }

  private draw(t: number): void {
    const c = this.ctx
    if (!c || this.width === 0) return
    const W = this.width
    const H = this.height

    // Once the glass has burst, only the shards remain.
    if (this.burst !== null) {
      c.clearRect(0, 0, W, H)
      this.burst.draw(c, t)
      return
    }

    const s = this.state
    const radius = Math.min(18, W * 0.05)
    c.clearRect(0, 0, W, H)

    c.save()
    this.roundedRect(c, 1.5, 1.5, W - 3, H - 3, radius)
    c.clip()

    // Glass body: translucent depth tint — the cosmos glows through from
    // the page behind (the canvas itself stays transparent).
    const body = c.createLinearGradient(0, 0, W, H)
    body.addColorStop(0, 'rgba(27, 36, 48, 0.2)')
    body.addColorStop(0.5, 'rgba(11, 16, 38, 0.09)')
    body.addColorStop(1, 'rgba(9, 7, 20, 0.22)')
    c.fillStyle = body
    c.fillRect(0, 0, W, H)

    // Resonance ripples around the target line.
    if (s.resonance > 0.02 && !this.reduceMotion) {
      const cy = this.centsToY(0)
      c.globalCompositeOperation = 'lighter'
      for (let k = 0; k < 4; k++) {
        const r = (t * 46 + k * 34) % 150
        c.globalAlpha = (1 - r / 150) * s.resonance * 0.3
        c.strokeStyle = '#ffe9a8'
        c.lineWidth = 1.2
        c.beginPath()
        c.ellipse(W / 2, cy, r * 1.6, r * 0.5, 0, 0, Math.PI * 2)
        c.stroke()
      }
      c.globalAlpha = 1
      c.globalCompositeOperation = 'source-over'
    }

    // Target etch: gold dashed line + tolerance band + note label.
    if (s.mode === 'live' || s.mode === 'playback') {
      const cy = this.centsToY(0)
      const band = Math.abs(this.centsToY(35) - cy)
      c.fillStyle = 'rgba(255, 233, 168, 0.05)'
      c.fillRect(0, cy - band, W, band * 2)
      c.strokeStyle = 'rgba(255, 233, 168, 0.75)'
      c.lineWidth = 1.4
      c.setLineDash([7, 9])
      c.beginPath()
      c.moveTo(10, cy)
      c.lineTo(W - 10, cy)
      c.stroke()
      c.setLineDash([])
      if (s.targetLabel !== '') {
        c.font = '600 11px Outfit, system-ui, sans-serif'
        c.fillStyle = 'rgba(255, 233, 168, 0.9)'
        c.fillText(s.targetLabel, 12, cy - 7)
      }
    }

    // The ribbon — the voice dancing in the glass.
    this.drawRibbon(c, W, H, s)

    // Cracks — permanent damage (shared geometry with the GPU backend).
    this.crackField.draw(c, W, H, t)

    // Specular sheen drifting across the silver.
    if (!this.reduceMotion) {
      const sweepWidth = W * 0.5
      const sx = ((t * 26) % (W + sweepWidth * 2)) - sweepWidth
      const sheen = c.createLinearGradient(sx, 0, sx + sweepWidth, H * 0.4)
      const alpha = 0.05 + s.resonance * 0.1
      sheen.addColorStop(0, 'rgba(244, 248, 253, 0)')
      sheen.addColorStop(0.5, `rgba(244, 248, 253, ${alpha})`)
      sheen.addColorStop(1, 'rgba(244, 248, 253, 0)')
      c.fillStyle = sheen
      c.fillRect(0, 0, W, H)
    }
    c.restore()

    // Chrome bevel frame — layered for real depth (shadow, bevel, highlight).
    drawGlassFrame(c, W, H, radius, (x, y, w, h, r) =>
      this.roundedRect(c, x, y, w, h, r),
    )

    // Resonance meter traced along the frame perimeter.
    if (s.resonance > 0.01) {
      const perimeter = 2 * (W + H)
      this.roundedRect(c, 5, 5, W - 10, H - 10, Math.max(4, radius - 3))
      c.strokeStyle = s.resonance > 0.85 ? '#2dd4bf' : '#ffe9a8'
      c.shadowColor = c.strokeStyle
      c.shadowBlur = 8
      c.lineWidth = 2
      c.setLineDash([perimeter * s.resonance, perimeter])
      c.stroke()
      c.setLineDash([])
      c.shadowBlur = 0
    }
  }

  private drawRibbon(
    c: CanvasRenderingContext2D,
    W: number,
    H: number,
    s: GlassSceneUpdate,
  ): void {
    const ribbon = this.ribbon
    if (ribbon.length < 2) return
    const x0 = 14
    const x1 = W - 14
    const path = new Path2D()
    let started = false
    for (let i = 0; i < ribbon.length; i++) {
      const sample = ribbon[i]
      if (sample === null) {
        started = false
        continue
      }
      const px = x0 + ((x1 - x0) * i) / (RIBBON_LENGTH - 1)
      const py = Math.max(12, Math.min(H - 12, this.centsToY(sample.off)))
      if (started) path.lineTo(px, py)
      else {
        path.moveTo(px, py)
        started = true
      }
    }

    const last = ribbon[ribbon.length - 1]
    const inBand =
      last !== null &&
      last !== undefined &&
      (s.mode === 'live' || s.mode === 'playback') &&
      Math.abs(last.off) <= 35
    const core =
      s.mode === 'playback' ? '#ffe9a8' : inBand ? '#2dd4bf' : '#58a6ff'

    // Thin and elegant (the artifact look): a bright core with a tight,
    // quiet halo — never a fat glow cloud.
    c.globalCompositeOperation = 'lighter'
    c.lineJoin = 'round'
    c.lineCap = 'round'
    c.strokeStyle = core
    c.globalAlpha = 0.09
    c.lineWidth = 8
    c.stroke(path)
    c.globalAlpha = 0.28
    c.lineWidth = 3.2
    c.stroke(path)
    c.globalAlpha = 0.95
    c.lineWidth = 1.7
    c.stroke(path)
    // Quicksilver chromatic fringe as resonance rises.
    if (s.mode === 'live' && s.resonance > 0.3) {
      c.globalAlpha = 0.25 * s.resonance
      c.strokeStyle = '#bc8cff'
      c.lineWidth = 1.2
      c.save()
      c.translate(0, 1.6)
      c.stroke(path)
      c.restore()
    }
    c.globalAlpha = 1
    c.globalCompositeOperation = 'source-over'

    // The singing head — at the trail's leading tip (index len-1), so it
    // sits exactly where the line ends instead of pinned to the right edge.
    if (last !== null && last !== undefined && s.mode !== 'playback') {
      const headX = x0 + ((x1 - x0) * (ribbon.length - 1)) / (RIBBON_LENGTH - 1)
      const py = Math.max(12, Math.min(H - 12, this.centsToY(last.off)))
      c.fillStyle = core
      c.shadowColor = core
      c.shadowBlur = 10
      c.beginPath()
      c.arc(headX, py, 3.5 + last.level * 6, 0, Math.PI * 2)
      c.fill()
      c.shadowBlur = 0
    }
  }
}
