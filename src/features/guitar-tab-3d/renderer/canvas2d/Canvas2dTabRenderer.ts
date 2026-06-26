// ============================================================
// Canvas2dTabRenderer — perspective "falling notes" highway (Canvas 2D)
// ============================================================
//
// Renders the 3D-style guitar tab playback view: colored note blocks falling
// down per-string lanes toward a fretboard hit line, converging on a vanishing
// point. Pure Canvas 2D so it works on every browser; also the documented
// fallback once the WebGPU/TypeGPU backend ships behind the same TabRenderer
// interface.

import type { HighwayLayout } from '../projection'
import { beatsToDepth, DEFAULT_LAYOUT, laneU, nearLaneWidth, projectBoardPoint, } from '../projection'
import type { TabRenderer, TabScene, TabSceneNote } from '../TabRenderer'

/** Depth just behind the hit line where passed notes are culled. */
const MIN_DEPTH = -0.06
/** Beats-window either side of the hit line counted as "active" (playing now). */
const ACTIVE_BEATS = 0.09

function withAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function colorForString(
  colors: readonly string[],
  stringIndex: number,
): string {
  return colors[stringIndex % colors.length] ?? '#ffffff'
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

  private layout(scene: TabScene): HighwayLayout {
    return {
      ...DEFAULT_LAYOUT,
      stringCount: scene.stringCount,
      width: this.cssWidth,
      height: this.cssHeight,
    }
  }

  render(scene: TabScene): void {
    const ctx = this.ctx
    if (ctx === null || this.cssWidth === 0 || this.cssHeight === 0) return
    const layout = this.layout(scene)

    this.drawBackground(ctx, layout)
    this.drawLanes(ctx, layout, scene)
    this.drawBeatLines(ctx, layout, scene)
    this.drawNotes(ctx, layout, scene)
    this.drawHitLine(ctx, layout, scene)
  }

  private drawBackground(
    ctx: CanvasRenderingContext2D,
    layout: HighwayLayout,
  ): void {
    ctx.clearRect(0, 0, layout.width, layout.height)
    const grad = ctx.createLinearGradient(0, 0, 0, layout.height)
    grad.addColorStop(0, '#06060b')
    grad.addColorStop(1, '#101019')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, layout.width, layout.height)

    // Highway plane (near edge wide, far edge narrow).
    const nl = projectBoardPoint(layout, -1, 0)
    const nr = projectBoardPoint(layout, 1, 0)
    const fr = projectBoardPoint(layout, 1, 1)
    const fl = projectBoardPoint(layout, -1, 1)
    ctx.beginPath()
    ctx.moveTo(nl.x, nl.y)
    ctx.lineTo(nr.x, nr.y)
    ctx.lineTo(fr.x, fr.y)
    ctx.lineTo(fl.x, fl.y)
    ctx.closePath()
    ctx.fillStyle = 'rgba(255, 255, 255, 0.03)'
    ctx.fill()
  }

  private drawLanes(
    ctx: CanvasRenderingContext2D,
    layout: HighwayLayout,
    scene: TabScene,
  ): void {
    for (let i = 0; i < scene.stringCount; i++) {
      const u = laneU(i, scene.stringCount, scene.display.leftHanded)
      const near = projectBoardPoint(layout, u, 0)
      const far = projectBoardPoint(layout, u, 1)
      const color = colorForString(scene.display.stringColors, i)
      ctx.beginPath()
      ctx.moveTo(near.x, near.y)
      ctx.lineTo(far.x, far.y)
      ctx.strokeStyle = withAlpha(color, 0.32)
      ctx.lineWidth = 1.5
      ctx.stroke()
    }
  }

  private drawBeatLines(
    ctx: CanvasRenderingContext2D,
    layout: HighwayLayout,
    scene: TabScene,
  ): void {
    const beatWindow = scene.visibleBeatWindow
    const startBeat = Math.ceil(scene.playheadBeat)
    for (
      let beat = startBeat;
      beat <= scene.playheadBeat + beatWindow;
      beat++
    ) {
      const v = beatsToDepth(beat - scene.playheadBeat, beatWindow)
      if (v < 0 || v > 1) continue
      const left = projectBoardPoint(layout, -1, v)
      const right = projectBoardPoint(layout, 1, v)
      ctx.beginPath()
      ctx.moveTo(left.x, left.y)
      ctx.lineTo(right.x, right.y)
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)'
      ctx.lineWidth = 1
      ctx.stroke()
    }
  }

  private drawNotes(
    ctx: CanvasRenderingContext2D,
    layout: HighwayLayout,
    scene: TabScene,
  ): void {
    const beatWindow = scene.visibleBeatWindow
    const laneW = nearLaneWidth(layout)

    // Far notes first so nearer ones overlap them correctly.
    const visible = scene.notes
      .map((note) => ({
        note,
        vStart: beatsToDepth(note.startBeat - scene.playheadBeat, beatWindow),
        vEnd: beatsToDepth(
          note.startBeat + note.durationBeats - scene.playheadBeat,
          beatWindow,
        ),
      }))
      .filter((n) => n.vEnd > MIN_DEPTH && n.vStart < 1.04)
      .sort((a, b) => b.vStart - a.vStart)

    for (const { note, vStart, vEnd } of visible) {
      this.drawNote(ctx, layout, scene, note, vStart, vEnd, laneW)
    }
  }

  private drawNote(
    ctx: CanvasRenderingContext2D,
    layout: HighwayLayout,
    scene: TabScene,
    note: TabSceneNote,
    vStart: number,
    vEnd: number,
    laneW: number,
  ): void {
    const u = laneU(
      note.stringIndex,
      scene.stringCount,
      scene.display.leftHanded,
    )
    const color = colorForString(scene.display.stringColors, note.stringIndex)
    const head = projectBoardPoint(layout, u, Math.max(vStart, MIN_DEPTH))
    const baseAlpha = note.isBacking ? 0.4 : 1

    // Sustain trail behind the head.
    if (vEnd - vStart > 0.012) {
      const tail = projectBoardPoint(layout, u, Math.min(vEnd, 1))
      const headW = laneW * 0.28 * head.scale
      const tailW = laneW * 0.28 * tail.scale
      ctx.beginPath()
      ctx.moveTo(head.x - headW, head.y)
      ctx.lineTo(head.x + headW, head.y)
      ctx.lineTo(tail.x + tailW, tail.y)
      ctx.lineTo(tail.x - tailW, tail.y)
      ctx.closePath()
      ctx.fillStyle = withAlpha(color, 0.28 * baseAlpha)
      ctx.fill()
    }

    // Note block.
    const w = laneW * 0.74 * head.scale
    const h = w * 0.62
    const isActive =
      Math.abs(note.startBeat - scene.playheadBeat) < ACTIVE_BEATS &&
      !note.isBacking
    ctx.save()
    if (isActive) {
      ctx.shadowColor = color
      ctx.shadowBlur = 18 * head.scale
    }
    ctx.fillStyle = withAlpha(color, baseAlpha)
    roundRect(ctx, head.x - w / 2, head.y - h / 2, w, h, Math.min(6, h / 3))
    ctx.fill()
    ctx.restore()

    // Label: fret number, or note name when that mode is on.
    const label = scene.showNoteLabels ? note.noteName : String(note.fret)
    const fontPx = Math.max(8, 15 * head.scale)
    if (fontPx >= 9 && !note.isBacking) {
      ctx.fillStyle = 'rgba(10, 10, 16, 0.92)'
      ctx.font = `600 ${fontPx}px ui-sans-serif, system-ui, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(label, head.x, head.y)
    }
  }

  private drawHitLine(
    ctx: CanvasRenderingContext2D,
    layout: HighwayLayout,
    scene: TabScene,
  ): void {
    const laneW = nearLaneWidth(layout)
    for (let i = 0; i < scene.stringCount; i++) {
      const u = laneU(i, scene.stringCount, scene.display.leftHanded)
      const p = projectBoardPoint(layout, u, 0)
      const color = colorForString(scene.display.stringColors, i)
      ctx.beginPath()
      ctx.moveTo(p.x - laneW * 0.5, p.y)
      ctx.lineTo(p.x + laneW * 0.5, p.y)
      ctx.strokeStyle = withAlpha(color, 0.9)
      ctx.lineWidth = 3
      ctx.stroke()
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
