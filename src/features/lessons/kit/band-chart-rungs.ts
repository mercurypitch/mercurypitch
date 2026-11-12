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
// it, the words kept inside the plot over a slot too narrow for them; a
// rung before its turn is drawn faint, and drawn in full while it glows.
// A chart paints its scene's rungs in place of its one band when the page
// passes it `paintRungs` (kit/band-chart.ts), and one rung at 0 across the
// plot paints exactly that band. A module of its own, so that a lesson
// whose charts keep one band (Lessons 3 and 5) never downloads it.
//
// Merc's leaps, the scene's arcs (kit/band-chart-arcs.ts), are drawn over
// every band and under every lit edge.
//
// Lesson 20's run draws its rungs in the bead style (its WEB-SPEC, Toys 5;
// `beads`): a bead on Merc's steady line at the start of each slot, and,
// for a run sung joined, the string from bead to bead. A bead swells and
// glows with its rung while Merc's note sounds and shows its rung's label,
// its sung name, over the band only then; a faint rung's bead is faint. The
// slots follow the tempo (`slotsAt`): a note every so many seconds, each
// the slot's length, or Staccato's 0.15 s with the gap after it and no
// string. An illustrated singer's line is the scene's own line, drawn over
// the beads as any singer's line is. Over a fast run's narrow slots two lit
// edges on one row would print their words over each other: the later
// keeps its edges and leaves its words to the earlier's. A sounding bead's
// label is written before any, so a lit edge's words leave it its place.

import type { Arc } from './band-chart-arcs'
import { drawArcs } from './band-chart-arcs'
import type { BandSpec, ChartFrame } from './band-chart-draw'
import { BAND_COLOR, drawBand, drawLitEdge, MONO, xOf, yOf, } from './band-chart-draw'
import { HIT_TOLERANCE_CENTS } from './band-words'
import { rgba } from './notes'

