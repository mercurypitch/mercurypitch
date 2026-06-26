// ============================================================
// Canvas2dTabRenderer — tilted 3D fretboard, notes fall onto cells
// ============================================================
//
// The neck is a perspective plane receding to a vanishing point: strings are
// stacked horizontal lines (low-E near/bottom, high-e far/top), frets fan up as
// gray lines with numbers at the near edge, and notes descend from the
// vanishing point onto their exact (string, fret) cell — the Rocksmith/ToneLib
// look. Pure Canvas 2D; the WebGPU backend will slot in behind TabRenderer.

import { beatsToDepth, perspectiveScale } from '../projection'
import type { TabRenderer, TabScene, TabSceneNote } from '../TabRenderer'
import { colorForString, withAlpha } from './color'
import { cellKey, cellNoteName, isDoubleFretMarker, isFretMarker, } from './FretboardStrip'

/** Perspective strength for the note descent (time → vanishing point). */
const DEPTH = 4.5
/** Gentle perspective for the string rows so the neck isn't crammed. */
const STRING_DEPTH = 1.3
/** Beats either side of the hit line counted as "now playing". */
const ACTIVE_BEATS = 0.1
/** Open-string label gutter (px) at the near edge. */
const LEFT_GUTTER = 22

interface NeckGeom {
  vpX: number
  vpY: number
  /** Perspective factor for a string row (0 = high-e far, last = low-E near). */
  scaleOf: (s: number) => number
  yOf: (s: number) => number
  xOf: (fret: number, s: number) => number
  /** Fret-cell width at a string row. */
  colWOf: (s: number) => number
  stringCount: number
  maxFret: number
}

export class Canvas2dTabRenderer implements TabRenderer {
  private canvas: HTMLCanvasElement | null = null
  private ctx: CanvasRenderingContext2D | null = null
  private cssWidth = 0
  private cssHeight = 0

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

  private buildGeom(scene: TabScene): NeckGeom {
    const W = this.cssWidth
    const H = this.cssHeight
    const N = Math.max(1, scene.stringCount)
    const maxFret = scene.maxFret
    const vpX = W / 2
    const vpY = H * 0.06
    const nearY = H * 0.87
    const nearHalfW = W * 0.46
    // Depth of a string row: low-E (last index) is nearest, high-e farthest.
    const depthOf = (s: number) => (N > 1 ? (N - 1 - s) / (N - 1) : 0)
    const scaleOf = (s: number) => perspectiveScale(depthOf(s), STRING_DEPTH)
    const yOf = (s: number) => vpY + (nearY - vpY) * scaleOf(s)
    const halfWOf = (s: number) => nearHalfW * scaleOf(s)
    const xOf = (fret: number, s: number) => {
      const frac = maxFret > 0 ? fret / maxFret : 0.5
      return vpX + (frac - 0.5) * 2 * halfWOf(s)
    }
    const colWOf = (s: number) => (2 * halfWOf(s)) / (maxFret + 1)
    return { vpX, vpY, scaleOf, yOf, xOf, colWOf, stringCount: N, maxFret }
  }

  render(scene: TabScene): void {
    const ctx = this.ctx
    const W = this.cssWidth
    const H = this.cssHeight
    if (ctx === null || W === 0 || H === 0) return

    this.drawBackground(ctx, W, H)
    const g = this.buildGeom(scene)

    const active = new Set<string>()
    for (const n of scene.notes) {
      if (n.isBacking) continue
      if (Math.abs(n.startBeat - scene.playheadBeat) < ACTIVE_BEATS) {
        active.add(cellKey(n.stringIndex, n.fret))
      }
    }

    if (scene.showFretboard) this.drawNeck(ctx, scene, g, active)

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
      .filter((o) => o.t1 > -0.05 && o.t0 < 1.05)
      .sort((a, b) => b.t0 - a.t0)

    for (const { note, t0, t1 } of visible) {
      this.drawNote(ctx, scene, g, note, t0, t1)
    }
  }

