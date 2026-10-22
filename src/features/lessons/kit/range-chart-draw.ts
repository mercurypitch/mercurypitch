// ============================================================
// Range chart drawing — rows, the column, lines, beads, bands and bars
// ============================================================
//
// The painters behind kit/range-chart.ts, each over one frame's geometry
// (kit/range-chart-layout.ts). The colours are the app's pitch-canvas set
// (Lesson 7 WEB-SPEC, Look): a model Merc sings is target amber, the
// singer's own line violet and nothing else is, gold marks a fit once. The
// lit middle is ink at low opacity with the word "middle", the dimmed ends
// the room's dark under a fine hatch with the words "the ends": lit and
// dimmed are always words and pattern as well as brightness. The voice
// types and a singer's range are chrome outlines with ink words, never a
// colour. A shaded seam (Lesson 11, a register's change of gear) is a
// band across the plot under a coarser hatch, with its own words.

import { clamp, TAU } from './dom'
import { COLOR, letterOf, octaveOf, rgba } from './notes'
import type { RangeFrame } from './range-chart-layout'
import { bandColumns, rowHeight, spanY, xOfT, yOf } from './range-chart-layout'

/** The app's pitch-canvas colours (src/features/stem-mixer/pitch-canvas-visuals.ts). */
export const RANGE_COLOR = {
  target: '#f59e0b',
  singer: '#a78bfa',
} as const

const MONO = '500 12px "JetBrains Mono", monospace'
const MONO_SM = '500 11px "JetBrains Mono", monospace'

/** A frame and the context to paint it on. */
export type DrawFrame = RangeFrame & { readonly ctx: CanvasRenderingContext2D }

/** A span of notes, MIDI, low to high. */
export interface NoteSpan {
  readonly lo: number
  readonly hi: number
}

/** The column: two octaves, its middle lit, its ends dimmed. */
export interface RangeColumn extends NoteSpan {
  readonly lit: NoteSpan | null
  /** The lit middle's word (default "middle"). */
  readonly litLabel?: string
  /** The dimmed ends' words (default "the ends"). */
  readonly endsLabel?: string
}

/** A point of a line: seconds across the time area, and a note (fractional), or null for a gap. */
export interface LinePoint {
  readonly t: number
  readonly midi: number | null
}

/** A sung line: Merc's siren, or the singer's. */
export interface RangeLine {
  readonly points: readonly LinePoint[]
  readonly color: string
  /** How strongly it is drawn, 0 to 1 (default 1): Merc's shape behind a take is faint. */
  readonly alpha?: number
  /** The head, its newest point, glowing 0 to 1; beyond the window it is an arrow off the chart. */
  readonly head?: {
    readonly t: number
    readonly midi: number
    readonly glow: number
  } | null
}

/** A tune's note: when it starts, its note, and whether it is sounding. */
export interface RangeBead {
  readonly t: number
  readonly midi: number
  readonly lit?: boolean
}

/** The gold bracket beside the column, joining a tune's lowest note to its highest. */
export interface RangeBracket extends NoteSpan {
  readonly label?: string
}

/** A voice type drawn as a column of its own, its name and span running up it. */
export interface RangeBand extends NoteSpan {
  readonly name: string
  readonly span: string
  /** Pressed: drawn brighter, with its middle note marked. */
  readonly on?: boolean
}

/** One voice's range as a bar, its comfortable stretch lit, with words beside it. */
export interface RangeBar extends NoteSpan {
  readonly lit: NoteSpan | null
  readonly lines: readonly string[]
}

/** A seam: a band across the plot, shaded, with words (Lesson 11's change of gear). */
export interface RangeSeam extends NoteSpan {
  readonly label?: string
}

/** A lit stretch of the window with the rest dimmed, and its words: a reading. */
export interface RangeWash extends NoteSpan {
  readonly label: string
}

function hatch(
  f: DrawFrame,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  step: number,
  alpha: number,
): void {
  const { ctx } = f
  ctx.save()
  ctx.beginPath()
  ctx.rect(x0, y0, x1 - x0, y1 - y0)
  ctx.clip()
  ctx.strokeStyle = rgba(COLOR.chrome, alpha)
  ctx.lineWidth = 1
  ctx.beginPath()
  for (let x = x0 - (y1 - y0); x < x1; x += step) {
    ctx.moveTo(x, y1)
    ctx.lineTo(x + (y1 - y0), y0)
  }
  ctx.stroke()
  ctx.restore()
}

