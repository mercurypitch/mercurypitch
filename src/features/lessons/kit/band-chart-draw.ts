// ============================================================
// Band chart drawing — the strip, Merc's band, the singer's line
// ============================================================
//
// The painters behind kit/band-chart.ts, each over one frame's geometry:
// pitch is height in cents from Merc's note, time runs left to right across
// a fixed window, so nothing ever scrolls. Colours are the app's own
// pitch-canvas set (src/features/stem-mixer/pitch-canvas-visuals.ts): Merc's
// note is target amber, the singer's line is violet and nothing else is,
// and a lit band edge is in-tune mint, always drawn beside the words "in
// the band". There is no colour for "off": a note outside the band is said
// in words by the chart's readouts, never painted as an error.

import { TAU } from './dom'
import { COLOR, letterOf, nameOf, rgba } from './notes'

/** The app's pitch-canvas colours, and the production research's in-tune mint. */
export const BAND_COLOR = {
  target: '#f59e0b',
  singer: '#a78bfa',
  mint: '#80ffca',
} as const

/** The chart's words: the grid's, the marks', the readings'. */
export const MONO = '500 12px "JetBrains Mono", monospace'

/** One frame of a chart: its context, its plot and its two scales. */
export interface ChartFrame {
  readonly ctx: CanvasRenderingContext2D
  readonly w: number
  readonly h: number
  /** The plot, inside the labels. */
  readonly x0: number
  readonly x1: number
  readonly top: number
  readonly bottom: number
  /** Cents from Merc's note at the bottom and the top of the plot. */
  readonly lo: number
  readonly hi: number
  /** Seconds across the plot. */
  readonly window: number
}

export const yOf = (f: ChartFrame, cents: number): number =>
  f.bottom - ((cents - f.lo) / (f.hi - f.lo)) * (f.bottom - f.top)

export const xOf = (f: ChartFrame, t: number): number =>
  f.x0 + (Math.min(Math.max(t, 0), f.window) / f.window) * (f.x1 - f.x0)

/** The cents a height stands for: the inverse of `yOf`. */
export const centsAt = (f: ChartFrame, y: number): number =>
  f.lo + ((f.bottom - y) / (f.bottom - f.top)) * (f.hi - f.lo)

/** A tick on the cents axis, its label (empty for none), and which side of its line the label sits. */
export interface CentsTick {
  readonly c: number
  readonly label: string
  /** Default 'above'. */
  readonly place?: 'above' | 'below'
}

/**
 * Lesson 3's cents ticks: 0, ±15, ±35, ±50 and ±100, the upper half named
 * (WEB-SPEC, Toys 6). Each band edge's "35" sits inside the band and each
 * "50" and "100" outside it, so on a short chart no label lands on its
 * neighbour; 0 is Merc's own line, drawn with the band.
 */
export const CENTS_TICKS: readonly CentsTick[] = [
  { c: 100, label: '100: a semitone' },
  { c: 50, label: '50: halfway to the next note' },
  { c: 35, label: '35', place: 'below' },
  { c: 15, label: '' },
  { c: 0, label: '' },
  { c: -15, label: '' },
  { c: -35, label: '35' },
  { c: -50, label: '50', place: 'below' },
  { c: -100, label: '100', place: 'below' },
]

function hline(f: ChartFrame, y: number, alpha: number, dash = false): void {
  const { ctx } = f
  ctx.strokeStyle = rgba(COLOR.chrome, alpha)
  ctx.lineWidth = 1
  ctx.setLineDash(dash ? [3, 5] : [])
  ctx.beginPath()
  ctx.moveTo(f.x0, y)
  ctx.lineTo(f.x1, y)
  ctx.stroke()
  ctx.setLineDash([])
}

/** The cents grid: a faint line per tick, its label beside it at the left. */
export function drawCentsGrid(
  f: ChartFrame,
  ticks: readonly CentsTick[] = CENTS_TICKS,
): void {
  const { ctx } = f
  ctx.font = MONO
  ctx.textAlign = 'left'
  for (const t of ticks) {
    if (t.c < f.lo || t.c > f.hi) continue
    const y = yOf(f, t.c)
    // the centre is Merc's own line, drawn with the band
    if (t.c !== 0) hline(f, y, Math.abs(t.c) === 15 ? 0.1 : 0.16, true)
    if (t.label === '') continue
    const below = t.place === 'below'
    ctx.textBaseline = below ? 'top' : 'bottom'
    ctx.fillStyle = COLOR.ink3
    ctx.fillText(t.label, f.x0 + 4, below ? y + 3 : y - 2)
  }
}

/**
 * The notes grid, a tick per semitone from `target + lo` to `target + hi`:
 * letters on the natural notes, `named` notes (A3 and A4) in full.
 */
