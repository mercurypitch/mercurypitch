// ============================================================
// Lesson 10 chord beads painter — rows, halo, beads, names, gaps, bracket, strip and stairs
// ============================================================
//
// Paints one frame of the chord beads (WEB-SPEC, Toys 1) from a scene the
// toy keeps (chord-beads.ts): every place is already worked out, so this
// file only draws, each part in its own small function, in paint order.
// The series' colour code: every bead and stair is chrome, the one that is
// sounding ink and lit; gold marks only the chord's third, its bead and,
// spread into a scale, its stair, in both qualities (Look; FACTS 40). Major
// and minor are drawn alike: the change between them is the halo's light,
// the gap numbers and the chord's name, never a hue. Words are the scene's,
// signs allowed (the canvas is hidden from a screen reader, which hears
// the toy's buttons and its summary instead).

import { TAU } from '@/features/lessons/kit/dom'
import { COLOR, rgba } from '@/features/lessons/kit/notes'
import type { Rect } from '@/features/lessons/kit/tune-line-layout'
import type { ChordLayout } from './chord-layout'

/** A bead's radius, px: two beads a minor third apart, 45 px, never touch. */
export const BEAD_R = 11

/** The name strip's text, px: the compact strip is 14.5 px tall, so its text is 12 px (FACTS 82). */
export const STRIP_PX = { full: 14, compact: 12 } as const

/** One bead as this frame draws it. */
export interface BeadMark {
  readonly x: number
  readonly y: number
  /** Its name, drawn beside it: "E♭4", or "me" with the names switch on Do-re-mi. */
  readonly name: string
  /** Where its name sits, or null where no names are drawn. */
  readonly nameBox: Rect | null
  /** The chord's third (Look). */
  readonly gold: boolean
  /** 0 to 1 while its note sounds. */
  readonly lit: number
  /** 0 to 1: a stacked bead fades in as it drops. */
  readonly alpha: number
}

/** One stair of a spread scale. */
export interface StairMark {
  readonly box: Rect
  readonly name: string
  /** Mi's stair, or me's under Minor: the chord's third (Look). */
  readonly gold: boolean
  readonly lit: number
}

/** A gap button's face: its semitones and its word. */
export interface GapMark {
  readonly box: Rect
  readonly label: string
}

/** Everything one frame shows. */
export interface BeadsScene {
  /** The rows of the chord's drawing, and of the scale's, each with how much it shows (0 to 1). */
  readonly rows: readonly {
    readonly layout: ChordLayout
    readonly alpha: number
  }[]
  /** The chord's soft halo, and how brightly it glows (0 rest, up to 1 as a third lands). */
  readonly halo: { readonly box: Rect; readonly glow: number } | null
  readonly beads: readonly BeadMark[]
  readonly stairs: readonly StairMark[]
  /** 0 folded, 1 spread: the stairs rise with it, the chord's own parts fade. */
  readonly spread: number
  readonly gaps: readonly GapMark[]
  readonly bracket: {
    readonly box: Rect
    readonly label: readonly string[]
  } | null
  readonly strip: {
    readonly box: Rect
    readonly text: string
    /** Step 4's readout, what is set: "C minor · slow". */
    readonly readout: string | null
    /** Where the readout ends: the strip's right end, or the compact figure's top right corner. */
    readonly readoutX: number
    readonly compact: boolean
  } | null
}

const FONT = {
  name: (px: number): string => `600 ${px}px Outfit, sans-serif`,
  word: (px: number): string => `500 ${px}px Inter, sans-serif`,
}

function paintRows(ctx: CanvasRenderingContext2D, s: BeadsScene): void {
  ctx.lineWidth = 1
  for (const { layout: L, alpha } of s.rows) {
    if (alpha <= 0) continue
    ctx.strokeStyle = rgba(COLOR.chrome, 0.11 * alpha)
    ctx.beginPath()
    for (let m = Math.ceil(L.lo - 0.001); m <= L.hi + 0.001; m++) {
      const y = Math.round(L.yOf(m)) + 0.5
      ctx.moveTo(0, y)
      ctx.lineTo(L.width, y)
    }
    ctx.stroke()
  }
}