/** Text turned to run up the page, centred on (x, y). */
function upright(
  f: DrawFrame,
  text: string,
  x: number,
  y: number,
  color: string,
  font = MONO_SM,
): void {
  const { ctx } = f
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(-Math.PI / 2)
  ctx.font = font
  ctx.fillStyle = color
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, 0, 0)
  ctx.restore()
}

/** One faint row per semitone with a tick, the C and A rows named in the gutter. */
export function drawRows(f: DrawFrame, names: boolean): void {
  const { ctx } = f
  ctx.font = MONO_SM
  ctx.textAlign = 'right'
  ctx.textBaseline = 'middle'
  ctx.lineWidth = 1
  for (let m = f.lo; m <= f.hi; m++) {
    const y = Math.round(yOf(f, m)) + 0.5
    const letter = letterOf(m)
    const named = letter === 'C' || letter === 'A'
    ctx.strokeStyle = rgba(COLOR.chrome, named ? 0.13 : 0.06)
    ctx.beginPath()
    ctx.moveTo(f.x0, y)
    ctx.lineTo(f.x1, y)
    ctx.stroke()
    if (!names) continue
    ctx.strokeStyle = rgba(COLOR.chrome, named ? 0.5 : 0.22)
    ctx.beginPath()
    ctx.moveTo(f.x0 - (named ? 5 : 3), y)
    ctx.lineTo(f.x0, y)
    ctx.stroke()
    if (!named) continue
    ctx.fillStyle = COLOR.ink3
    ctx.fillText(`${letter}${octaveOf(m)}`, f.x0 - 7, y)
  }
}

type Band = { y0: number; y1: number }

/** The column's dimmed ends: its outer stretches beyond the lit middle, or all of it. */
function endsOf(whole: Band, lit: Band | null): [number, number][] {
  return lit === null
    ? [[whole.y0, whole.y1]]
    : [
        [whole.y0, lit.y0],
        [lit.y1, whole.y1],
      ]
}

/**
 * Beside a bar, the ends and the middle carry on faintly across the time
 * area, so a line is seen turning round inside the middle.
 */
function drawAcross(
  f: DrawFrame,
  ends: readonly [number, number][],
  lit: Band | null,
): void {
  if (f.tX1 <= f.tX0) return
  for (const [y0, y1] of ends)
    if (y1 > y0) hatch(f, f.tX0, f.tX1, y0, y1, 9, 0.055)
  if (lit === null) return
  f.ctx.fillStyle = rgba(COLOR.ink, 0.035)
  f.ctx.fillRect(f.tX0, lit.y0, f.tX1 - f.tX0, lit.y1 - lit.y0)
}

/** The lit middle inside the column, edged above and below. */
function drawLit(f: DrawFrame, x0: number, x1: number, lit: Band): void {
  const { ctx } = f
  ctx.fillStyle = rgba(COLOR.ink, 0.16)
  ctx.fillRect(x0, lit.y0, x1 - x0, lit.y1 - lit.y0)
  ctx.strokeStyle = rgba(COLOR.ink, 0.55)
  ctx.lineWidth = 1
  for (const y of [lit.y0, lit.y1]) {
    ctx.beginPath()
    ctx.moveTo(x0, Math.round(y) + 0.5)
    ctx.lineTo(x1, Math.round(y) + 0.5)
    ctx.stroke()
  }
}

/**
 * The column's words: "middle" in the lit stretch, across a compact column
 * or up a bar, and "the ends" where there is room, in a compact column at
 * its left, beside a bar at the time area's right.
 */
function drawColumnWords(
  f: DrawFrame,
  c: RangeColumn,
  wide: boolean,
  lit: Band | null,
  ends: readonly [number, number][],
): void {
  const { ctx } = f
  const x0 = f.colX0
  const litWord = c.litLabel ?? 'middle'
  if (lit !== null && wide) {
    ctx.font = MONO_SM
    ctx.fillStyle = COLOR.ink2
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    ctx.fillText(litWord, x0 + 6, lit.y0 + 4)
  } else if (lit !== null)
    upright(f, litWord, (x0 + f.colX1) / 2, (lit.y0 + lit.y1) / 2, COLOR.ink2)
  ctx.font = MONO_SM
  ctx.fillStyle = COLOR.ink3
  ctx.textBaseline = 'middle'
  ctx.textAlign = wide ? 'left' : 'right'
  const x = wide ? x0 + 6 : f.tX1 - 2
  const endsWord = c.endsLabel ?? 'the ends'
  for (const [y0, y1] of ends)
    if (y1 - y0 >= 14) ctx.fillText(endsWord, x, (y0 + y1) / 2)
}

