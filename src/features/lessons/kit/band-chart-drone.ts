// ============================================================
// Band chart drone — the drone, the band, the beads, the ticks and the top notes
// ============================================================
//
// The painter behind a chart's `drone` (band-chart-drone-scene.ts), Lesson
// 24's drone chart, passed in by the page that draws it in place of Merc's
// band (`paintRungs`, kit/band-chart.ts), so no lesson without it downloads
// it. In paint order: the band, the drone's amber band or Lesson 5's band on
// the note, its lit edge beside "in the band" as the chart's own; the drone
// as a chrome line, labelled at its right end, or pinned to the chart's foot
// with an arrow where it lies below the window; the ticks at the right
// edge, each named on its own side, so two ticks 14 cents apart never mix
// their words; the top notes, chrome and thin, sampled from their schedules
// a pixel or two apart; and Lesson 10's beads at the left edge, over the
// lines that start under them.
//
// A beat is brightness, never a new colour (WEB-SPEC, Look): the band's
// fill swells with the slow beats, its edges shimmer with the fast ones,
// and each top note's halo follows the slow beats; with nothing sounding
// the band is Lesson 5's at rest and the lines have no halo. Every swing is
// small enough that the band, its edge and a halo over them, at their
// brightest against their dimmest, stay under 0.1 in relative luminance on
// the page's dark grounds, so nothing counts as a flash (WCAG 2.3.1).

import type { BandScene } from './band-chart'
import type { ChartFrame } from './band-chart-draw'
import { BAND_COLOR, drawBand, drawLitEdge, MONO, xOf, yOf, } from './band-chart-draw'
import type { DroneBead, DroneMark, DroneScene, DroneTick, } from './band-chart-drone-scene'
import type { WaveLine } from './band-chart-wave-scene'
import { centsOn } from './band-chart-wave-scene'
import { HIT_TOLERANCE_CENTS } from './band-words'
import { TAU } from './dom'
import type { Brightness } from './drone-beats'
import { COLOR, rgba } from './notes'

/** The drone's band, cents either side: a drawing of one held note, never a tolerance (Lesson 24 FACTS 40). */
export const DRONE_HALF_CENTS = 15

/** A bead's radius, px, as Lesson 10's beads are drawn but a little smaller for the chart. */
export const BEAD_R = 10

/** A tick's length at the right edge, px. */
const TICK_PX = 22

/** Pixels between a top note's samples. */
const STEP_PX = 1.5

/** A band tall enough to hold its label inside, px; a shorter one is named above its top edge. */
const LABEL_INSIDE_PX = 44

/** The band's fill and edge alphas: Lesson 5's at rest; while it sounds, swelling with the slow beats and shimmering with the fast. */
export function bandAlphas(b: Brightness | null): {
  readonly fill: number
  readonly edge: number
} {
  if (b === null) return { fill: 0.13, edge: 0.6 }
  return {
    fill: b.slow === null ? 0.15 : 0.1 + 0.1 * b.slow,
    edge: 0.5 + 0.1 * (b.fast ?? b.slow ?? 0.5),
  }
}

/** A top note's halo alpha: none at rest; while it sounds, following the slow beats, or the fast where none is slow. */
export function haloAlpha(b: Brightness | null): number {
  if (b === null) return 0
  return 0.04 + 0.08 * (b.slow ?? b.fast ?? 0.5)
}

const pin = (f: ChartFrame, c: number): number =>
  yOf(f, Math.min(Math.max(c, f.lo), f.hi))

/** A band's strip and its two edges, at the alphas given, with no line at its centre. */
function drawStrip(
  f: ChartFrame,
  c: number,
  half: number,
  a: { readonly fill: number; readonly edge: number },
): void {
  const { ctx } = f
  const yTop = yOf(f, c + half)
  const yBot = yOf(f, c - half)
  ctx.fillStyle = rgba(BAND_COLOR.target, a.fill)
  ctx.fillRect(f.x0, yTop, f.x1 - f.x0, yBot - yTop)
  ctx.strokeStyle = rgba(BAND_COLOR.target, a.edge)
  ctx.lineWidth = 1
  for (const y of [yTop, yBot]) {
    ctx.beginPath()
    ctx.moveTo(f.x0, y)
    ctx.lineTo(f.x1, y)
    ctx.stroke()
  }
}

