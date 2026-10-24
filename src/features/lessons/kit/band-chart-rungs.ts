// ============================================================
// Band chart rungs — Merc's notes as bands, over slots or across the plot
// ============================================================
//
// Lesson 9's ladder chart (WEB-SPEC, Toys 1): each of Merc's notes is a
// rung, the kit's band (kit/band-chart-draw.ts) at its cents from do, 35
// cents either side (Voice Mirror's hit band, kit/band-words.ts) with
// Merc's steady line at its centre. A rung over its own time slot makes a
// phrase read as a staircase of bands; one across the whole plot makes the
// ladder read as rows. Each rung has its own glow while Merc's note sounds
// and its own lit edge, "IN THE BAND", while the singer's line sits inside
// it; a rung before its turn is drawn faint, and drawn in full while it
// glows. A chart paints its scene's rungs in place of its one band when the
// page passes it `paintRungs` (kit/band-chart.ts), and one rung at 0 across
// the plot paints exactly that band. A module of its own, so that a lesson
// whose charts keep one band (Lessons 3 and 5) never downloads it.

import type { BandSpec, ChartFrame } from './band-chart-draw'
import { BAND_COLOR, drawBand, drawLitEdge, xOf, yOf } from './band-chart-draw'
import { HIT_TOLERANCE_CENTS } from './band-words'
import { rgba } from './notes'

/** One of Merc's notes on the chart. */
export interface Rung {
  /** Its note, in cents from the chart's target, do: 0, 400, 700, 1200. */
  readonly c: number
  /** Its time slot, seconds across the window; a rung without either end runs to the plot's edge. */
  readonly from?: number
  readonly to?: number
  /** 0 at rest, 1 while Merc's note sounds. */
  readonly glow?: number
  /** Its edge lit mint, with "IN THE BAND" beside it: the singer's line sits inside it. */
  readonly lit?: boolean
  /** Drawn faint while it rests: a rung before its turn. */
  readonly faint?: boolean
}

/** A rung as the kit's band: its note, Voice Mirror's hit band either side, over its slot. */
function bandOf(f: ChartFrame, r: Rung): BandSpec {
  return {
    c: r.c,
    half: HIT_TOLERANCE_CENTS,
    glow: r.glow,
    x0: r.from === undefined ? undefined : xOf(f, r.from),
    x1: r.to === undefined ? undefined : xOf(f, r.to),
  }
}

/**
 * A rung before its turn: the band's strip, its edges and Merc's line at
 * about half their strength at rest, his line thinner.
 */
function drawFaint(f: ChartFrame, b: BandSpec): void {
  const { ctx } = f
  const { x0 = f.x0, x1 = f.x1 } = b
  const yTop = yOf(f, b.c + b.half)
  const yBot = yOf(f, b.c - b.half)
  ctx.fillStyle = rgba(BAND_COLOR.target, 0.06)
  ctx.fillRect(x0, yTop, x1 - x0, yBot - yTop)
  ctx.setLineDash([])
  for (const [y, alpha, width] of [
    [yTop, 0.3, 1],
    [yBot, 0.3, 1],
    [yOf(f, b.c), 0.45, 1.5],
  ] as const) {
    ctx.strokeStyle = rgba(BAND_COLOR.target, alpha)
    ctx.lineWidth = width
    ctx.beginPath()
    ctx.moveTo(x0, y)
    ctx.lineTo(x1, y)
    ctx.stroke()
  }
}

/** A faint rung shows faint only while it rests: one that glows is sounding. */
const showsFaint = (r: Rung): boolean => r.faint === true && (r.glow ?? 0) <= 0

/**
 * Paints the scene's rungs: every band, then every lit edge, so that no
 * band covers a neighbour's edge or its words. A chart calls it in place of
 * its own band (`paintRungs`, kit/band-chart.ts): false for a scene with no
 * rungs, which keeps the band.
 */
export function paintRungs(
  f: ChartFrame,
  scene: { readonly rungs?: readonly Rung[] },
): boolean {
  const { rungs } = scene
  if (rungs === undefined) return false
  const bands = rungs.map((r) => bandOf(f, r))
  rungs.forEach((r, i) => {
    if (showsFaint(r)) drawFaint(f, bands[i])
    else drawBand(f, bands[i])
  })
  rungs.forEach((r, i) => {
    if (r.lit === true) drawLitEdge(f, bands[i])
  })
  return true
}