/** The column as a bar at the plot's left, or filling it; its middle lit and labelled, its ends hatched. */
export function drawColumn(f: DrawFrame, c: RangeColumn, wide: boolean): void {
  const { ctx } = f
  const whole = spanY(f, c.lo, c.hi)
  const x0 = f.colX0
  const x1 = f.colX1
  ctx.fillStyle = rgba(COLOR.ink, 0.035)
  ctx.fillRect(x0, whole.y0, x1 - x0, whole.y1 - whole.y0)
  const lit = c.lit === null ? null : spanY(f, c.lit.lo, c.lit.hi)
  const ends = endsOf(whole, lit)
  for (const [y0, y1] of ends) if (y1 > y0) hatch(f, x0, x1, y0, y1, 6, 0.2)
  if (!wide) drawAcross(f, ends, lit)
  if (lit !== null) drawLit(f, x0, x1, lit)
  ctx.strokeStyle = rgba(COLOR.chrome, 0.45)
  ctx.lineWidth = 1
  ctx.strokeRect(
    Math.round(x0) + 0.5,
    Math.round(whole.y0) + 0.5,
    Math.round(x1 - x0) - 1,
    Math.round(whole.y1 - whole.y0) - 1,
  )
  drawColumnWords(f, c, wide, lit, ends)
}

/** A seam across the plot, shaded, its words at the right. */
export function drawSeam(f: DrawFrame, s: RangeSeam): void {
  const { ctx } = f
  const { y0, y1 } = spanY(f, s.lo, s.hi)
  ctx.fillStyle = rgba(COLOR.chrome, 0.08)
  ctx.fillRect(f.x0, y0, f.x1 - f.x0, y1 - y0)
  hatch(f, f.x0, f.x1, y0, y1, 4, 0.12)
  if (s.label === undefined) return
  ctx.font = MONO_SM
  ctx.fillStyle = COLOR.ink2
  ctx.textAlign = 'right'
  ctx.textBaseline = 'bottom'
  ctx.fillText(s.label, f.x1 - 4, y0 - 2)
}

/** A reading's lit stretch across the plot, the rest dimmed; a stretch beyond the window is a strip along its edge. */
export function drawWash(f: DrawFrame, w: RangeWash): void {
  const { ctx } = f
  const below = w.hi < f.lo
  const above = w.lo > f.hi
  let { y0, y1 } = spanY(f, clamp(w.lo, f.lo, f.hi), clamp(w.hi, f.lo, f.hi))
  if (below) y0 = f.bottom - 6
  if (above) y1 = f.top + 6
  if (below) y1 = f.bottom
  if (above) y0 = f.top
  ctx.fillStyle = 'rgba(8, 11, 16, 0.5)'
  ctx.fillRect(f.x0, f.top, f.x1 - f.x0, Math.max(0, y0 - f.top))
  ctx.fillRect(f.x0, y1, f.x1 - f.x0, Math.max(0, f.bottom - y1))
  ctx.fillStyle = rgba(COLOR.ink, 0.15)
  ctx.fillRect(f.x0, y0, f.x1 - f.x0, y1 - y0)
  ctx.strokeStyle = rgba(COLOR.ink, 0.6)
  ctx.lineWidth = 1
  for (const y of [y0, y1]) {
    ctx.beginPath()
    ctx.moveTo(f.x0, Math.round(y) + 0.5)
    ctx.lineTo(f.x1, Math.round(y) + 0.5)
    ctx.stroke()
  }
  // the cut side's arrow, and the words beside the band
  const cutTop = w.hi > f.hi
  const cutBottom = w.lo < f.lo
  ctx.fillStyle = COLOR.ink
  if (cutTop) arrow(f, f.x1 - 14, f.top + 2, -1)
  if (cutBottom) arrow(f, f.x1 - 14, f.bottom - 2, 1)
  ctx.font = MONO_SM
  ctx.fillStyle = COLOR.ink
  ctx.textAlign = 'right'
  ctx.textBaseline = above ? 'top' : 'bottom'
  const ty = above ? y1 + 3 : y0 - 3
  ctx.fillText(w.label, f.x1 - (cutTop || cutBottom ? 26 : 4), ty)
}

