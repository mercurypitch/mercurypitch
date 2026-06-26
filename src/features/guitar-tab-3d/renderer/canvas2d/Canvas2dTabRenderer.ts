// ============================================================
// Canvas2dTabRenderer — falling-note highway onto a fretboard
// ============================================================
//
// A receding highway (frets are the columns, time is the depth) down which
// notes fall toward the player, landing on a flat fretboard at the near edge:
// 6 stacked strings + vertical fret wires + fret numbers. A note travels down
// its fret column and lands on its string row at hit time — the Rocksmith/
// ToneLib layout. Pure Canvas 2D; the WebGPU backend slots in behind TabRenderer.

import { beatsToDepth, perspectiveScale } from '../projection'
import type { TabRenderer, TabScene, TabSceneNote } from '../TabRenderer'
import { colorForString, withAlpha } from './color'
import { cellKey, cellNoteName, isDoubleFretMarker, isFretMarker, } from './FretboardStrip'

/** Perspective strength for the time depth (note descent / horizon). */
const DEPTH = 4
/** Beats either side of the hit line counted as "now playing". */
const ACTIVE_BEATS = 0.1

interface HighwayGeom {
  vpX: number
  vpY: number
  bandTop: number
  bandBottom: number
  colW: number
  stringCount: number
  maxFret: number
  /** X of a fret column at the near (band-bottom) edge. */
  colBottomX: (fret: number) => number
  /** Screen Y of a string row on the near fretboard band. */
  stringY: (s: number) => number
  /** Cell centre (string, fret) on the fretboard band. */
  cellX: (s: number, fret: number) => number
  /** Fret-cell width at a given screen Y (perspective). */
  colWAt: (y: number) => number
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

