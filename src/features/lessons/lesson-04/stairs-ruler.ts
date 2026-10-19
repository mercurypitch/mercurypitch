// ============================================================
// Lesson 4 staircase ruler — the semitone rows and the pitch ruler beside them
// ============================================================
//
// Pitch is height: a faint row a semitone, behind the stairs, and a ruler
// at the left with a tick a semitone and each C named. On the desktop the
// rows stay put while the staircase climbs them; on a phone they scroll
// with the start, and a C's name gives way where do's name and house sit
// low at the left.

import { COLOR, isBlack, nameOf, rgba } from '@/features/lessons/kit/notes'
import type { StairsLayout } from './stairs-geometry'

const MONO_11 = '500 11px "JetBrains Mono", monospace'

/** The faint semitone rows, the black keys' a shade darker, each C a touch brighter. */
export function paintRows(
  ctx: CanvasRenderingContext2D,
  L: StairsLayout,
): void {
  ctx.save()
  ctx.beginPath()
  ctx.rect(L.x0, L.rowsTop, L.x1 - L.x0, L.rowsBottom - L.rowsTop)
  ctx.clip()
  for (const m of L.rows) {
    const y = L.yOfRow(m)
    if (isBlack(m)) {
      ctx.fillStyle = 'rgba(0,0,0,0.22)'
      ctx.fillRect(L.x0, y - L.rowH / 2, L.x1 - L.x0, L.rowH)
    }
    ctx.strokeStyle = rgba(COLOR.chrome, m % 12 === 0 ? 0.14 : 0.06)
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(L.x0, Math.round(y + L.rowH / 2) + 0.5)
    ctx.lineTo(L.x1, Math.round(y + L.rowH / 2) + 0.5)
    ctx.stroke()
  }
  ctx.restore()
}

/** Whether a ruler label at row `m` stays clear of the stairs on a phone (do's name and house sit low at the left). */
const clearOfDo = (L: StairsLayout, m: number, view: number): boolean =>
  L.mode !== 'narrow' || m - view >= 2.5

/** A ruler tick: long at a C, short at a black key; `edge` 0 draws it from the left. */
function paintTick(
  ctx: CanvasRenderingContext2D,
  y: number,
  m: number,
  edge: number,
): void {
  const c = m % 12 === 0
  const len = c ? 9 : isBlack(m) ? 3 : 5
  const from = edge === 0 ? 0 : edge - len
  ctx.strokeStyle = rgba(COLOR.chrome, c ? 0.55 : 0.25)
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(from, y)
  ctx.lineTo(from + len, y)
  ctx.stroke()
}

/** A C's name beside its tick. */
function paintCName(
  ctx: CanvasRenderingContext2D,
  y: number,
  m: number,
  edge: number,
): void {
  const left = edge === 0
  ctx.fillStyle = COLOR.ink3
  ctx.font = MONO_11
  ctx.textBaseline = 'middle'
  ctx.textAlign = left ? 'left' : 'right'
  ctx.fillText(nameOf(m) ?? '', left ? 12 : edge - 12, y)
}

/** The pitch ruler: a tick a semitone, the Cs named; on a phone it scrolls. */
export function paintRuler(
  ctx: CanvasRenderingContext2D,
  L: StairsLayout,
  view: number,
): void {
  if (L.mode === 'compact') return
  const wide = L.mode === 'wide'
  const edge = wide ? 40 : 0
  ctx.save()
  ctx.beginPath()
  ctx.rect(0, L.rowsTop, wide ? L.x0 : L.W, L.rowsBottom - L.rowsTop)
  ctx.clip()
  for (const m of L.rows) {
    const y = L.yOfRow(m)
    paintTick(ctx, y, m, edge)
    if (m % 12 === 0 && clearOfDo(L, m, view)) paintCName(ctx, y, m, edge)
  }
  ctx.restore()
}