  private drawBackground(
    ctx: CanvasRenderingContext2D,
    W: number,
    H: number,
  ): void {
    ctx.clearRect(0, 0, W, H)
    const grad = ctx.createLinearGradient(0, 0, 0, H)
    grad.addColorStop(0, '#05050a')
    grad.addColorStop(1, '#0e0e16')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, W, H)
  }

  private drawNeck(
    ctx: CanvasRenderingContext2D,
    scene: TabScene,
    g: NeckGeom,
    active: ReadonlySet<string>,
  ): void {
    const { stringCount: N, maxFret } = g
    const nearS = N - 1
    const farS = 0

    // Fret wires (fan from the near low-E edge up to the far high-e edge).
    for (let f = 0; f <= maxFret + 1; f++) {
      const fr = Math.min(f, maxFret)
      // Draw at column boundaries: shift by half a cell.
      const off = f - fr - 0.5
      const xNear = g.xOf(fr, nearS) + off * g.colWOf(nearS)
      const xFar = g.xOf(fr, farS) + off * g.colWOf(farS)
      ctx.beginPath()
      ctx.moveTo(xNear, g.yOf(nearS))
      ctx.lineTo(xFar, g.yOf(farS))
      ctx.strokeStyle =
        f === 0 ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.1)'
      ctx.lineWidth = f === 0 ? 2.5 : 1
      ctx.stroke()
    }

    // Inlay markers down the centre of the neck.
    for (let f = 1; f <= maxFret; f++) {
      if (!isFretMarker(f)) continue
      const midS = (N - 1) / 2
      const cx = g.xOf(f, midS)
      const dots = isDoubleFretMarker(f)
        ? [-g.colWOf(midS) * 0.6, g.colWOf(midS) * 0.6]
        : [0]
      for (const dy of dots) {
        ctx.beginPath()
        ctx.arc(cx, g.yOf(midS) + dy, 2.5, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(255,255,255,0.16)'
        ctx.fill()
      }
    }

    // Strings (coloured, stacked, receding) + open-string labels.
    for (let s = 0; s < N; s++) {
      const y = g.yOf(s)
      const color = colorForString(scene.display.stringColors, s)
      ctx.beginPath()
      ctx.moveTo(g.xOf(0, s), y)
      ctx.lineTo(g.xOf(maxFret, s), y)
      ctx.strokeStyle = withAlpha(color, 0.65)
      ctx.lineWidth = Math.max(1, (1 + (N - 1 - s) * 0.3) * g.scaleOf(s))
      ctx.stroke()
      const open = scene.openMidi[s] ?? 40
      ctx.fillStyle = withAlpha(color, 0.9)
      ctx.font = `600 ${Math.max(8, 12 * g.scaleOf(s))}px ui-sans-serif, system-ui, sans-serif`
      ctx.textAlign = 'right'
      ctx.textBaseline = 'middle'
      ctx.fillText(cellNoteName(open, 0), g.xOf(0, s) - LEFT_GUTTER * 0.3, y)
    }

    // Optional per-cell note names.
    if (scene.showNoteLabels) {
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      for (let s = 0; s < N; s++) {
        const open = scene.openMidi[s] ?? 40
        const colW = g.colWOf(s)
        if (colW < 13) continue
        const y = g.yOf(s)
        for (let f = 0; f <= maxFret; f++) {
          if (active.has(cellKey(s, f))) continue
          ctx.fillStyle = 'rgba(255,255,255,0.28)'
          ctx.font = `${Math.max(7, 9 * g.scaleOf(s))}px ui-sans-serif, system-ui, sans-serif`
          ctx.fillText(cellNoteName(open, f), g.xOf(f, s), y)
        }
      }
    }

    // Active cells.
    for (let s = 0; s < N; s++) {
      const open = scene.openMidi[s] ?? 40
      const y = g.yOf(s)
      const color = colorForString(scene.display.stringColors, s)
      for (let f = 0; f <= maxFret; f++) {
        if (!active.has(cellKey(s, f))) continue
        const cx = g.xOf(f, s)
        ctx.fillStyle = color
        ctx.beginPath()
        ctx.arc(cx, y, Math.max(5, g.colWOf(s) * 0.4), 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = 'rgba(10,10,16,0.95)'
        ctx.font = `700 ${Math.max(8, 10 * g.scaleOf(s))}px ui-sans-serif, system-ui, sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(cellNoteName(open, f), cx, y)
      }
    }

    // Fret numbers at the near edge.
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const numY = g.yOf(nearS) + 20
    for (let f = 0; f <= maxFret; f++) {
      ctx.fillStyle = isFretMarker(f)
        ? 'rgba(120,170,255,0.85)'
        : 'rgba(255,255,255,0.32)'
      ctx.font = `${isFretMarker(f) ? '600 ' : ''}11px ui-sans-serif, system-ui, sans-serif`
      ctx.fillText(String(f), g.xOf(f, nearS), numY)
    }
  }

  private drawNote(
    ctx: CanvasRenderingContext2D,
    scene: TabScene,
    g: NeckGeom,
    note: TabSceneNote,
    t0: number,
    t1: number,
  ): void {
    const color = colorForString(scene.display.stringColors, note.stringIndex)
    const baseAlpha = note.isBacking ? 0.4 : 1
    const cellX = g.xOf(note.fret, note.stringIndex)
    const cellY = g.yOf(note.stringIndex)
    const cellW = g.colWOf(note.stringIndex)

    const at = (t: number) => {
      const a = perspectiveScale(t, DEPTH)
      return {
        x: g.vpX + (cellX - g.vpX) * a,
        y: g.vpY + (cellY - g.vpY) * a,
        a,
      }
    }
    const head = at(Math.max(t0, -0.03))

    if (t1 - t0 > 0.01) {
      const tail = at(Math.min(t1, 1))
      const hw = cellW * 0.18 * head.a
      const tw = cellW * 0.18 * tail.a
      ctx.beginPath()
      ctx.moveTo(head.x - hw, head.y)
      ctx.lineTo(head.x + hw, head.y)
      ctx.lineTo(tail.x + tw, tail.y)
      ctx.lineTo(tail.x - tw, tail.y)
      ctx.closePath()
      ctx.fillStyle = withAlpha(color, 0.26 * baseAlpha)
      ctx.fill()
    }

    const w = Math.max(4, cellW * 0.78 * head.a)
    const h = w * 0.66
    const isActive =
      !note.isBacking &&
      Math.abs(note.startBeat - scene.playheadBeat) < ACTIVE_BEATS
    ctx.save()
    if (isActive) {
      ctx.shadowColor = color
      ctx.shadowBlur = 14 * head.a
    }
    ctx.fillStyle = withAlpha(color, baseAlpha)
    roundRect(ctx, head.x - w / 2, head.y - h / 2, w, h, Math.min(5, h / 3))
    ctx.fill()
    ctx.restore()

    const fontPx = Math.max(7, 11 * head.a)
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