/** One of Merc's notes on the chart. */
export interface Rung {
  /** Its sung name, shown over its bead while it glows (the bead style). */
  readonly label?: string
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

/** The bead style: a bead at the start of each slot, joined by the string unless the run is staccato. */
export interface Beads {
  /** The string from bead to bead: the run sung joined. */
  readonly string: boolean
}

/** Each of `count` notes' slots at a tempo, from 0: a note every `slotSec`, each `holdSec` long (the slot unless staccato). */
export const slotsAt = (
  count: number,
  slotSec: number,
  holdSec = slotSec,
): { from: number; to: number }[] =>
  Array.from({ length: count }, (_, i) => ({
    from: i * slotSec,
    to: i * slotSec + holdSec,
  }))

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

/** The words beside a lit edge, as the band's (`drawLitEdge`). */
const IN_THE_BAND = 'IN THE BAND'

/** Rows of words closer than this, px, are one row (the mono face's line). */
const WORDS_ROW = 12

/** Where a lit slot's words were written: their two ends and their baseline, px. */
interface Words {
  readonly x0: number
  readonly x1: number
  readonly y: number
}

/** Whether words at `w` would print over any already written. */
const over = (written: readonly Words[], w: Words): boolean =>
  written.some(
    (o) => Math.abs(o.y - w.y) < WORDS_ROW && o.x0 < w.x1 && w.x0 < o.x1,
  )

/**
 * A rung's lit edge over its slot, in mint, as the band's (`drawLitEdge`),
 * and its words: they end at the slot's end where they would still start
 * inside the plot, and further right where they would not, so that over a
 * narrow slot they run neither into the gutter's letters nor off the canvas.
 * Words that would print over words already `written` are left out.
 */
function drawLitSlot(f: ChartFrame, b: BandSpec, written: Words[]): void {
  const { ctx } = f
  const { x0 = f.x0, x1 = f.x1 } = b
  const yTop = yOf(f, b.c + b.half)
  ctx.strokeStyle = BAND_COLOR.mint
  ctx.lineWidth = 2
  for (const y of [yTop, yOf(f, b.c - b.half)]) {
    ctx.beginPath()
    ctx.moveTo(x0, y)
    ctx.lineTo(x1, y)
    ctx.stroke()
  }
  ctx.font = MONO
  ctx.fillStyle = BAND_COLOR.mint
  ctx.textAlign = 'right'
  ctx.textBaseline = 'bottom'
  const width = ctx.measureText(IN_THE_BAND).width
  const right = Math.min(f.x1, Math.max(x1 - 4, f.x0 + 2 + width))
  const words = { x0: right - width, x1: right, y: yTop - 3 }
  if (over(written, words)) return
  written.push(words)
  ctx.fillText(IN_THE_BAND, right, words.y)
}

/** A faint rung shows faint only while it rests: one that glows is sounding. */
const showsFaint = (r: Rung): boolean => r.faint === true && (r.glow ?? 0) <= 0

/** A bead's radius at rest, and how much it swells while its note sounds, px. */
const BEAD_R = 4.5
const BEAD_SWELL = 2

/** Where a slotted rung's bead sits: its slot's start, on Merc's steady line; none across the plot. */
const beadAt = (f: ChartFrame, r: Rung): { x: number; y: number } | null =>
  r.from === undefined ? null : { x: xOf(f, r.from), y: yOf(f, r.c) }

/** The string from bead to bead, under the beads. */
function drawString(f: ChartFrame, rungs: readonly Rung[]): void {
  const at = rungs.flatMap((r) => beadAt(f, r) ?? [])
  if (at.length < 2) return
  const { ctx } = f
  ctx.strokeStyle = rgba(BAND_COLOR.target, 0.55)
  ctx.lineWidth = 1.5
  ctx.beginPath()
  at.forEach((p, i) => {
    if (i === 0) ctx.moveTo(p.x, p.y)
    else ctx.lineTo(p.x, p.y)
  })
  ctx.stroke()
}

/** A rung's bead: faint before its turn, swelling with a halo while it glows, its label over the band then, whose place it gives (null for none). */
function drawBead(f: ChartFrame, r: Rung): Words | null {
  const at = beadAt(f, r)
  if (at === null) return null
  const { ctx } = f
  const glow = r.glow ?? 0
  const radius = BEAD_R + BEAD_SWELL * glow
  if (glow > 0) {
    ctx.fillStyle = rgba(BAND_COLOR.target, 0.25 * glow)
    ctx.beginPath()
    ctx.arc(at.x, at.y, radius * 2.2, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.fillStyle = rgba(BAND_COLOR.target, showsFaint(r) ? 0.5 : 1)
  ctx.beginPath()
  ctx.arc(at.x, at.y, radius, 0, Math.PI * 2)
  ctx.fill()
  if (glow <= 0 || r.label === undefined) return null
  ctx.font = MONO
  ctx.fillStyle = BAND_COLOR.target
  ctx.textAlign = 'center'
  ctx.textBaseline = 'bottom'
  const y = yOf(f, r.c + HIT_TOLERANCE_CENTS) - 3
  ctx.fillText(r.label, at.x, y)
  const half = ctx.measureText(r.label).width / 2
  return { x0: at.x - half, x1: at.x + half, y }
}

/**
 * Paints the scene's rungs: every band, then Merc's arcs, then in the bead
 * style the string and the beads, then every lit edge, so that no band
 * covers an arc, a bead, a neighbour's edge or its words. A chart calls it
 * in place of its own band (`paintRungs`, kit/band-chart.ts): false for a
 * scene with no rungs, which keeps the band.
 */
export function paintRungs(
  f: ChartFrame,
  scene: {
    readonly rungs?: readonly Rung[]
    readonly arcs?: readonly Arc[]
    readonly beads?: Beads | null
  },
): boolean {
  const { rungs } = scene
  if (rungs === undefined) return false
  // the singer's line leaves its caps and joins round for the next frame
  // (drawTrace), and a round cap reaches past a rung's slot by half its
  // stroke: a glow by 6 px, into the gutter's letters
  f.ctx.lineCap = 'butt'
  f.ctx.lineJoin = 'miter'
  const bands = rungs.map((r) => bandOf(f, r))
  rungs.forEach((r, i) => {
    if (showsFaint(r)) drawFaint(f, bands[i])
    else drawBand(f, bands[i])
  })
  if (scene.arcs !== undefined) drawArcs(f, scene.arcs)
  const { beads } = scene
  const written: Words[] = []
  if (beads !== undefined && beads !== null) {
    if (beads.string) drawString(f, rungs)
    // a sounding bead's label is written first, so a lit edge's words, as
    // the last take left them under Lesson 20's faster pass, give way to it
    rungs.forEach((r) => {
      const label = drawBead(f, r)
      if (label !== null) written.push(label)
    })
  }
  rungs.forEach((r, i) => {
    if (r.lit !== true) return
    // a rung across the plot lights as the band does, its words at the end
    if (r.from === undefined && r.to === undefined) drawLitEdge(f, bands[i])
    else drawLitSlot(f, bands[i], written)
  })
  return true
}
