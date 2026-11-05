// ============================================================
// Lesson 17's lift — Step 4's line becoming Step 5's staff
// ============================================================
//
// As Step 5 opens, what Step 4's line holds moves onto the staff (WEB-SPEC,
// Toys 5): the line becomes the staff's middle line and the other four draw
// in around it, the clef and the bar lines draw in, and each symbol slides
// from its place on the line to its place on the staff, a note to A's line
// or space, over 0.6 s on the kit's expoOut. The staff is drawn where it
// ends; `liftPlan` says how far each part starts from there, from the two
// layouts, and `lift` marks the drawing so lesson-17.css runs the slide, at
// once under reduced motion or with Pause animations on.

import { qa } from '@/features/lessons/kit/dom'
import type { RhythmRow, RowLayout } from '@/features/lessons/kit/rhythm-draw'
import { layoutRhythm, STAFF_A, symbolX, xOf, } from '@/features/lessons/kit/rhythm-draw'
import type { PlacedSymbol } from '@/features/lessons/kit/rhythm-model'
import { BAR_BEATS, placeBars } from '@/features/lessons/kit/rhythm-model'
import type { Clef } from '@/features/lessons/kit/staff-places'
import { placeOf } from '@/features/lessons/kit/staff-places'
import { beamGroups } from '@/lib/ear/rhythm-notation'

/** How far a part starts from where the staff draws it, px. */
export interface Shift {
  readonly dx: number
  readonly dy: number
}

export interface LiftPlan {
  /** Each symbol's, in order. */
  readonly symbols: readonly Shift[]
  /** Each beam's, its first note's. */
  readonly beams: readonly Shift[]
  readonly metre: Shift
  /** The one line's height, where the staff's five lines start. */
  readonly lineY: number
}

/** A part with nowhere to slide from. */
const STILL: Shift = { dx: 0, dy: 0 }

/** A whole rest that fills its bar sits in the bar's middle; any other symbol at its anchor (kit/rhythm-draw.ts). */
function anchorX(row: RowLayout, p: PlacedSymbol): number {
  return p.kind === 'rest' && p.value >= 4 && p.beats >= BAR_BEATS
    ? (xOf(row, p.beat) + xOf(row, p.beat + p.beats)) / 2
    : symbolX(row, p)
}

/**
 * How far each part of a row on `clef`'s staff starts from where it is
 * drawn, so it starts where the one line drew it: a note from the line to
 * A3 or A4 (FACTS 29), a rest from the line to the middle line, a whole
 * rest to the line it hangs from, the 4/4 from beside the line to beside
 * the clef.
 */
export function liftPlan(
  rows: readonly RhythmRow[],
  clef: Clef,
  w: number,
  h: number,
): LiftPlan {
  const line = layoutRhythm(w, h, { staff: 'line', rows }).rows[0]
  const staff = layoutRhythm(w, h, { staff: clef, rows }).rows[0]
  const noteY = staff.y - ((placeOf(STAFF_A[clef], clef) - 4) * staff.space) / 2
  const placed = placeBars(rows[0].bars)
  const symbols = placed.map((p): Shift => {
    const hangs = p.kind === 'rest' && p.value >= 4
    const y =
      p.kind === 'note' ? noteY : hangs ? staff.y - staff.space : staff.y
    return { dx: anchorX(line, p) - anchorX(staff, p), dy: line.y - y }
  })
  return {
    symbols,
    beams: beamGroups(placed).map((g) => symbols[g.members[0]] ?? STILL),
    metre: {
      dx: line.x0 - line.space * 1.35 - (staff.x0 - staff.space * 1.4),
      dy: line.y - staff.y,
    },
    lineY: line.y,
  }
}

const setShift = (el: Element, s: Shift): void => {
  const style = (el as SVGElement).style
  style.setProperty('--lift-x', `${s.dx.toFixed(1)}px`)
  style.setProperty('--lift-y', `${s.dy.toFixed(1)}px`)
}

/**
 * Marks the staff `figure` draws to start from the line, and runs the
 * lift: each symbol, beam and the 4/4 from its shift, each staff line from
 * the one line, until `is-lifting` comes off after the slide.
 */
export function lift(figure: HTMLElement, plan: LiftPlan): void {
  const svgEl = figure.querySelector('svg')
  if (svgEl === null) return
  for (const g of qa('.rb-sym[data-i]', svgEl))
    setShift(g, plan.symbols[Number(g.dataset.i)] ?? STILL)
  qa('.rb-beam', svgEl).forEach((g, k) => setShift(g, plan.beams[k] ?? STILL))
  for (const g of qa('.rb-metre', svgEl)) setShift(g, plan.metre)
  for (const l of qa('.rb-staff[data-place]', svgEl))
    setShift(l, { dx: 0, dy: plan.lineY - Number(l.getAttribute('y1')) })
  figure.classList.remove('is-lifting')
  // a reflow, so a second lift starts again from the line
  void figure.offsetWidth
  figure.classList.add('is-lifting')
  window.setTimeout(() => figure.classList.remove('is-lifting'), 700)
}