  private buildGeom(scene: TabScene): HighwayGeom {
    const W = this.cssWidth
    const H = this.cssHeight
    const N = Math.max(1, scene.stringCount)
    const maxFret = scene.maxFret
    const vpX = W / 2
    const vpY = H * 0.07
    const bandTop = H * 0.66
    const bandBottom = H * 0.93
    const leftPad = 30
    const rightPad = 12
    const colW = (W - leftPad - rightPad) / (maxFret + 1)
    const colBottomX = (f: number) => leftPad + (f + 0.5) * colW
    const stringY = (s: number) =>
      bandTop + (N > 1 ? s / (N - 1) : 0.5) * (bandBottom - bandTop)
    // Parameter along a fret column (0 = vanishing point, 1 = near band edge).
    const pAt = (y: number) => (y - vpY) / (bandBottom - vpY)
    const cellX = (s: number, f: number) =>
      vpX + (colBottomX(f) - vpX) * pAt(stringY(s))
    const colWAt = (y: number) => colW * pAt(y)
    return {
      vpX,
      vpY,
      bandTop,
      bandBottom,
      colW,
      stringCount: N,
      maxFret,
      colBottomX,
      stringY,
      cellX,
      colWAt,
    }
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

    this.drawHighwayGrid(ctx, scene, g)
    if (scene.showFretboard) this.drawFretboard(ctx, scene, g, active)

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
    grad.addColorStop(1, '#0d0d15')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, W, H)
  }

  // Faint receding grid above the fretboard: fret columns + beat rungs.
  private drawHighwayGrid(
    ctx: CanvasRenderingContext2D,
    scene: TabScene,
    g: HighwayGeom,
  ): void {
    ctx.strokeStyle = 'rgba(120,150,220,0.10)'
    ctx.lineWidth = 1
    for (let f = 0; f <= g.maxFret; f++) {
      ctx.beginPath()
      ctx.moveTo(g.vpX, g.vpY)
      ctx.lineTo(g.colBottomX(f), g.bandBottom)
      ctx.stroke()
    }

    // Beat rungs receding to the horizon.
    const beatWindow = Math.max(1, scene.visibleBeatWindow)
    const startBeat = Math.ceil(scene.playheadBeat)
    for (
      let beat = startBeat;
      beat <= scene.playheadBeat + beatWindow;
      beat++
    ) {
      const t = beatsToDepth(beat - scene.playheadBeat, beatWindow)
      if (t < 0 || t > 1) continue
      const a = perspectiveScale(t, DEPTH)
      const lx = g.vpX + (g.colBottomX(0) - g.vpX) * a
      const rx = g.vpX + (g.colBottomX(g.maxFret) - g.vpX) * a
      const y = g.vpY + (g.bandBottom - g.vpY) * a
      ctx.beginPath()
      ctx.moveTo(lx, y)
      ctx.lineTo(rx, y)
      ctx.strokeStyle = 'rgba(120,150,220,0.07)'
      ctx.stroke()
    }
  }

  // The flat fretboard at the near edge: strings, fret wires, numbers, inlays.
  private drawFretboard(
    ctx: CanvasRenderingContext2D,
    scene: TabScene,
    g: HighwayGeom,
    active: ReadonlySet<string>,
  ): void {
    const { stringCount: N, maxFret } = g

    // Fret wires within the band.
    for (let f = 0; f <= maxFret + 1; f++) {
      const fr = Math.min(f, maxFret)
      const off = f - fr - 0.5
      const topX = g.cellX(0, fr) + off * g.colWAt(g.stringY(0))
      const botX = g.cellX(N - 1, fr) + off * g.colWAt(g.stringY(N - 1))
      ctx.beginPath()
      ctx.moveTo(topX, g.stringY(0))
      ctx.lineTo(botX, g.stringY(N - 1))
      ctx.strokeStyle =
        f === 0 ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.16)'
      ctx.lineWidth = f === 0 ? 2.5 : 1
      ctx.stroke()
    }

    // Inlay markers.
    const midS = (N - 1) / 2
    const midY = g.stringY(midS)
    for (let f = 1; f <= maxFret; f++) {
      if (!isFretMarker(f)) continue
      const cx = g.cellX(midS, f)
      const dots = isDoubleFretMarker(f)
        ? [-g.colWAt(midY) * 0.5, g.colWAt(midY) * 0.5]
        : [0]
      for (const dy of dots) {
        ctx.beginPath()
        ctx.arc(cx, midY + dy, 2.5, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(255,255,255,0.2)'
        ctx.fill()
      }
    }

    // Strings + open-string labels + optional per-cell note names.
    for (let s = 0; s < N; s++) {
      const y = g.stringY(s)
      const color = colorForString(scene.display.stringColors, s)
      ctx.beginPath()
      ctx.moveTo(g.cellX(s, 0), y)
      ctx.lineTo(g.cellX(s, maxFret), y)
      ctx.strokeStyle = withAlpha(color, 0.7)
      ctx.lineWidth = 1 + (N - 1 - s) * 0.3
      ctx.stroke()
      const open = scene.openMidi[s] ?? 40
      ctx.fillStyle = withAlpha(color, 0.95)
      ctx.font = '600 11px ui-sans-serif, system-ui, sans-serif'
      ctx.textAlign = 'right'
      ctx.textBaseline = 'middle'
      ctx.fillText(cellNoteName(open, 0), g.cellX(s, 0) - 8, y)

      if (scene.showNoteLabels && g.colWAt(y) >= 13) {
        ctx.textAlign = 'center'
        ctx.font = '9px ui-sans-serif, system-ui, sans-serif'
        for (let f = 0; f <= maxFret; f++) {
          if (active.has(cellKey(s, f))) continue
          ctx.fillStyle = 'rgba(255,255,255,0.3)'
          ctx.fillText(cellNoteName(open, f), g.cellX(s, f), y)
        }
      }
    }

    // Active cells.
    for (let s = 0; s < N; s++) {
      const open = scene.openMidi[s] ?? 40
      const y = g.stringY(s)
      const color = colorForString(scene.display.stringColors, s)
      for (let f = 0; f <= maxFret; f++) {
        if (!active.has(cellKey(s, f))) continue
        const cx = g.cellX(s, f)
        ctx.fillStyle = color
        ctx.beginPath()
        ctx.arc(cx, y, Math.max(5, g.colWAt(y) * 0.42), 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = 'rgba(10,10,16,0.95)'
        ctx.font = '700 10px ui-sans-serif, system-ui, sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(cellNoteName(open, f), cx, y)
      }
    }

    // Fret numbers below the near edge.
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const numY = g.bandBottom + 16
    for (let f = 0; f <= maxFret; f++) {
      ctx.fillStyle = isFretMarker(f)
        ? 'rgba(120,170,255,0.85)'
        : 'rgba(255,255,255,0.35)'
      ctx.font = `${isFretMarker(f) ? '600 ' : ''}11px ui-sans-serif, system-ui, sans-serif`
      ctx.fillText(String(f), g.colBottomX(f), numY)
    }
  }

  private drawNote(
    ctx: CanvasRenderingContext2D,
    scene: TabScene,
    g: HighwayGeom,
    note: TabSceneNote,
    t0: number,
    t1: number,
  ): void {
    const color = colorForString(scene.display.stringColors, note.stringIndex)
    const baseAlpha = note.isBacking ? 0.4 : 1
    const cx = g.cellX(note.stringIndex, note.fret)
    const cy = g.stringY(note.stringIndex)
    const cellW = g.colWAt(cy)

    // The note travels down its fret column from the vanishing point to the cell.
    const at = (t: number) => {
      const a = perspectiveScale(t, DEPTH)
      return { x: g.vpX + (cx - g.vpX) * a, y: g.vpY + (cy - g.vpY) * a, a }
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

    const w = Math.max(4, cellW * 0.82 * head.a)
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
