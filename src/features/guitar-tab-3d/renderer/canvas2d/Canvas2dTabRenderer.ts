// ============================================================
// Canvas2dTabRenderer — upright fretboard in front, highway behind
// ============================================================
//
// A real perspective camera (wgpu-matrix). The fretboard is an UPRIGHT wall on
// the Z=0 plane (X=frets, Y=strings) standing in front of the viewer; the
// highway recedes UP-and-back behind it (the Y=0 floor going to −Z, to a
// vanishing point). Notes fly through the air down their (string, fret) line
// and land exactly on their cell on the fretboard — Rocksmith/ToneLib/Tabizera.
// Camera + projection numerically verified against wgpu-matrix.
//
// Coordinates: +X right, +Y up, +Z toward viewer (depth into screen = −Z).

import { mat4 } from 'wgpu-matrix'
import { beatsToDepth } from '../projection'
import type { TabRenderer, TabScene, TabSceneNote } from '../TabRenderer'
import { colorForString, withAlpha } from './color'
import { cellKey, cellNoteName, isDoubleFretMarker, isFretMarker, } from './FretboardStrip'

// ── Scene constants (world units) ──────────────────────────
const WALL_HW = 6 // fretboard half-width in X
const Y_BOTTOM = 0 // wall bottom (low-E side / nut line)
const WALL_TOP = 3.5 // wall top (high-e side)
const FLOOR_DEPTH = 44 // highway depth: Z 0 (at the wall) → −44 (far)
const STR_MARGIN = 0.3 // string inset from wall top/bottom
const FRET_MARGIN = 0.4 // fret-0/last inset from wall sides

// ── Camera (numerically verified) ──────────────────────────
const EYE: [number, number, number] = [0, 6, 9]
const TARGET: [number, number, number] = [0, 1, -12]
const UP: [number, number, number] = [0, 1, 0]
const FOVY = (55 * Math.PI) / 180
const NEAR = 0.1
const FAR = 300

const ACTIVE_BEATS = 0.1

interface Projected {
  x: number
  y: number
  scale: number
  w: number
}

export class Canvas2dTabRenderer implements TabRenderer {
  private canvas: HTMLCanvasElement | null = null
  private ctx: CanvasRenderingContext2D | null = null
  private cssWidth = 0
  private cssHeight = 0
  private vp: Float32Array = new Float32Array(16)
  private vpW = 0
  private vpH = 0

  mount(canvas: HTMLCanvasElement): void {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')
    this.cssWidth = canvas.clientWidth
    this.cssHeight = canvas.clientHeight
  }

  resize(width: number, height: number, dpr: number): void {
    this.cssWidth = width
    this.cssHeight = height
    if (this.canvas === null || this.ctx === null) return
    this.canvas.width = Math.max(1, Math.round(width * dpr))
    this.canvas.height = Math.max(1, Math.round(height * dpr))
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  private ensureCamera(): void {
    if (this.vpW === this.cssWidth && this.vpH === this.cssHeight) return
    const aspect = this.cssHeight > 0 ? this.cssWidth / this.cssHeight : 1
    const view = mat4.lookAt(EYE, TARGET, UP)
    const proj = mat4.perspective(FOVY, aspect, NEAR, FAR)
    this.vp = mat4.multiply(proj, view) as Float32Array
    this.vpW = this.cssWidth
    this.vpH = this.cssHeight
  }

  private project(x: number, y: number, z: number): Projected {
    const m = this.vp
    const W = this.cssWidth
    const H = this.cssHeight
    const cx = m[0] * x + m[4] * y + m[8] * z + m[12]
    const cy = m[1] * x + m[5] * y + m[9] * z + m[13]
    const cw = m[3] * x + m[7] * y + m[11] * z + m[15]
    const inv = cw !== 0 ? 1 / cw : 0
    return {
      x: (cx * inv * 0.5 + 0.5) * W,
      y: (1 - (cy * inv * 0.5 + 0.5)) * H,
      scale: inv,
      w: cw,
    }
  }

  private fretX(f: number, maxFret: number): number {
    const a = -WALL_HW + FRET_MARGIN
    const b = WALL_HW - FRET_MARGIN
    return a + (maxFret > 0 ? f / maxFret : 0.5) * (b - a)
  }

  private stringY(s: number, n: number): number {
    const top = WALL_TOP - STR_MARGIN
    const bottom = Y_BOTTOM + STR_MARGIN
    return top - (n > 1 ? s / (n - 1) : 0.5) * (top - bottom)
  }

  /** A note flies straight down its (string, fret) line: Z=−t·depth → 0. */
  private notePos(
    s: number,
    f: number,
    t: number,
    n: number,
    maxFret: number,
  ): [number, number, number] {
    return [this.fretX(f, maxFret), this.stringY(s, n), -t * FLOOR_DEPTH]
  }

  /** On-screen width (px) of one fret cell at a world point. */
  private cellPx(x: number, y: number, z: number, maxFret: number): number {
    const cellW = this.fretX(1, maxFret) - this.fretX(0, maxFret)
    return Math.abs(this.project(x + cellW, y, z).x - this.project(x, y, z).x)
  }

  private line(
    ctx: CanvasRenderingContext2D,
    ax: number,
    ay: number,
    az: number,
    bx: number,
    by: number,
    bz: number,
    style: string,
    width: number,
  ): void {
    const a = this.project(ax, ay, az)
    const b = this.project(bx, by, bz)
    if (a.w <= NEAR || b.w <= NEAR) return
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
    ctx.strokeStyle = style
    ctx.lineWidth = width
    ctx.stroke()
  }

  render(scene: TabScene): void {
    const ctx = this.ctx
    if (ctx === null || this.cssWidth === 0 || this.cssHeight === 0) return
    this.ensureCamera()
    const N = Math.max(1, scene.stringCount)
    const maxFret = scene.maxFret

    this.drawBackground(ctx)

    const active = new Set<string>()
    for (const note of scene.notes) {
      if (note.isBacking) continue
      if (Math.abs(note.startBeat - scene.playheadBeat) < ACTIVE_BEATS) {
        active.add(cellKey(note.stringIndex, note.fret))
      }
    }

    this.drawHighway(ctx, scene, maxFret) // behind
    if (scene.showFretboard) this.drawFretboard(ctx, scene, N, maxFret, active)

    const beatWindow = Math.max(1, scene.visibleBeatWindow)
    const visible = scene.notes
      .map((note) => ({
        note,
        t0: beatsToDepth(note.startBeat - scene.playheadBeat, beatWindow),
        t1: beatsToDepth(
          note.startBeat + note.durationBeats - scene.playheadBeat,
          beatWindow,
        ),
      }))
      .filter((o) => o.t1 > -0.05 && o.t0 < 1.04)
      .sort((a, b) => b.t0 - a.t0)

    for (const { note, t0, t1 } of visible) {
      this.drawNote(ctx, scene, note, t0, t1, N, maxFret)
    }
  }

  private drawBackground(ctx: CanvasRenderingContext2D): void {
    const W = this.cssWidth
    const H = this.cssHeight
    ctx.clearRect(0, 0, W, H)
    const grad = ctx.createLinearGradient(0, 0, 0, H)
    grad.addColorStop(0, '#05050a')
    grad.addColorStop(1, '#0e0e17')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, W, H)
  }