/** A small arrow pointing off the chart, up (-1) or down (1), its tip at (x, y). */
function arrow(f: DrawFrame, x: number, y: number, way: -1 | 1): void {
  const { ctx } = f
  ctx.beginPath()
  ctx.moveTo(x, y)
  ctx.lineTo(x - 5, y - way * 7)
  ctx.lineTo(x + 5, y - way * 7)
  ctx.closePath()
  ctx.fill()
}

/** The note a line point is drawn at: beyond the window, pinned to its edge. */
const pinned = (f: DrawFrame, midi: number): number =>
  clamp(midi, f.lo - 0.5, f.hi + 0.5)

/** A sung line with its glow, pinned to the edge where it leaves the window, and its head. */
export function drawLine(f: DrawFrame, line: RangeLine): void {
  const { ctx } = f
  const alpha = line.alpha ?? 1
  ctx.strokeStyle = line.color
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  for (const [width, a] of [
    [10, 0.13],
    [2.6, 1],
  ] as const) {
    ctx.lineWidth = width
    ctx.globalAlpha = a * alpha
    tracePath(f, line.points)
    ctx.stroke()
  }
  ctx.globalAlpha = 1
  if (line.head !== undefined && line.head !== null)
    drawHead(f, line.head, line.color, alpha)
}

/** A line's points as one path, lifting the pen over a gap (a point with no note). */
function tracePath(f: DrawFrame, points: readonly LinePoint[]): void {
  const { ctx } = f
  ctx.beginPath()
  let pen = false
  for (const p of points) {
    if (p.midi === null) {
      pen = false
      continue
    }
    const x = xOfT(f, p.t)
    const y = yOf(f, pinned(f, p.midi))
    if (pen) ctx.lineTo(x, y)
    else ctx.moveTo(x, y)
    pen = true
  }
}

/** A line's head: a dot, glowing as it asks, and an arrow off the chart beyond the window. */
function drawHead(
  f: DrawFrame,
  head: NonNullable<RangeLine['head']>,
  color: string,
  alpha: number,
): void {
  const { ctx } = f
  const x = xOfT(f, head.t)
  const over = head.midi > f.hi + 0.5 ? -1 : head.midi < f.lo - 0.5 ? 1 : 0
  const y = yOf(f, pinned(f, head.midi))
  if (head.glow > 0) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, 18)
    g.addColorStop(0, rgba(color, 0.55 * head.glow))
    g.addColorStop(1, rgba(color, 0))
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(x, y, 18, 0, TAU)
    ctx.fill()
  }
  ctx.fillStyle = color
  ctx.globalAlpha = alpha
  ctx.beginPath()
  ctx.arc(x, y, 4.5, 0, TAU)
  ctx.fill()
  if (over !== 0)
    arrow(f, x, over < 0 ? f.top - 1 : f.bottom + 1, over < 0 ? -1 : 1)
  ctx.globalAlpha = 1
}

/** A tune's beads across the time area, joined by a faint line, a sounding bead lit. */
export function drawBeads(
  f: DrawFrame,
  beads: readonly RangeBead[],
  color: string,
): void {
  if (beads.length === 0) return
  const { ctx } = f
  const r = clamp(rowHeight(f) * 0.62, 3.5, 6.5)
  const at = beads.map((b) => ({
    x: xOfT(f, b.t),
    y: yOf(f, pinned(f, b.midi)),
    lit: b.lit === true,
  }))
  ctx.strokeStyle = rgba(color, 0.45)
  ctx.lineWidth = 1.5
  ctx.beginPath()
  at.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)))
  ctx.stroke()
  for (const p of at) {
    if (p.lit) {
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 3)
      g.addColorStop(0, rgba(color, 0.6))
      g.addColorStop(1, rgba(color, 0))
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(p.x, p.y, r * 3, 0, TAU)
      ctx.fill()
    }
    ctx.fillStyle = p.lit ? '#fff4dc' : color
    ctx.beginPath()
    ctx.arc(p.x, p.y, r, 0, TAU)
    ctx.fill()
  }
}

/** The gold bracket from a tune's lowest note to its highest, beside the column. */
export function drawBracket(f: DrawFrame, b: RangeBracket): void {
  const { ctx } = f
  const x = f.colX1 + 9
  const y0 = yOf(f, b.hi)
  const y1 = yOf(f, b.lo)
  ctx.strokeStyle = COLOR.gold
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(x - 5, y0)
  ctx.lineTo(x, y0)
  ctx.lineTo(x, y1)
  ctx.lineTo(x - 5, y1)
  ctx.stroke()
  if (b.label === undefined) return
  ctx.font = MONO_SM
  ctx.fillStyle = COLOR.gold
  upright(f, b.label, x + 8, (y0 + y1) / 2, COLOR.gold)
}