function paintHalo(ctx: CanvasRenderingContext2D, s: BeadsScene): void {
  const h = s.halo
  if (h === null) return
  const fade = 1 - s.spread
  if (fade <= 0) return
  const { x, y, w, h: hh } = h.box
  ctx.save()
  ctx.shadowColor = rgba(COLOR.ink, 0.5 * h.glow * fade)
  ctx.shadowBlur = 22 * h.glow
  ctx.fillStyle = rgba(COLOR.chrome, (0.04 + 0.1 * h.glow) * fade)
  ctx.beginPath()
  ctx.roundRect(x, y, w, hh, w / 2)
  ctx.fill()
  ctx.restore()
  ctx.strokeStyle = rgba(COLOR.chrome, (0.14 + 0.4 * h.glow) * fade)
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.roundRect(x + 0.5, y + 0.5, w - 1, hh - 1, w / 2)
  ctx.stroke()
}

/** A stair: its block, and its tread on top, as Lesson 4 draws a scale. */
function paintStair(
  ctx: CanvasRenderingContext2D,
  st: StairMark,
  amount: number,
): void {
  const inset = Math.min(3, st.box.w * 0.08)
  const x = st.box.x + inset
  const w = st.box.w - 2 * inset
  const { y, h } = st.box
  const tone = st.gold ? COLOR.gold : COLOR.chrome
  ctx.globalAlpha = amount
  ctx.fillStyle = rgba(tone, st.gold ? 0.14 : 0.1)
  ctx.fillRect(x, y, w, h)
  if (st.lit > 0) {
    ctx.fillStyle = rgba(COLOR.ink, 0.34 * st.lit)
    ctx.fillRect(x, y, w, h)
  }
  ctx.strokeStyle = rgba(tone, st.gold ? 0.5 : 0.22)
  ctx.lineWidth = 1
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1)
  ctx.fillStyle = st.lit > 0 ? COLOR.ink : rgba(tone, 0.85)
  ctx.fillRect(x, y, w, 3)
  ctx.globalAlpha = 1
}

function paintStairs(ctx: CanvasRenderingContext2D, s: BeadsScene): void {
  if (s.spread <= 0) return
  for (const st of s.stairs) {
    // the stairs rise from the foot as the chord spreads
    const h = st.box.h * s.spread
    const box = { ...st.box, y: st.box.y + st.box.h - h, h }
    paintStair(ctx, { ...st, box }, s.spread)
  }
  ctx.globalAlpha = s.spread
  ctx.font = FONT.name(12)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (const st of s.stairs) {
    ctx.fillStyle = st.lit > 0.3 ? '#ffffff' : COLOR.ink
    ctx.fillText(st.name, st.box.x + st.box.w / 2, st.box.y - BEAD_R - 6)
  }
  ctx.globalAlpha = 1
}

/** A bead: a lit sphere, chrome, gold for the third, or ink while it sounds. */
function paintBead(ctx: CanvasRenderingContext2D, b: BeadMark): void {
  if (b.alpha <= 0) return
  const rest = b.gold ? COLOR.gold : COLOR.chrome
  const tone = b.lit > 0 ? COLOR.ink : rest
  ctx.save()
  ctx.globalAlpha = b.alpha
  if (b.lit > 0) {
    ctx.shadowColor = COLOR.ink
    ctx.shadowBlur = 16 * b.lit
  }
  const g = ctx.createRadialGradient(
    b.x - BEAD_R * 0.35,
    b.y - BEAD_R * 0.35,
    BEAD_R * 0.1,
    b.x,
    b.y,
    BEAD_R,
  )
  g.addColorStop(0, '#ffffff')
  g.addColorStop(0.45, tone)
  g.addColorStop(1, b.gold && b.lit === 0 ? '#8a6d10' : '#4a5563')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(b.x, b.y, BEAD_R, 0, TAU)
  ctx.fill()
  ctx.restore()
}

