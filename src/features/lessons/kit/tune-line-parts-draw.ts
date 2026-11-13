// ============================================================
// Tune line parts painter — lanes, the house, a held chord, a part beside the tune, and brackets between them
// ============================================================
//
// Paints what a shape's dress adds to Lesson 6's tune line
// (tune-line-parts.ts), each in a small function, in paint order, around
// the line's own painter (tune-line-draw.ts). The series' colour code: a
// part's beads are chrome until a voice lights them, blue where Merc sings
// and orange where Tavi does; gold is the fit, a held chord's lanes and a
// chord note's glow as it sounds, and nothing else; a passing note's bead
// is hollow, so colour never carries its meaning alone. A name inside a
// bead and a bracket's label are ink; a line's label is a quiet mono tag
// by its first bead.

import { drawHome } from './home-glyph'
import { COLOR, rgba } from './notes'
import { beadX, paintBead, strokeThrough } from './tune-line-bead'
import type { LineBox, TuneLayout } from './tune-line-layout'
import { pitchY } from './tune-line-layout'
import type { DressFrame, DressPainter, DressScene } from './tune-line-parts'
import { pcOf } from './tune-line-parts'

const MONO = (px: number): string => `600 ${px}px "JetBrains Mono", monospace`
const WORD = (px: number): string => `500 ${px}px Inter, sans-serif`

/**
 * The bar under a band that names a held chord: its gap below the band,
 * clear of a line's label under the band's lowest bead, and its height.
 */
export const CHORD_BAR = { gap: 20, h: 22 } as const

/** The key's lanes, a step brighter than the other rows, and a held chord's, glowing gold. */
export function paintLanes(
  ctx: CanvasRenderingContext2D,
  T: TuneLayout,
  s: DressFrame,
): void {
  const d = s.dress
  if (d === null || (d.lanes.size === 0 && d.chord === null)) return
  const chord = new Set(d.chord?.pcs ?? [])
  T.lines.forEach((L, k) => {
    const [lo, hi] = s.windows[k]
    const x0 = L.cols[0]?.x ?? 0
    for (let m = Math.ceil(lo - 0.001); m <= hi + 0.001; m++) {
      const pc = pcOf(m)
      const glow = chord.has(pc)
      if (!glow && !d.lanes.has(pc)) continue
      const y = Math.round(pitchY(L, hi, m)) + 0.5
      ctx.strokeStyle = glow ? rgba(COLOR.gold, 0.38) : rgba(COLOR.chrome, 0.3)
      ctx.lineWidth = glow ? 1.6 : 1
      ctx.beginPath()
      ctx.moveTo(x0, y)
      ctx.lineTo(T.width, y)
      ctx.stroke()
    }
  })
}

/** Lesson 4's house on do, at the left of its row in every band that holds it. */
export function paintHouse(
  ctx: CanvasRenderingContext2D,
  T: TuneLayout,
  s: DressFrame,
): void {
  const house = s.dress?.house ?? null
  if (house === null) return
  T.lines.forEach((L, k) => {
    const [lo, hi] = s.windows[k]
    const gutter = L.cols[0]?.x ?? 0
    if (house < lo - 0.001 || house > hi + 0.001 || gutter < 12) return
    drawHome(
      ctx,
      gutter / 2,
      pitchY(L, hi, house),
      Math.min(16, gutter - 4),
      COLOR.ink2,
    )
  })
}