/** The voice types as columns side by side, each its name and span running up it. */
export function drawBands(f: DrawFrame, bands: readonly RangeBand[]): void {
  const { ctx } = f
  const cols = bandColumns(f, bands.length)
  bands.forEach((b, i) => {
    const { x0, x1 } = cols[i]
    const { y0, y1 } = spanY(f, b.lo, b.hi)
    const on = b.on === true
    ctx.fillStyle = rgba(COLOR.chrome, on ? 0.2 : 0.06)
    ctx.fillRect(x0 + 3, y0, x1 - x0 - 6, y1 - y0)
    ctx.strokeStyle = rgba(COLOR.chrome, on ? 0.95 : 0.5)
    ctx.lineWidth = on ? 1.6 : 1
    ctx.strokeRect(x0 + 3.5, y0 + 0.5, x1 - x0 - 7, y1 - y0 - 1)
    const cx = (x0 + x1) / 2
    const cy = (y0 + y1) / 2
    upright(f, b.name, cx - 7, cy, on ? COLOR.ink : COLOR.ink2)
    upright(f, b.span, cx + 7, cy, COLOR.ink3)
  })
}

/** A voice's range bar, its comfortable stretch lit, its words beside the lit stretch. */
export function drawBar(f: DrawFrame, bar: RangeBar): void {
  const { ctx } = f
  const x0 = f.x0 + 14
  const x1 = x0 + 40
  const whole = spanY(f, bar.lo, bar.hi)
  ctx.fillStyle = rgba(COLOR.chrome, 0.06)
  ctx.fillRect(x0, whole.y0, x1 - x0, whole.y1 - whole.y0)
  ctx.strokeStyle = rgba(COLOR.chrome, 0.7)
  ctx.lineWidth = 1
  ctx.strokeRect(x0 + 0.5, whole.y0 + 0.5, x1 - x0 - 1, whole.y1 - whole.y0 - 1)
  let mid = (whole.y0 + whole.y1) / 2
  if (bar.lit !== null) {
    const lit = spanY(f, bar.lit.lo, bar.lit.hi)
    ctx.fillStyle = rgba(COLOR.ink, 0.28)
    ctx.fillRect(x0 + 1, lit.y0, x1 - x0 - 2, lit.y1 - lit.y0)
    ctx.strokeStyle = rgba(COLOR.ink, 0.8)
    for (const y of [lit.y0, lit.y1]) {
      ctx.beginPath()
      ctx.moveTo(x0, Math.round(y) + 0.5)
      ctx.lineTo(x1 + 8, Math.round(y) + 0.5)
      ctx.stroke()
    }
    mid = (lit.y0 + lit.y1) / 2
  }
  ctx.font = MONO
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  const lh = 17
  const top = mid - ((bar.lines.length - 1) * lh) / 2
  bar.lines.forEach((text, i) => {
    ctx.fillStyle = i === 0 ? COLOR.ink : COLOR.ink2
    ctx.fillText(text, x1 + 14, top + i * lh)
  })
}

/** A note on the column, as a bead with a soft glow: Step 4's push note. */
export function drawNote(f: DrawFrame, midi: number): void {
  const { ctx } = f
  const x = (f.colX0 + f.colX1) / 2
  const y = yOf(f, midi)
  const g = ctx.createRadialGradient(x, y, 0, x, y, 16)
  g.addColorStop(0, rgba(COLOR.ink, 0.45))
  g.addColorStop(1, rgba(COLOR.ink, 0))
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(x, y, 16, 0, TAU)
  ctx.fill()
  ctx.fillStyle = COLOR.ink
  ctx.beginPath()
  ctx.arc(x, y, 6.5, 0, TAU)
  ctx.fill()
}

/** Where a line is now, a faint upright rule. */
export function drawPlayhead(f: DrawFrame, t: number): void {
  const { ctx } = f
  const x = Math.round(xOfT(f, t)) + 0.5
  ctx.strokeStyle = rgba(COLOR.ink, 0.22)
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(x, f.top)
  ctx.lineTo(x, f.bottom)
  ctx.stroke()
}