/** The drone's amber band and its label: inside it, at its lower left, or above its top edge where it is short. */
function drawDroneBand(f: ChartFrame, s: DroneScene): void {
  const { ctx } = f
  const d = s.drone
  drawStrip(f, d.c, DRONE_HALF_CENTS, bandAlphas(s.bright))
  const yTop = yOf(f, d.c + DRONE_HALF_CENTS)
  const yBot = yOf(f, d.c - DRONE_HALF_CENTS)
  // the label starts clear of the beads and their names
  const x = f.x0 + (s.beads.length > 0 ? 2 * BEAD_R + 34 : 6)
  ctx.font = MONO
  ctx.fillStyle = BAND_COLOR.target
  ctx.textAlign = 'left'
  ctx.textBaseline = 'bottom'
  const inside = yBot - yTop >= LABEL_INSIDE_PX
  ctx.fillText(d.label, x, inside ? yBot - 5 : yTop - 4)
}

/** Lesson 5's band on the note: as the chart draws it at rest, with Merc's glow; while it sounds, swelling with the beats. */
function drawNoteBand(
  f: ChartFrame,
  scene: BandScene,
  band: NonNullable<DroneScene['band']>,
  bright: Brightness | null,
): void {
  if (bright === null) {
    drawBand(f, {
      c: band.c,
      half: HIT_TOLERANCE_CENTS,
      glow: scene.glow,
      line: band.line,
    })
    return
  }
  drawStrip(f, band.c, HIT_TOLERANCE_CENTS, bandAlphas(bright))
  if (!band.line) return
  const { ctx } = f
  const y = yOf(f, band.c)
  ctx.strokeStyle = rgba(BAND_COLOR.target, 0.75)
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(f.x0, y)
  ctx.lineTo(f.x1, y)
  ctx.stroke()
}

/** The drone as a chrome line, labelled at its right end; below the window, a marker pinned to the foot with an arrow. */
function drawDroneLine(f: ChartFrame, d: DroneMark): void {
  const { ctx } = f
  ctx.font = MONO
  ctx.fillStyle = COLOR.chrome
  if (d.c < f.lo) {
    // pinned, as the chart pins any note beyond it: an arrow pointing down off the chart
    const x = f.x0 + 10
    const y = f.bottom
    ctx.beginPath()
    ctx.moveTo(x - 6, y - 11)
    ctx.lineTo(x + 6, y - 11)
    ctx.lineTo(x, y - 2)
    ctx.closePath()
    ctx.fill()
    ctx.textAlign = 'left'
    ctx.textBaseline = 'bottom'
    ctx.fillText(d.label, x + 12, y - 1)
    return
  }
  if (d.c > f.hi) return
  const y = yOf(f, d.c)
  ctx.strokeStyle = rgba(COLOR.chrome, 0.8)
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(f.x0, y)
  ctx.lineTo(f.x1, y)
  ctx.stroke()
  ctx.textAlign = 'right'
  ctx.textBaseline = 'bottom'
  ctx.fillText(d.label, f.x1 - 4, y - 3)
}

/** The ticks at the right edge: "piano" solid chrome, named above it; "pure" dashed ink, named below it. */
function drawTicks(f: ChartFrame, ticks: readonly DroneTick[]): void {
  const { ctx } = f
  ctx.font = MONO
  ctx.textAlign = 'right'
  ctx.lineWidth = 2
  for (const t of ticks) {
    if (t.c < f.lo || t.c > f.hi) continue
    const y = yOf(f, t.c)
    const pure = t.kind === 'pure'
    const tone = pure ? COLOR.ink : COLOR.chrome
    ctx.strokeStyle = tone
    ctx.setLineDash(pure ? [4, 3] : [])
    ctx.beginPath()
    ctx.moveTo(f.x1 - TICK_PX, y)
    ctx.lineTo(f.x1, y)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.fillStyle = tone
    ctx.textBaseline = pure ? 'top' : 'bottom'
    ctx.fillText(t.kind, f.x1 - TICK_PX - 6, pure ? y + 1 : y - 1)
  }
}