/** A held chord's bar at the foot of each band, its name on it. */
export function paintChordBar(
  ctx: CanvasRenderingContext2D,
  T: TuneLayout,
  s: DressFrame,
): void {
  const chord = s.dress?.chord ?? null
  if (chord === null) return
  for (const L of T.lines) {
    const x0 = L.cols[0]?.x ?? 0
    const last = L.cols[L.cols.length - 1]
    const x1 = last === undefined ? T.width : last.x + last.w
    const y = L.bandBottom + CHORD_BAR.gap
    ctx.beginPath()
    ctx.roundRect(x0 + 2, y, x1 - x0 - 4, CHORD_BAR.h, 6)
    ctx.fillStyle = rgba(COLOR.gold, 0.08)
    ctx.fill()
    ctx.strokeStyle = rgba(COLOR.gold, 0.45)
    ctx.lineWidth = 1
    ctx.stroke()
    ctx.font = WORD(12)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = COLOR.ink2
    ctx.fillText(chord.name, (x0 + x1) / 2, y + CHORD_BAR.h / 2 + 0.5)
  }
}

/** A name inside a bead: a note off the lanes, "C♯". */
function paintBeadName(
  ctx: CanvasRenderingContext2D,
  L: LineBox,
  i: number,
  y: number,
  name: string,
): void {
  ctx.font = MONO(Math.min(11, Math.max(9, L.bead * 0.68)))
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = COLOR.bg
  ctx.fillText(name, beadX(L, i), y + 0.5)
}

/** Each part: its line, its beads, their lights and the names inside them. */
export function paintParts(
  ctx: CanvasRenderingContext2D,
  T: TuneLayout,
  s: DressFrame,
): void {
  for (const p of s.dress?.parts ?? []) {
    const L = T.lines[p.band] as LineBox | undefined
    if (L === undefined) continue
    const hi = s.windows[p.band][1]
    const y = (i: number): number => pitchY(L, hi, p.pitches[i])
    if (p.joined) strokeThrough(ctx, L, p.beads, y, p.color)
    for (const i of p.beads) {
      paintBead(ctx, L, i, y(i), {
        color: p.color,
        hollow: p.hollow.has(i),
        lit: p.light(i),
      })
      const name = p.names[i] ?? null
      if (name !== null) paintBeadName(ctx, L, i, y(i), name)
    }
  }
}

/** A bracket between the tune's bead and a part's at a note, its label between them. */
export function paintPairBrackets(
  ctx: CanvasRenderingContext2D,
  T: TuneLayout,
  s: DressFrame,
): void {
  for (const p of s.dress?.parts ?? []) {
    const L = T.lines[p.band] as LineBox | undefined
    const tune = s.lines[p.band] as readonly number[] | undefined
    if (L === undefined || tune === undefined) continue
    const hi = s.windows[p.band][1]
    for (const i of p.beads) {
      const label = p.brackets[i] ?? null
      if (label === null || tune[i] === undefined) continue
      const ys = [pitchY(L, hi, tune[i]), pitchY(L, hi, p.pitches[i])]
      paintPairBracket(ctx, T, L, i, ys, label)
    }
  }
}

/** One bracket, at note i between two beads at `ys`, and its label; none where the beads touch. */
function paintPairBracket(
  ctx: CanvasRenderingContext2D,
  T: TuneLayout,
  L: LineBox,
  i: number,
  ys: readonly number[],
  label: string,
): void {
  const top = Math.min(...ys) + L.bead / 2 + 2
  const bottom = Math.max(...ys) - L.bead / 2 - 2
  if (bottom - top < 4) return
  const col = L.cols[i]
  const x = col.x + Math.min(7, col.w * 0.14)
  ctx.strokeStyle = rgba(COLOR.chrome, 0.7)
  ctx.lineWidth = 1.3
  ctx.beginPath()
  ctx.moveTo(x + 4, top)
  ctx.lineTo(x, top)
  ctx.lineTo(x, bottom)
  ctx.lineTo(x + 4, bottom)
  ctx.stroke()
  paintBracketLabel(ctx, T, L, i, { x, y: (top + bottom) / 2 }, label)
}

/**
 * A bracket's label: a number centred in its column, between the two
 * beads; words beside the bracket, to its right, or to its left where the
 * right runs out of room (Step 1's pair high up the scale).
 */
