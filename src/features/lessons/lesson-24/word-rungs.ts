// ============================================================
// Lesson 24 word rungs — Harmonic's six and Equal-tempered's thirteen
// ============================================================
//
// The two word figures that are rungs, not a chart (WEB-SPEC, Toys 4): short
// chrome lines stacked from the stub's foot to its top, evenly spaced, the
// one sounding lit in ink with a soft glow, the rest at rest. Harmonic's six
// are A3's first six harmonics, 220 to 1,320 Hz, spaced by frequency, and so
// evenly, each 220 Hz above the last; Equal-tempered's thirteen are A3 up to
// A4 in semitones, spaced by pitch, and so evenly too, each 100 cents above
// the last. The lowest rung and the highest are named at the left. A rung
// lights as a step, never a movement, so it does the same under reduced
// motion. The canvas is decoration, the ticket's words saying what it
// shows, so it carries no summary.

import { MONO } from '@/features/lessons/kit/band-chart-draw'
import { COLOR, rgba } from '@/features/lessons/kit/notes'

/** What a rung figure shows this frame. */
export interface RungsPicture {
  /** How many rungs, foot to top. */
  readonly n: number
  /** The rung sounding now, 0 the lowest; null while none does. */
  readonly lit: number | null
  /** The lowest rung's name and the highest's. */
  readonly ends: readonly [string, string]
}

/** Room above and below the rungs, px. */
const PAD_Y = 14
/** Room at the left for the names, px. */
export const NAME_W = 72
/** Room at the right, px. */
const PAD_R = 12

/** Rung `i`'s height on a canvas `h` px tall, 0 the lowest, at the foot. */
export const rungY = (h: number, n: number, i: number): number =>
  n < 2 ? h / 2 : h - PAD_Y - (i / (n - 1)) * (h - 2 * PAD_Y)

/** Paints the rungs on a cleared canvas `w` by `h` px. */
export function paintWordRungs(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  p: RungsPicture,
): void {
  const x0 = NAME_W
  const x1 = w - PAD_R
  ctx.lineCap = 'round'
  for (let i = 0; i < p.n; i++) {
    const y = rungY(h, p.n, i)
    const lit = p.lit === i
    ctx.save()
    if (lit) {
      ctx.shadowColor = rgba(COLOR.ink, 0.85)
      ctx.shadowBlur = 12
    }
    ctx.strokeStyle = lit ? COLOR.ink : rgba(COLOR.chrome, 0.55)
    ctx.lineWidth = lit ? 3 : 1.5
    ctx.beginPath()
    ctx.moveTo(x0, y)
    ctx.lineTo(x1, y)
    ctx.stroke()
    ctx.restore()
  }
  ctx.font = MONO
  ctx.fillStyle = rgba(COLOR.chrome, 0.85)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(p.ends[0], 8, rungY(h, p.n, 0))
  ctx.fillText(p.ends[1], 8, rungY(h, p.n, p.n - 1))
}