/** A top note's line, chrome and thin, from its schedule up to where its play has sounded, with its halo while it sounds. */
function drawTop(f: ChartFrame, line: WaveLine, halo: number): void {
  const { ctx } = f
  const dt = (f.window / Math.max(1, f.x1 - f.x0)) * STEP_PX
  ctx.beginPath()
  // where the stroke has reached, on the window's clock: a stretch that
  // takes over where another ends carries the line on unbroken
  let end: number | null = null
  for (const s of line.stretches) {
    const a = Math.max(0, s.from)
    const b = Math.min(s.to, line.upTo, f.window)
    if (b <= a) continue
    const y = pin(f, centsOn(s, a))
    if (end === a) ctx.lineTo(xOf(f, a), y)
    else ctx.moveTo(xOf(f, a), y)
    for (let t = a + dt; t < b; t += dt)
      ctx.lineTo(xOf(f, t), pin(f, centsOn(s, t)))
    ctx.lineTo(xOf(f, b), pin(f, centsOn(s, b)))
    end = b
  }
  if (end === null) return
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  if (halo > 0) {
    ctx.strokeStyle = rgba(COLOR.chrome, halo)
    ctx.lineWidth = 7
    ctx.stroke()
  }
  ctx.strokeStyle = rgba(COLOR.chrome, 0.9)
  ctx.lineWidth = 1.6
  ctx.stroke()
}

/** Lesson 10's beads at the left edge, chrome, the sounding one ink and lit, each named beside it. */
function drawBeads(f: ChartFrame, beads: readonly DroneBead[]): void {
  const { ctx } = f
  const x = f.x0 + BEAD_R + 2
  ctx.font = MONO
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  for (const b of beads) {
    if (b.c < f.lo || b.c > f.hi) continue
    const y = yOf(f, b.c)
    const tone = b.lit ? COLOR.ink : COLOR.chrome
    ctx.save()
    if (b.lit) {
      ctx.shadowColor = COLOR.ink
      ctx.shadowBlur = 16
    }
    const g = ctx.createRadialGradient(
      x - BEAD_R * 0.35,
      y - BEAD_R * 0.35,
      BEAD_R * 0.1,
      x,
      y,
      BEAD_R,
    )
    g.addColorStop(0, '#ffffff')
    g.addColorStop(0.45, tone)
    g.addColorStop(1, '#4a5563')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(x, y, BEAD_R, 0, TAU)
    ctx.fill()
    ctx.restore()
    ctx.fillStyle = b.lit ? COLOR.ink : COLOR.ink2
    ctx.fillText(b.name, x + BEAD_R + 6, y)
  }
}

/**
 * Paints the scene's drone chart in place of Merc's band: the chart's
 * `paintRungs`. False for a scene with no drone, which keeps the band.
 */
export function paintDrone(f: ChartFrame, scene: BandScene): boolean {
  const s = scene.drone
  if (!s) return false
  if (s.drone.as === 'band') drawDroneBand(f, s)
  else if (s.band !== null) drawNoteBand(f, scene, s.band, s.bright)
  if (s.drone.as === 'line') drawDroneLine(f, s.drone)
  drawTicks(f, s.ticks)
  const halo = haloAlpha(s.bright)
  for (const line of s.tops) drawTop(f, line, halo)
  drawBeads(f, s.beads)
  if (scene.lit && s.band !== null)
    drawLitEdge(f, { c: s.band.c, half: HIT_TOLERANCE_CENTS })
  return true
}
