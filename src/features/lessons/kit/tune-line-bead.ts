// ============================================================
// Tune line bead — where a bead sits in its column, its pill, and one bead painted
// ============================================================
//
// The one shape every bead of a tune line takes, shared by the line's own
// painter (tune-line-draw.ts) and its parts' (tune-line-parts-draw.ts): a
// pill as wide as its column less a margin, centred on its pitch. A bead
// is filled, or hollow (a passing note: an outline, with no glow whatever
// lights it), and glows in a voice's colour while its note sounds.

import { COLOR, rgba } from './notes'
import type { LineBox } from './tune-line-layout'

/** The x of a note's bead centre on its line. */
export const beadX = (L: LineBox, i: number): number =>
  L.cols[i].x + L.cols[i].w / 2

/** A bead's pill: its column less a margin, centred on its pitch. */
export function pill(
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

/** The line through some of a line's beads, in order, under them: a part's, or a dressed tune's. */
export function strokeThrough(
  ctx: CanvasRenderingContext2D,
  L: LineBox,
  beads: readonly number[],
  y: (i: number) => number,
  color: string,
): void {
  if (beads.length < 2) return
  ctx.setLineDash([])
  ctx.strokeStyle = rgba(color, 0.5)
  ctx.lineWidth = 2
  ctx.lineJoin = 'round'
  ctx.beginPath()
  beads.forEach((i, n) => {
    if (n === 0) ctx.moveTo(beadX(L, i), y(i))
    else ctx.lineTo(beadX(L, i), y(i))
  })
  ctx.stroke()
}

/** How a bead is painted: its colour, hollow or filled, and its light while its note sounds. */
export interface BeadLook {
  readonly color: string
  readonly hollow: boolean
  readonly lit: { readonly amount: number; readonly color: string } | null
}

/** One bead: filled, or hollow (a passing note), lit while its note sounds. */
export function paintBead(
  ctx: CanvasRenderingContext2D,
  L: LineBox,
  i: number,
  y: number,
  look: BeadLook,
): void {
  pill(ctx, L, i, y)
  if (look.hollow) {
    // a passing note: an outline, with no glow, whatever lights it
    ctx.fillStyle = COLOR.bg
    ctx.fill()
    ctx.strokeStyle = rgba(look.color, 0.9)
    ctx.lineWidth = 1.6
    ctx.stroke()
    return
  }
  ctx.fillStyle = rgba(look.color, 0.82)
  ctx.fill()
  const lit = look.lit
  if (lit === null) return
  ctx.save()
  ctx.shadowColor = lit.color
  ctx.shadowBlur = 14 * lit.amount
  pill(ctx, L, i, y)
  ctx.fillStyle = rgba(lit.color, 0.35 + 0.65 * lit.amount)
  ctx.fill()
  ctx.restore()
}