function paintBracketLabel(
  ctx: CanvasRenderingContext2D,
  T: TuneLayout,
  L: LineBox,
  i: number,
  at: { readonly x: number; readonly y: number },
  label: string,
): void {
  ctx.textBaseline = 'middle'
  ctx.fillStyle = COLOR.ink
  if (label.length <= 2) {
    ctx.font = MONO(12)
    ctx.textAlign = 'center'
    ctx.fillText(label, beadX(L, i), at.y)
    return
  }
  ctx.font = MONO(11)
  const right = at.x + 8 + ctx.measureText(label).width <= T.width - 2
  ctx.textAlign = right ? 'left' : 'right'
  ctx.fillText(label, right ? at.x + 8 : at.x - 4, at.y)
}

/** Each line's label by its first shown bead: above it for the higher line, below for the lower. */
export function paintLabels(
  ctx: CanvasRenderingContext2D,
  T: TuneLayout,
  s: DressFrame,
): void {
  const d = s.dress
  if (d === null) return
  ctx.font = MONO(10)
  ctx.textAlign = 'left'
  T.lines.forEach((L, k) => {
    const hi = s.windows[k][1]
    const tune = s.lines[k]
    const parts = d.parts.filter((p) => p.band === k && p.beads.length > 0)
    const first = (pitches: readonly number[], i: number): number =>
      pitchY(L, hi, pitches[i])
    // the bead shown alone, by its place on this line, or the first
    const tuneAt = d.only === null ? 0 : Math.max(0, d.only - s.first[k])
    const tuneY = first(tune, Math.min(tuneAt, tune.length - 1))
    const label = (
      text: string,
      i: number,
      y: number,
      above: boolean,
    ): void => {
      const col = L.cols[i]
      ctx.textBaseline = above ? 'bottom' : 'top'
      ctx.fillStyle = COLOR.ink3
      ctx.fillText(
        text,
        col.x + Math.min(8, col.w * 0.16),
        above ? y - L.bead / 2 - 3 : y + L.bead / 2 + 3,
      )
    }
    for (const p of parts) {
      if (p.label === '') continue
      const i = p.beads[0]
      const y = first(p.pitches, i)
      label(p.label, i, y, y <= tuneY)
    }
    if (d.label !== null) {
      const partY =
        parts.length > 0
          ? first(parts[0].pitches, parts[0].beads[0])
          : tuneY + 1
      label(d.label, Math.min(tuneAt, L.cols.length - 1), tuneY, tuneY < partY)
    }
  })
}

/** A dressed tune's own beads: in the dress's colour, hollow where it says, or one bead alone with no line. */
export function paintDressedBeads(
  ctx: CanvasRenderingContext2D,
  T: TuneLayout,
  s: DressFrame,
  d: DressScene,
): void {
  T.lines.forEach((L, k) => {
    const hi = s.windows[k][1]
    const pitches = s.lines[k]
    const shown = pitches
      .map((_, i) => i)
      .filter((i) => d.only === null || s.first[k] + i === d.only)
    const y = (i: number): number => pitchY(L, hi, pitches[i])
    // one bead alone has no line; each bead painted once, in the dress's colour
    if (d.only === null) strokeThrough(ctx, L, shown, y, d.color)
    for (const i of shown)
      paintBead(ctx, L, i, y(i), {
        color: d.color,
        hollow: d.hollow.has(s.first[k] + i),
        lit: s.light(s.first[k] + i, false),
      })
  })
}

/** The dress's painter, which a line that draws a dressed shape is given (tune-line.ts `dressPainter`). */
export const DRESS: DressPainter = {
  under(ctx, T, s) {
    paintLanes(ctx, T, s)
    paintChordBar(ctx, T, s)
    paintHouse(ctx, T, s)
  },
  beads(ctx, T, s) {
    if (s.dress !== null) paintDressedBeads(ctx, T, s, s.dress)
  },
  over(ctx, T, s) {
    paintParts(ctx, T, s)
    paintPairBrackets(ctx, T, s)
    paintLabels(ctx, T, s)
  },
}