  // Highway floor (Y=0) receding to −Z behind the fretboard.
  private drawHighway(
    ctx: CanvasRenderingContext2D,
    scene: TabScene,
    maxFret: number,
  ): void {
    for (let f = 0; f <= maxFret; f++) {
      const x = this.fretX(f, maxFret)
      this.line(ctx, x, 0, 0, x, 0, -FLOOR_DEPTH, 'rgba(120,150,220,0.12)', 1)
    }
    const left = this.fretX(0, maxFret)
    const right = this.fretX(maxFret, maxFret)
    const beatWindow = Math.max(1, scene.visibleBeatWindow)
    const startBeat = Math.ceil(scene.playheadBeat)
    for (
      let beat = startBeat;
      beat <= scene.playheadBeat + beatWindow;
      beat++
    ) {
      const t = beatsToDepth(beat - scene.playheadBeat, beatWindow)
      if (t < 0 || t > 1) continue
      const z = -t * FLOOR_DEPTH
      this.line(ctx, left, 0, z, right, 0, z, 'rgba(120,150,220,0.08)', 1)
    }
  }

  // Upright fretboard wall on Z=0.
  private drawFretboard(
    ctx: CanvasRenderingContext2D,
    scene: TabScene,
    n: number,
    maxFret: number,
    active: ReadonlySet<string>,
  ): void {
    // Fret wires (vertical).
    for (let f = 0; f <= maxFret; f++) {
      const x = this.fretX(f, maxFret)
      this.line(
        ctx,
        x,
        Y_BOTTOM,
        0,
        x,
        WALL_TOP,
        0,
        f === 0 ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.14)',
        f === 0 ? 2 : 1,
      )
    }

    // Inlay markers (mid height).
    const yMid = this.stringY((n - 1) / 2, n)
    for (let f = 1; f <= maxFret; f++) {
      if (!isFretMarker(f)) continue
      const x = this.fretX(f, maxFret)
      const offs = isDoubleFretMarker(f) ? [-0.5, 0.5] : [0]
      for (const dy of offs) {
        const p = this.project(x, yMid + dy, 0)
        if (p.w <= NEAR) continue
        ctx.beginPath()
        ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(255,255,255,0.2)'
        ctx.fill()
      }
    }

    const xL = this.fretX(0, maxFret)
    const xR = this.fretX(maxFret, maxFret)