function paintNames(ctx: CanvasRenderingContext2D, s: BeadsScene): void {
  const fade = 1 - s.spread
  if (fade <= 0) return
  ctx.font = FONT.name(14)
  ctx.textAlign = 'right'
  ctx.textBaseline = 'middle'
  for (const b of s.beads) {
    if (b.nameBox === null) continue
    ctx.globalAlpha = fade * b.alpha
    ctx.fillStyle = b.lit > 0.3 ? '#ffffff' : COLOR.ink
    const box = b.nameBox
    ctx.fillText(b.name, box.x + box.w - 4, box.y + box.h / 2 + 1)
  }
  ctx.globalAlpha = 1
}

function paintGaps(ctx: CanvasRenderingContext2D, s: BeadsScene): void {
  const fade = 1 - s.spread
  if (fade <= 0 || s.gaps.length === 0) return
  ctx.globalAlpha = fade
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (const g of s.gaps) {
    const { x, y, w, h } = g.box
    ctx.strokeStyle = rgba(COLOR.chrome, 0.22)
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.roundRect(x + 0.5, y + 4.5, w - 1, h - 9, 8)
    ctx.stroke()
    ctx.font = FONT.word(12)
    ctx.fillStyle = COLOR.ink
    ctx.fillText(g.label, x + w / 2, y + h / 2 + 1)
  }
  ctx.globalAlpha = 1
}

function paintBracket(ctx: CanvasRenderingContext2D, s: BeadsScene): void {
  const b = s.bracket
  const fade = 1 - s.spread
  if (b === null || fade <= 0) return
  const { x, y, w, h } = b.box
  const line = x + w - 6
  ctx.globalAlpha = fade
  ctx.strokeStyle = rgba(COLOR.chrome, 0.7)
  ctx.lineWidth = 1.4
  ctx.beginPath()
  ctx.moveTo(line + 5, y)
  ctx.lineTo(line, y)
  ctx.lineTo(line, y + h)
  ctx.lineTo(line + 5, y + h)
  ctx.stroke()
  ctx.textAlign = 'right'
  ctx.textBaseline = 'middle'
  const mid = y + h / 2
  const lead = 14
  b.label.forEach((part, i) => {
    ctx.font = i === 0 ? FONT.name(15) : FONT.word(11)
    ctx.fillStyle = i === 0 ? COLOR.ink : COLOR.ink2
    ctx.fillText(part, line - 6, mid + (i - (b.label.length - 1) / 2) * lead)
  })
  ctx.globalAlpha = 1
}

function paintStrip(ctx: CanvasRenderingContext2D, s: BeadsScene): void {
  const st = s.strip
  const fade = 1 - s.spread
  if (st === null || fade <= 0) return
  const { x, y, w, h } = st.box
  const px = st.compact ? STRIP_PX.compact : STRIP_PX.full
  const mid = y + h / 2 + 1
  ctx.globalAlpha = fade
  ctx.textBaseline = 'middle'
  ctx.font = FONT.name(px)
  ctx.fillStyle = COLOR.ink
  if (st.compact) {
    ctx.textAlign = 'left'
    ctx.fillText(st.text, x + 4, mid)
  } else {
    ctx.strokeStyle = rgba(COLOR.chrome, 0.12)
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(x, Math.round(y) + 0.5)
    ctx.lineTo(x + w, Math.round(y) + 0.5)
    ctx.stroke()
    ctx.textAlign = st.readout === null ? 'center' : 'left'
    ctx.fillText(st.text, st.readout === null ? x + w / 2 : x + 14, mid)
  }
  if (st.readout !== null) {
    ctx.textAlign = 'right'
    ctx.font = FONT.word(px)
    ctx.fillStyle = COLOR.ink2
    ctx.fillText(st.readout, st.readoutX, mid)
  }
  ctx.globalAlpha = 1
}

/** One frame of the chord beads, in paint order. */
export function paintBeads(ctx: CanvasRenderingContext2D, s: BeadsScene): void {
  paintRows(ctx, s)
  paintHalo(ctx, s)
  paintStairs(ctx, s)
  paintBracket(ctx, s)
  for (const b of s.beads) paintBead(ctx, b)
  paintNames(ctx, s)
  paintGaps(ctx, s)
  paintStrip(ctx, s)
}
