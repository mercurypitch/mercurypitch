// ============================================================
// Tune line painter — rows, beads, the line, its names, gaps and brackets
// ============================================================
//
// Paints one frame of a tune line from its layout (tune-line-layout.ts) and
// a scene the core keeps (tune-line.ts). The series' colour code: every
// bead is chrome until a voice lights it, blue where Merc sings it and
// orange where Tavi does; gold marks only the gap numbers that stay
// the same as the line lands from a slide, glowing once; the contrast case
// (Lesson 6's swapped version) is dashed ink-2 with a "?", since violet is
// the singer's in the app's canvas set. Step and leap are words beside the
// numbers, never a colour alone. Each part draws in its own small function,
// in paint order.

import { COLOR, rgba } from './notes'
import type { LineBox, TuneLayout } from './tune-line-layout'
import { pitchY } from './tune-line-layout'

/** A bead's light: how strongly (0 to 1) and in whose colour. */
export interface BeadLight {
  readonly amount: number
  readonly color: string
}

/** What a gap's label says: its size ("7", "−2") over its word ("leap"). */
export interface GapWords {
  readonly size: string
  readonly word: string
}

/** A bracket over a named gap: "P5 · 7". */
export interface TuneBracket {
  readonly gap: number
  readonly label: string
}

/** The contrast case drawn over the first line, dashed, with its changed gaps marked. */
export interface OverlayScene {
  /** Its pitches, note by note. */
  readonly pitches: readonly number[]
  /** 0 to 1 as it fades in. */
  readonly amount: number
  /** The gaps whose size it changes, each with the size it has instead. */
  readonly changed: readonly { readonly gap: number; readonly size: string }[]
}

/** Everything a frame shows that the layout does not decide. */
export interface TuneScene {
  /** Each shown line's pitches, note by note (fractional while a slide travels). */
  readonly lines: readonly (readonly number[])[]
  /** The global index of each shown line's first note (gap g runs from note g to g + 1). */
  readonly first: readonly number[]
  /** Each band's pitch window, low and high (fractional while stacked rows scroll). */
  readonly windows: readonly (readonly [number, number])[]
  /** The name under note g, or null for no names strip. */
  readonly name: ((g: number) => string) | null
  /** What the strip under the names holds. */
  readonly below: 'marks' | 'gaps' | null
  readonly gapWords: (g: number) => GapWords
  /** Contour marks: the move at gap g. */
  readonly move: (g: number) => 'up' | 'down' | 'same'
  readonly brackets: readonly TuneBracket[]
  /** The first line at a start kept for comparison, drawn faint (one line only), or null. */
  readonly ghost: readonly number[] | null
  readonly overlay: OverlayScene | null
  readonly light: (g: number, overlay: boolean) => BeadLight | null
  /** 0 to 1: the line lifted off its rows while a slide travels. */
  readonly lift: number
  /** 0 to 1: the gap numbers' gold glow as a slide lands. */
  readonly glow: number
}

const FONT = {
  name: (px: number): string => `600 ${px}px Outfit, sans-serif`,
  size: (px: number): string => `600 ${px}px Outfit, sans-serif`,
  word: (px: number): string => `500 ${px}px Inter, sans-serif`,
  mono: (px: number): string => `500 ${px}px "JetBrains Mono", monospace`,
  serif: (px: number): string => `400 ${px}px "Instrument Serif", serif`,
}

/** The x of a note's bead centre on its line. */
const beadX = (L: LineBox, i: number): number => L.cols[i].x + L.cols[i].w / 2

/** A bead's pill: its column less a margin, centred on its pitch. */
function pill(
  ctx: CanvasRenderingContext2D,
  L: LineBox,
  i: number,
  y: number,
): void {
  const col = L.cols[i]
  const inset = Math.min(8, col.w * 0.16)
  const w = Math.max(10, col.w - 2 * inset)
  const r = L.bead / 2
  ctx.beginPath()
  ctx.roundRect(col.x + (col.w - w) / 2, y - r, w, L.bead, r)
}

function paintRows(
  ctx: CanvasRenderingContext2D,
  T: TuneLayout,
  s: TuneScene,
): void {
  ctx.lineWidth = 1
  T.lines.forEach((L, k) => {
    const [lo, hi] = s.windows[k]
    ctx.strokeStyle = rgba(COLOR.chrome, 0.11 * (1 - 0.55 * s.lift))
    ctx.beginPath()
    for (let m = Math.ceil(lo - 0.001); m <= hi + 0.001; m++) {
      const y = Math.round(pitchY(L, hi, m)) + 0.5
      ctx.moveTo(0, y)
      ctx.lineTo(T.width, y)
    }
    ctx.stroke()
  })
}