export function drawNotesGrid(
  f: ChartFrame,
  target: number,
  named: readonly number[],
): void {
  const { ctx } = f
  ctx.font = MONO
  ctx.textAlign = 'right'
  ctx.textBaseline = 'middle'
  const first = Math.ceil(f.lo / 100)
  const last = Math.floor(f.hi / 100)
  for (let s = first; s <= last; s++) {
    const midi = target + s
    const y = yOf(f, s * 100)
    const letter = letterOf(midi)
    hline(f, y, letter === null ? 0.06 : 0.12)
    if (letter === null) continue
    const full = named.includes(midi)
    ctx.fillStyle = full ? COLOR.ink : COLOR.ink3
    ctx.fillText(full ? (nameOf(midi) ?? letter) : letter, f.x0 - 8, y)
  }
}

/** One of Merc's bands: a note, its strip ±`half` cents, and how bright its line is. */
export interface BandSpec {
  readonly c: number
  readonly half: number
  /** An octave's echo of the note: drawn dashed. */
  readonly dashed?: boolean
  /** 0 at rest, 1 while Merc's note sounds. */
  readonly glow?: number
  /** Where it starts and ends across the canvas, px: a rung over its time slot. Default the plot's full width. */
  readonly x0?: number
  readonly x1?: number
}

/** Merc's band: an amber strip, its two edges, and Merc's steady line at its centre. */
export function drawBand(f: ChartFrame, b: BandSpec): void {
  const { ctx } = f
  const { x0 = f.x0, x1 = f.x1 } = b
  const glow = b.glow ?? 0
  const dashed = b.dashed === true
  const yTop = yOf(f, b.c + b.half)
  const yBot = yOf(f, b.c - b.half)
  const y = yOf(f, b.c)
  ctx.fillStyle = rgba(BAND_COLOR.target, dashed ? 0.07 : 0.13 + 0.07 * glow)
  ctx.fillRect(x0, yTop, x1 - x0, yBot - yTop)
  ctx.strokeStyle = rgba(BAND_COLOR.target, dashed ? 0.5 : 0.6)
  ctx.lineWidth = 1
  ctx.setLineDash(dashed ? [5, 4] : [])
  for (const yy of [yTop, yBot]) {
    ctx.beginPath()
    ctx.moveTo(x0, yy)
    ctx.lineTo(x1, yy)
    ctx.stroke()
  }
  // Merc's line, steady: the vibrato of his "ooh" is never drawn
  ctx.strokeStyle = BAND_COLOR.target
  ctx.globalAlpha = dashed ? 0.55 : 0.75 + 0.25 * glow
  ctx.lineWidth = 2 + glow
  ctx.beginPath()
  ctx.moveTo(x0, y)
  ctx.lineTo(x1, y)
  ctx.stroke()
  if (glow > 0) {
    ctx.globalAlpha = 0.18 * glow
    ctx.lineWidth = 12
    ctx.stroke()
  }
  ctx.globalAlpha = 1
  ctx.setLineDash([])
}

/** The band's lit edge, in mint, with the words beside it. */
export function drawLitEdge(f: ChartFrame, b: BandSpec): void {
  const { ctx } = f
  const { x0 = f.x0, x1 = f.x1 } = b
  const yTop = yOf(f, b.c + b.half)
  const yBot = yOf(f, b.c - b.half)
  ctx.strokeStyle = BAND_COLOR.mint
  ctx.lineWidth = 2
  for (const yy of [yTop, yBot]) {
    ctx.beginPath()
    ctx.moveTo(x0, yy)
    ctx.lineTo(x1, yy)
    ctx.stroke()
  }
  ctx.font = MONO
  ctx.fillStyle = BAND_COLOR.mint
  ctx.textAlign = 'right'
  ctx.textBaseline = 'bottom'
  ctx.fillText('IN THE BAND', x1 - 4, yTop - 3)
}

/** A point of the singer's line: seconds into the window, cents from Merc's note. */
export interface TracePoint {
  readonly t: number
  /** Null for a gap (no voice): the line breaks there. */
  readonly c: number | null
}

/**
 * The singer's line, violet. A point beyond the chart is pinned to its edge,
 * so a note far from Merc's still draws, along the top or the bottom.
 */
export function drawTrace(f: ChartFrame, points: readonly TracePoint[]): void {
  const { ctx } = f
  ctx.strokeStyle = BAND_COLOR.singer
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  for (const [width, alpha] of [
    [9, 0.14],
    [2.6, 1],
  ] as const) {
    ctx.lineWidth = width
    ctx.globalAlpha = alpha
    ctx.beginPath()
    let pen = false
    for (const p of points) {
      if (p.c === null) {
        pen = false
        continue
      }
      const x = xOf(f, p.t)
      const y = yOf(f, Math.min(Math.max(p.c, f.lo), f.hi))
      if (pen) ctx.lineTo(x, y)
      else ctx.moveTo(x, y)
      pen = true
    }
    ctx.stroke()
  }
  ctx.globalAlpha = 1
}

