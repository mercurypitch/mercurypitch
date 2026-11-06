// ============================================================
// Band chart wave — Merc's line as he sings it, its middle, and a ruler
// ============================================================
//
// The painter behind a chart's `wave`, `middle` and `ruler`
// (band-chart-wave-scene.ts), Lesson 22's states of the band chart, passed
// in by the page that draws them (`paintOver`), so no lesson without them
// downloads it. Merc's line is his amber at its true pitch, sampled from
// its schedule a pixel or two apart and drawn up to the moment the play has
// reached; the middle is dashed, drawn left to right as far as its share,
// in amber from Merc's schedule or violet from the centre-line reader, and
// labelled "middle" at its end; the ruler stands upright from a dashed tick
// at the middle to the top of a swing, its reading beside it. A point
// beyond the chart is pinned to its edge, as the singer's line is.

import type { BandScene } from './band-chart'
import type { ChartFrame } from './band-chart-draw'
import { BAND_COLOR, MONO, xOf, yOf } from './band-chart-draw'
import type { MiddleLine, WaveLine, WaveRuler } from './band-chart-wave-scene'
import { centsOn } from './band-chart-wave-scene'
import { COLOR } from './notes'

/** Pixels between the line's samples. */
const STEP_PX = 1.5

const pin = (f: ChartFrame, c: number): number =>
  yOf(f, Math.min(Math.max(c, f.lo), f.hi))

/** Merc's line, his amber, up to where the play has sounded. */
export function drawWave(f: ChartFrame, line: WaveLine): void {
  const { ctx } = f
  const dt = (f.window / Math.max(1, f.x1 - f.x0)) * STEP_PX
  ctx.strokeStyle = BAND_COLOR.target
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.lineWidth = 2.4
  for (const s of line.stretches) {
    const a = Math.max(0, s.from)
    const b = Math.min(s.to, line.upTo, f.window)
    if (b <= a) continue
    ctx.beginPath()
    ctx.moveTo(xOf(f, a), pin(f, centsOn(s, a)))
    for (let t = a + dt; t < b; t += dt)
      ctx.lineTo(xOf(f, t), pin(f, centsOn(s, t)))
    ctx.lineTo(xOf(f, b), pin(f, centsOn(s, b)))
    ctx.stroke()
  }
}

/** The dashed middle, as far as its share, labelled "middle" where it ends. */
export function drawMiddle(f: ChartFrame, m: MiddleLine): void {
  const pts = m.points
  if (pts.length < 2 || m.share <= 0) return
  const { ctx } = f
  const first = pts[0].t
  const until = first + (pts[pts.length - 1].t - first) * Math.min(1, m.share)
  ctx.strokeStyle = m.tone === 'merc' ? BAND_COLOR.target : BAND_COLOR.singer
  ctx.lineWidth = 2
  ctx.setLineDash([6, 5])
  ctx.beginPath()
  let end = { x: xOf(f, first), y: pin(f, pts[0].c) }
  ctx.moveTo(end.x, end.y)
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i]
    const q = pts[i - 1]
    if (q.t >= until) break
    const t = Math.min(p.t, until)
    const k = p.t > q.t ? (t - q.t) / (p.t - q.t) : 1
    end = { x: xOf(f, t), y: pin(f, q.c + (p.c - q.c) * k) }
    ctx.lineTo(end.x, end.y)
  }
  ctx.stroke()
  ctx.setLineDash([])
  if (m.share < 1) return
  ctx.font = MONO
  ctx.fillStyle = COLOR.ink2
  ctx.textAlign = 'right'
  ctx.textBaseline = 'bottom'
  ctx.fillText('MIDDLE', Math.min(end.x, f.x1), end.y - 6)
}

/** The ruler: a dashed tick at the middle, an upright to the swing's top, and its reading. */
export function drawRuler(f: ChartFrame, r: WaveRuler): void {
  const { ctx } = f
  const x = xOf(f, r.t)
  const y0 = pin(f, r.from)
  const y1 = pin(f, r.to)
  ctx.strokeStyle = COLOR.chrome
  ctx.lineWidth = 1
  ctx.setLineDash([3, 3])
  ctx.beginPath()
  ctx.moveTo(x - 9, y0)
  ctx.lineTo(x + 9, y0)
  ctx.stroke()
  ctx.setLineDash([])
  ctx.beginPath()
  ctx.moveTo(x, y0)
  ctx.lineTo(x, y1)
  ctx.moveTo(x - 6, y1)
  ctx.lineTo(x + 6, y1)
  ctx.stroke()
  ctx.font = MONO
  ctx.fillStyle = COLOR.ink
  ctx.textAlign = x > f.x1 - 70 ? 'right' : 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(
    r.text,
    x + (ctx.textAlign === 'right' ? -10 : 10),
    (y0 + y1) / 2,
  )
}

/** Paints the scene's wave, middle and ruler over the band: the chart's `paintOver`. */
export function paintWave(f: ChartFrame, scene: BandScene): void {
  if (scene.wave) drawWave(f, scene.wave)
  if (scene.middle) drawMiddle(f, scene.middle)
  if (scene.ruler) drawRuler(f, scene.ruler)
}