/** The line through the beads' centres, then the beads, one line of the tune. */
function paintLine(
  ctx: CanvasRenderingContext2D,
  L: LineBox,
  hi: number,
  pitches: readonly number[],
  look: { stroke: string; fill: string; dash?: number[]; width: number },
): void {
  ctx.setLineDash(look.dash ?? [])
  ctx.strokeStyle = look.stroke
  ctx.lineWidth = look.width
  ctx.lineJoin = 'round'
  ctx.beginPath()
  pitches.forEach((p, i) => {
    const x = beadX(L, i)
    const y = pitchY(L, hi, p)
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  })
  ctx.stroke()
  pitches.forEach((p, i) => {
    pill(ctx, L, i, pitchY(L, hi, p))
    ctx.fillStyle = look.fill
    if (look.dash === undefined) ctx.fill()
    else ctx.stroke()
  })
  ctx.setLineDash([])
}

function paintGhost(
  ctx: CanvasRenderingContext2D,
  T: TuneLayout,
  s: TuneScene,
): void {
  if (s.ghost === null) return
  const L = T.lines[0]
  paintLine(ctx, L, s.windows[0][1], s.ghost, {
    stroke: rgba(COLOR.chrome, 0.16),
    fill: rgba(COLOR.chrome, 0.12),
    width: 1.5,
  })
}

/** The tune's own beads, each lit while its note sounds, the line lifted while it travels. */
function paintBeads(
  ctx: CanvasRenderingContext2D,
  T: TuneLayout,
  s: TuneScene,
): void {
  T.lines.forEach((L, k) => {
    const hi = s.windows[k][1]
    const pitches = s.lines[k]
    if (s.lift > 0) {
      ctx.save()
      ctx.shadowColor = 'rgba(0,0,0,.65)'
      ctx.shadowBlur = 18 * s.lift
      ctx.shadowOffsetY = 8 * s.lift
    }
    paintLine(ctx, L, hi, pitches, {
      stroke: rgba(COLOR.chrome, 0.5),
      fill: rgba(COLOR.chrome, 0.82),
      width: 2,
    })
    if (s.lift > 0) ctx.restore()
    pitches.forEach((p, i) => {
      const lit = s.light(s.first[k] + i, false)
      if (lit === null) return
      const y = pitchY(L, hi, p)
      ctx.save()
      ctx.shadowColor = lit.color
      ctx.shadowBlur = 14 * lit.amount
      pill(ctx, L, i, y)
      ctx.fillStyle = rgba(lit.color, 0.35 + 0.65 * lit.amount)
      ctx.fill()
      ctx.restore()
    })
  })
}

function paintOverlay(
  ctx: CanvasRenderingContext2D,
  T: TuneLayout,
  s: TuneScene,
): void {
  const o = s.overlay
  if (o === null || o.amount <= 0) return
  const L = T.lines[0]
  const hi = s.windows[0][1]
  ctx.globalAlpha = o.amount
  paintLine(ctx, L, hi, o.pitches, {
    stroke: COLOR.ink2,
    fill: COLOR.ink2,
    dash: [5, 5],
    width: 1.8,
  })
  o.pitches.forEach((p, i) => {
    const lit = s.light(i, true)
    if (lit === null) return
    pill(ctx, L, i, pitchY(L, hi, p))
    ctx.fillStyle = rgba(COLOR.ink2, 0.25 + 0.5 * lit.amount)
    ctx.fill()
  })
  // the "?" by the swapped version's highest bead
  const top = o.pitches.reduce((a, p, i) => (p > o.pitches[a] ? i : a), 0)
  ctx.font = FONT.serif(24)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = COLOR.ink2
  const col = L.cols[top]
  ctx.fillText(
    '?',
    col.x + col.w - Math.min(14, col.w * 0.3),
    pitchY(L, hi, o.pitches[top]) - L.bead / 2 - 4,
  )
  ctx.globalAlpha = 1
}

function paintNames(
  ctx: CanvasRenderingContext2D,
  T: TuneLayout,
  s: TuneScene,
): void {
  const name = s.name
  if (name === null) return
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  T.lines.forEach((L, k) => {
    if (L.namesY === null) return
    const y = L.namesY
    L.cols.forEach((col, i) => {
      const g = s.first[k] + i
      const lit = (s.light(g, false)?.amount ?? 0) > 0.3
      ctx.font = FONT.name(col.w < 50 ? 14 : 15)
      ctx.fillStyle = lit ? '#ffffff' : COLOR.ink
      ctx.fillText(name(g), col.x + col.w / 2, y + 1)
    })
  })
}

/** An arrow for a contour mark: up, down, or a level dash for the same note. */
function moveGlyph(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  move: 'up' | 'down' | 'same',
): void {
  ctx.beginPath()
  if (move === 'same') {
    ctx.moveTo(x - 7, y)
    ctx.lineTo(x + 7, y)
  } else {
    const d = move === 'up' ? -1 : 1
    ctx.moveTo(x, y - 6 * d)
    ctx.lineTo(x, y + 6 * d)
    ctx.moveTo(x - 4.5, y + 1.5 * d)
    ctx.lineTo(x, y + 6 * d)
    ctx.lineTo(x + 4.5, y + 1.5 * d)
  }
  ctx.stroke()
}