/** The line's head: a violet bead, and an arrow off the chart when the note is beyond it. */
export function drawHead(f: ChartFrame, t: number, c: number): void {
  const { ctx } = f
  const x = xOf(f, t)
  const over = c > f.hi ? 1 : c < f.lo ? -1 : 0
  const y = yOf(f, Math.min(Math.max(c, f.lo), f.hi))
  ctx.fillStyle = BAND_COLOR.singer
  ctx.beginPath()
  ctx.arc(x, y, 4.5, 0, TAU)
  ctx.fill()
  if (over === 0) return
  // an arrow pointing off the chart, the way the note went
  const tip = y - over * 11
  ctx.beginPath()
  ctx.moveTo(x, tip)
  ctx.lineTo(x - 6, tip + over * 8)
  ctx.lineTo(x + 6, tip + over * 8)
  ctx.closePath()
  ctx.fill()
}

/** The drag handle on the line's head: a ring the finger can find. */
export function drawHandle(f: ChartFrame, t: number, c: number): void {
  const { ctx } = f
  const x = xOf(f, t)
  const y = yOf(f, Math.min(Math.max(c, f.lo), f.hi))
  ctx.strokeStyle = BAND_COLOR.singer
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(x, y, 11, 0, TAU)
  ctx.stroke()
  ctx.fillStyle = rgba(BAND_COLOR.singer, 0.22)
  ctx.fill()
}

/** The playhead: where the line is now. */
export function drawPlayhead(f: ChartFrame, t: number): void {
  const { ctx } = f
  const x = xOf(f, t)
  ctx.strokeStyle = rgba(COLOR.chrome, 0.28)
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(x, f.top)
  ctx.lineTo(x, f.bottom)
  ctx.stroke()
}

/** A moment of the loop marked on the chart: "try", "compare". */
export interface ChartMark {
  readonly t: number
  readonly label: string
}

export function drawMark(f: ChartFrame, m: ChartMark): void {
  const { ctx } = f
  const x = xOf(f, m.t)
  ctx.strokeStyle = rgba(COLOR.chrome, 0.32)
  ctx.lineWidth = 1
  ctx.setLineDash([2, 4])
  ctx.beginPath()
  ctx.moveTo(x, f.top + 16)
  ctx.lineTo(x, f.bottom)
  ctx.stroke()
  ctx.setLineDash([])
  ctx.font = MONO
  ctx.fillStyle = COLOR.ink2
  const words = m.label.toUpperCase()
  let align: CanvasTextAlign = 'center'
  if (x > f.x1 - 60) align = 'right'
  // a mark at the very start (a hold that settled straight away) starts its
  // label there, where a centred one would run off the canvas
  else if (x - ctx.measureText(words).width / 2 < 0) align = 'left'
  ctx.textAlign = align
  ctx.textBaseline = 'top'
  ctx.fillText(words, x, f.top + 2)
}

/**
 * A label beside the line (its reading), above it or under it as the room
 * allows, and kept inside the plot: it starts at its point, or earlier when
 * it would run off the right.
 */
export function drawLineLabel(
  f: ChartFrame,
  t: number,
  c: number,
  text: string,
): void {
  const { ctx } = f
  const y = yOf(f, Math.min(Math.max(c, f.lo), f.hi))
  const below = y < f.top + 30
  const words = text.toUpperCase()
  ctx.font = MONO
  const room = f.x1 - ctx.measureText(words).width - 2
  ctx.fillStyle = BAND_COLOR.singer
  ctx.textAlign = 'left'
  ctx.textBaseline = below ? 'top' : 'bottom'
  ctx.fillText(
    words,
    Math.max(f.x0 + 2, Math.min(xOf(f, t), room)),
    below ? y + 8 : y - 8,
  )
}

/** A gold bracket between two bands: they fit, the same note an octave apart. */
export function drawOctaveBracket(
  f: ChartFrame,
  c0: number,
  c1: number,
  text: string,
): void {
  const { ctx } = f
  const x = f.x1 - 14
  const y0 = yOf(f, c0)
  const y1 = yOf(f, c1)
  ctx.strokeStyle = COLOR.gold
  ctx.lineWidth = 1.6
  ctx.beginPath()
  ctx.moveTo(x - 8, y0)
  ctx.lineTo(x, y0)
  ctx.lineTo(x, y1)
  ctx.lineTo(x - 8, y1)
  ctx.stroke()
  ctx.font = MONO
  ctx.fillStyle = COLOR.gold
  ctx.textAlign = 'right'
  ctx.textBaseline = 'middle'
  ctx.fillText(text.toUpperCase(), x - 12, (y0 + y1) / 2)
}