    // Strings (horizontal, coloured) + open labels + per-cell names.
    for (let s = 0; s < n; s++) {
      const y = this.stringY(s, n)
      const color = colorForString(scene.display.stringColors, s)
      this.line(
        ctx,
        xL,
        y,
        0,
        xR,
        y,
        0,
        withAlpha(color, 0.75),
        1 + (n - 1 - s) * 0.3,
      )
      const open = scene.openMidi[s] ?? 40
      const lp = this.project(xL, y, 0)
      if (lp.w > NEAR) {
        ctx.fillStyle = withAlpha(color, 0.95)
        ctx.font = '600 11px ui-sans-serif, system-ui, sans-serif'
        ctx.textAlign = 'right'
        ctx.textBaseline = 'middle'
        ctx.fillText(cellNoteName(open, 0), lp.x - 8, lp.y)
      }
      if (scene.showNoteLabels) {
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.font = '9px ui-sans-serif, system-ui, sans-serif'
        for (let f = 0; f <= maxFret; f++) {
          if (active.has(cellKey(s, f))) continue
          const p = this.project(this.fretX(f, maxFret), y, 0)
          if (p.w <= NEAR) continue
          ctx.fillStyle = 'rgba(255,255,255,0.3)'
          ctx.fillText(cellNoteName(open, f), p.x, p.y)
        }
      }
    }

    // Active cells (the note currently on the fret).
    for (let s = 0; s < n; s++) {
      const y = this.stringY(s, n)
      const open = scene.openMidi[s] ?? 40
      const color = colorForString(scene.display.stringColors, s)
      for (let f = 0; f <= maxFret; f++) {
        if (!active.has(cellKey(s, f))) continue
        const x = this.fretX(f, maxFret)
        const p = this.project(x, y, 0)
        if (p.w <= NEAR) continue
        const r = Math.max(6, this.cellPx(x, y, 0, maxFret) * 0.42)
        ctx.fillStyle = color
        ctx.beginPath()
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = 'rgba(10,10,16,0.95)'
        ctx.font = '700 10px ui-sans-serif, system-ui, sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(cellNoteName(open, f), p.x, p.y)
      }
    }

    // Fret numbers below the nut line.
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    for (let f = 0; f <= maxFret; f++) {
      const p = this.project(this.fretX(f, maxFret), Y_BOTTOM - 0.3, 0)
      if (p.w <= NEAR) continue
      ctx.fillStyle = isFretMarker(f)
        ? 'rgba(120,170,255,0.9)'
        : 'rgba(255,255,255,0.4)'
      ctx.font = `${isFretMarker(f) ? '600 ' : ''}11px ui-sans-serif, system-ui, sans-serif`
      ctx.fillText(String(f), p.x, p.y)
    }
  }

  private drawNote(
    ctx: CanvasRenderingContext2D,
    scene: TabScene,
    note: TabSceneNote,
    t0: number,
    t1: number,
    n: number,
    maxFret: number,
  ): void {
    const color = colorForString(scene.display.stringColors, note.stringIndex)
    const baseAlpha = note.isBacking ? 0.45 : 1
    const headT = Math.max(t0, -0.03)
    const [hx, hy, hz] = this.notePos(
      note.stringIndex,
      note.fret,
      headT,
      n,
      maxFret,
    )
    const head = this.project(hx, hy, hz)
    if (head.w <= NEAR) return

    // Sustain ribbon along the flight line (straight in Z).
    if (t1 - t0 > 0.02) {
      const tEnd = Math.min(t1, 1)
      const [tx, ty, tz] = this.notePos(
        note.stringIndex,
        note.fret,
        tEnd,
        n,
        maxFret,
      )
      const tail = this.project(tx, ty, tz)
      if (tail.w > NEAR) {
        ctx.beginPath()
        ctx.moveTo(head.x, head.y)
        ctx.lineTo(tail.x, tail.y)
        ctx.strokeStyle = withAlpha(color, 0.3 * baseAlpha)
        ctx.lineWidth = Math.max(2, this.cellPx(hx, hy, hz, maxFret) * 0.34)
        ctx.lineCap = 'round'
        ctx.stroke()
      }
    }

    const w = Math.max(5, this.cellPx(hx, hy, hz, maxFret) * 0.82)
    const h = w * 0.66
    const isActive =
      !note.isBacking &&
      Math.abs(note.startBeat - scene.playheadBeat) < ACTIVE_BEATS
    ctx.save()
    if (isActive) {
      ctx.shadowColor = color
      ctx.shadowBlur = 14
    }
    ctx.fillStyle = withAlpha(color, baseAlpha)
    roundRect(ctx, head.x - w / 2, head.y - h / 2, w, h, Math.min(5, h / 3))
    ctx.fill()
    ctx.restore()

    const fontPx = Math.max(7, Math.min(13, w * 0.5))
    if (fontPx >= 8 && !note.isBacking) {
      const label = scene.showNoteLabels ? note.noteName : String(note.fret)
      ctx.fillStyle = 'rgba(10, 10, 16, 0.92)'
      ctx.font = `600 ${fontPx}px ui-sans-serif, system-ui, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(label, head.x, head.y)
    }
  }

  dispose(): void {
    this.canvas = null
    this.ctx = null
  }
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}