/** The small return arrow at a join, from the end of one line towards the next. */
function joinArrow(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.beginPath()
  ctx.moveTo(x, y - 6)
  ctx.lineTo(x, y + 2)
  ctx.lineTo(x - 9, y + 2)
  ctx.moveTo(x - 6, y - 1.5)
  ctx.lineTo(x - 9, y + 2)
  ctx.lineTo(x - 6, y + 5.5)
  ctx.stroke()
}

/** The middle of the j-th gap's label: its button's middle, or the gap itself without a strip. */
function gapCentre(T: TuneLayout, j: number): number {
  const gap = T.gaps[j]
  const t = gap.target ?? gap.bracket
  return t === null ? gap.x : t.x + t.w / 2
}

function paintBelow(
  ctx: CanvasRenderingContext2D,
  T: TuneLayout,
  s: TuneScene,
): void {
  if (s.below === null) return
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  const changed = new Map((s.overlay?.changed ?? []).map((c) => [c.gap, c]))
  T.gaps.forEach((gap, j) => {
    const L = T.lines[gap.line]
    if (L.below === null) return
    // gaps count from the first shown note, as the notes do
    const g = s.first[0] + j
    const top = L.below.top
    // a join's label leaves the strip's last few pixels to its return arrow
    const x = gapCentre(T, j) - (gap.join ? 5 : 0)
    if (s.below === 'marks') {
      const move = s.move(g)
      ctx.strokeStyle = COLOR.ink2
      ctx.lineWidth = 1.6
      moveGlyph(ctx, x, top + 13, move)
      ctx.font = FONT.word(12)
      ctx.fillStyle = COLOR.ink3
      ctx.fillText(move, x, top + 32)
      return
    }
    const words = s.gapWords(g)
    const swapped = changed.get(g)
    const amount = swapped === undefined ? 0 : (s.overlay?.amount ?? 0)
    ctx.font = FONT.size(15)
    ctx.fillStyle = rgba(COLOR.ink, 1 - 0.6 * amount)
    ctx.fillText(words.size, x, top + 15)
    if (s.glow > 0) {
      // the fit: the same number, in gold, glowing once as the line lands
      ctx.save()
      ctx.shadowColor = COLOR.gold
      ctx.shadowBlur = 10 * s.glow
      ctx.fillStyle = rgba(COLOR.gold, s.glow)
      ctx.fillText(words.size, x, top + 15)
      ctx.restore()
    }
    ctx.font = FONT.word(12)
    ctx.fillStyle = COLOR.ink3
    ctx.fillText(words.word, x, top + 32)
    if (gap.join) {
      ctx.strokeStyle = COLOR.ink3
      ctx.lineWidth = 1.3
      joinArrow(ctx, T.width - 6, top + 15)
    }
    if (swapped !== undefined && amount > 0) {
      ctx.globalAlpha = amount
      ctx.setLineDash([3, 3])
      ctx.strokeStyle = COLOR.ink2
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.roundRect(x + 9, top + 4, 20, 20, 5)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.font = FONT.size(13)
      ctx.fillStyle = COLOR.ink2
      ctx.fillText(swapped.size, x + 19, top + 15)
      ctx.globalAlpha = 1
    }
  })
}

function paintBrackets(
  ctx: CanvasRenderingContext2D,
  T: TuneLayout,
  s: TuneScene,
): void {
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (const b of s.brackets) {
    const j = b.gap - s.first[0]
    const gap = T.gaps[j] as (typeof T.gaps)[number] | undefined
    if (gap === undefined || gap.join) continue
    const k = gap.line
    const L = T.lines[k]
    if (L.above === null) continue
    const i = b.gap - s.first[k]
    const xa = beadX(L, i)
    const xb = beadX(L, i + 1)
    const y = L.above.bottom - 6
    ctx.strokeStyle = rgba(COLOR.chrome, 0.7)
    ctx.lineWidth = 1.4
    ctx.beginPath()
    ctx.moveTo(xa, y + 4)
    ctx.lineTo(xa, y)
    ctx.lineTo(xb, y)
    ctx.lineTo(xb, y + 4)
    ctx.stroke()
    ctx.font = FONT.mono(12)
    ctx.fillStyle = COLOR.ink
    ctx.fillText(b.label, gapCentre(T, j), L.above.top + 15)
  }
}

/** One frame of the tune line, in paint order. */
export function paintTune(
  ctx: CanvasRenderingContext2D,
  T: TuneLayout,
  s: TuneScene,
): void {
  paintRows(ctx, T, s)
  paintGhost(ctx, T, s)
  paintBeads(ctx, T, s)
  paintOverlay(ctx, T, s)
  paintNames(ctx, T, s)
  paintBelow(ctx, T, s)
  paintBrackets(ctx, T, s)
}
