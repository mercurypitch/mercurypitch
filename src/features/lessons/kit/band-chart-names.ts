// ============================================================
// Band chart rung names — a ladder's rows named in words
// ============================================================
//
// Lesson 9's ladder chart (WEB-SPEC, Toys 1) names each rung beside its row
// by its syllable and its spelled note, "so · A3", and no other row. The
// kit's notes grid letters every natural row and names its `named` notes in
// full (kit/band-chart-draw.ts), so a chart given rung names draws its rows
// without their letters and writes the names in their place. A name such
// as "top do · D4" is about twice as wide as the 40 px gutter, so the
// gutter widens to the longest name given, and only on a chart given names:
// Lessons 3 and 5's charts keep theirs. Names come with their painter
// (`rungNames`), in a module of their own, so that a lesson whose charts
// name no rungs never downloads it.

import type { ChartFrame } from './band-chart-draw'
import { MONO, yOf } from './band-chart-draw'
import { COLOR } from './notes'

/** A chart's rung names, as its notes axis takes them (`names`, kit/band-chart.ts). */
export interface RungNames {
  /** The gutter the names need at the plot's left, px: the widest, with room either side. */
  gutter(ctx: CanvasRenderingContext2D): number
  /** Writes each name beside its row, in the gutter, right-aligned as the grid's letters are. */
  paint(f: ChartFrame, target: number): void
}

/** Room either side of a name, px: the grid's letters end as far from the plot. */
const ROOM = 8

/**
 * Names for a ladder's rows, each a note (MIDI) and its words: so's "so ·
 * A3". The chart names those rows and no other, its letters off; a row
 * outside its window goes unnamed.
 */
export function rungNames(
  rungs: readonly (readonly [midi: number, name: string])[],
): RungNames {
  return {
    gutter(ctx) {
      ctx.font = MONO
      const widths = rungs.map(([, name]) => ctx.measureText(name).width)
      return Math.max(0, ...widths) + 2 * ROOM
    },
    paint(f, target) {
      const { ctx } = f
      ctx.font = MONO
      ctx.fillStyle = COLOR.ink
      ctx.textAlign = 'right'
      ctx.textBaseline = 'middle'
      for (const [midi, name] of rungs) {
        const c = (midi - target) * 100
        if (c < f.lo || c > f.hi) continue
        ctx.fillText(name, f.x0 - ROOM, yOf(f, c))
      }
    },
  }
}
