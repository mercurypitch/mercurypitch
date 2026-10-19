// ============================================================
// Band chart extras — the level strip and the seconds, under the plot
// ============================================================
//
// Two painters band-chart.ts adds under its plot when a figure asks for
// them (Lesson 5 WEB-SPEC: the hook stage, Push, the hold demo and the
// checkpoint). Loudness is never drawn on the pitch axis (playbook rule 20):
// where a figure shows it, it is the height of a strip under the chart, a
// waveform's envelope in chrome, labelled, so a push that makes a note
// louder grows the strip while the pitch line climbs above it. A hold's
// frame is fixed, 0 to 10 or 15 seconds across, and its seconds are named
// under it, so a line that stops at 3 s is seen to stop there. Neither is
// violet: violet is the singer's line and nothing else.

import type { ChartFrame } from './band-chart-draw'
import { xOf } from './band-chart-draw'
import { clamp } from './dom'
import { COLOR, rgba } from './notes'

/** A point of the level: seconds across the window, and the level as a share of the strip's height, 0 to 1. */
export interface LevelPoint {
  readonly t: number
  readonly level: number
}

const MONO = '500 12px "JetBrains Mono", monospace'

/** Room between the plot and the strip, px. */
export const STRIP_GAP = 8
/** Room for the seconds under the plot, px. */
export const TICKS_ROOM = 18

/** The strip's height for a canvas `h` high: about a sixth of it. */
export const stripHeight = (h: number): number =>
  clamp(Math.round(h * 0.16), 30, 56)

/**
 * The level strip from `top`, `height` px tall: a faint lane with its
 * centre line and its label, and the level as an envelope mirrored about
 * the centre, its height the level.
 */
export function drawLevelStrip(
  f: ChartFrame,
  top: number,
  height: number,
  points: readonly { t: number; level: number }[],
): void {
  const { ctx } = f
  const mid = top + height / 2
  const reach = height / 2 - 2
  ctx.fillStyle = rgba(COLOR.chrome, 0.035)
  ctx.fillRect(f.x0, top, f.x1 - f.x0, height)
  ctx.strokeStyle = rgba(COLOR.chrome, 0.16)
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(f.x0, mid)
  ctx.lineTo(f.x1, mid)
  ctx.stroke()
  if (points.length > 1) {
    const yUp = (p: { level: number }): number =>
      mid - reach * clamp(p.level, 0, 1)
    ctx.beginPath()
    points.forEach((p, i) => {
      const x = xOf(f, p.t)
      if (i === 0) ctx.moveTo(x, yUp(p))
      else ctx.lineTo(x, yUp(p))
    })
    for (let i = points.length - 1; i >= 0; i--)
      ctx.lineTo(xOf(f, points[i].t), 2 * mid - yUp(points[i]))
    ctx.closePath()
    ctx.fillStyle = rgba(COLOR.chrome, 0.24)
    ctx.fill()
    ctx.strokeStyle = rgba(COLOR.chrome, 0.62)
    ctx.stroke()
  }
  // the label on a dark plate, so a loud envelope never runs through it
  ctx.font = MONO
  const label = 'LOUDNESS'
  const lw = ctx.measureText(label).width
  ctx.fillStyle = 'rgba(7,10,16,.82)'
  ctx.fillRect(f.x0 + 1, top + 1, lw + 8, 16)
  ctx.fillStyle = COLOR.ink3
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.fillText(label, f.x0 + 4, top + 3)
}

/** A second's name sits inside the frame: the first from its tick, the last up to it. */
function tickAlign(s: number, last: number): CanvasTextAlign {
  if (s === 0) return 'left'
  return s === last ? 'right' : 'center'
}

/** The seconds under a hold's frame: a tick each second, named every five and at the end. */
export function drawTimeTicks(f: ChartFrame, y: number): void {
  const { ctx } = f
  ctx.font = MONO
  ctx.fillStyle = COLOR.ink3
  ctx.textBaseline = 'top'
  ctx.strokeStyle = rgba(COLOR.chrome, 0.3)
  ctx.lineWidth = 1
  const last = Math.floor(f.window + 1e-9)
  for (let s = 0; s <= last; s++) {
    const x = xOf(f, s)
    const named = s % 5 === 0 || s === last
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x, y + (named ? 5 : 3))
    ctx.stroke()
    if (!named) continue
    ctx.textAlign = tickAlign(s, last)
    ctx.fillText(s === last ? `${s} s` : String(s), x, y + 6)
  }
}
