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

import { CrackField } from '../crack-field'
import type { GlassRenderer, GlassSceneUpdate } from '../GlassRenderer'
import { ShardBurst } from '../shard-burst'

const VIEW_CENTS = 340 // half-range of the pane's vertical pitch view
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
  /** Rolling view center for calibrate mode (absolute cents). */
  private calCenter: number | null = null
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
    this.dpr = Math.min(DPR_CAP, window.devicePixelRatio || 1)
    this.width = rect.width
    this.height = rect.height
    this.canvas.width = Math.round(rect.width * this.dpr)
    this.canvas.height = Math.round(rect.height * this.dpr)
    this.ctx?.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
  }

  update(state: GlassSceneUpdate): void {
    this.state = state

    // Ribbon sample per update (~30 Hz from the app loop).
    if (state.mode === 'calibrate') {
      if (state.offCents === null) {
        this.ribbon.push(null)
      } else {
        // No target yet: dance around a rolling center of what's sung.
        this.calCenter =
          this.calCenter === null
            ? state.offCents
            : this.calCenter * 0.97 + state.offCents * 0.03
        this.ribbon.push({
          off: state.offCents - this.calCenter,
          level: state.level,
        })
      }
    } else if (state.mode === 'live' || state.mode === 'playback') {
      this.ribbon.push(
        state.offCents === null
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
    this.calCenter = null
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

  private centsToY(off: number): number {
    const inner = this.height / 2 - 18
    return this.height / 2 - (off / VIEW_CENTS) * inner
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
    body.addColorStop(0, 'rgba(27, 36, 48, 0.42)')
    body.addColorStop(0.5, 'rgba(11, 16, 38, 0.22)')
    body.addColorStop(1, 'rgba(9, 7, 20, 0.45)')
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

    // Chrome bevel frame.
    const frame = c.createLinearGradient(0, 0, W, H)
    frame.addColorStop(0, '#c3ccd6')
    frame.addColorStop(0.4, '#5b6b7b')
    frame.addColorStop(0.7, '#8a97a6')
    frame.addColorStop(1, '#1b2430')
    this.roundedRect(c, 1.5, 1.5, W - 3, H - 3, radius)
    c.strokeStyle = frame
    c.lineWidth = 3
    c.stroke()

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

    c.globalCompositeOperation = 'lighter'
    c.lineJoin = 'round'
    c.lineCap = 'round'
    c.strokeStyle = core
    c.globalAlpha = 0.16
    c.lineWidth = 11
    c.stroke(path)
    c.globalAlpha = 0.4
    c.lineWidth = 4.5
    c.stroke(path)
    c.globalAlpha = 0.95
    c.lineWidth = 1.8
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

    // The singing head.
    if (last !== null && last !== undefined && s.mode !== 'playback') {
      const py = Math.max(12, Math.min(H - 12, this.centsToY(last.off)))
      c.fillStyle = core
      c.shadowColor = core
      c.shadowBlur = 14
      c.beginPath()
      c.arc(x1, py, 4 + last.level * 18, 0, Math.PI * 2)
      c.fill()
      c.shadowBlur = 0
    }
  }
}
