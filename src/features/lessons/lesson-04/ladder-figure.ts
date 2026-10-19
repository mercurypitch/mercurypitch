// ============================================================
// Lesson 4 practice figure — the staircase beside Scale Runner's ladder
// ============================================================
//
// An illustration in the page's own style, not a drawing of the app (FACTS
// 39, Illustrations): the staircase on C at the left; at the right a short
// pitch line, in the singer's violet of the app's canvas set, reaching the
// playhead, with the notes still to come drawn as rungs ahead of it, one
// rung per note in order, so the shape of what is coming reads first.

import { q, svg } from '@/features/lessons/kit/dom'
import { MAJOR_DEGREES } from '@/features/lessons/kit/major-scale'
import { COLOR, rgba } from '@/features/lessons/kit/notes'

/** The app's singer line (PITCH_VISUAL_COLORS), as the scale guide's canvas set uses it. */
const SINGER = '#a78bfa'

/** A semitone's height in the figure, px. */
const ROW = 7
const FOOT = 128

function staircase(host: SVGSVGElement): void {
  MAJOR_DEGREES.forEach((deg, i) => {
    const top = FOOT - 12 - deg * ROW
    svg(
      'rect',
      {
        x: 10 + i * 17,
        y: top,
        width: 15,
        height: FOOT - top,
        fill: rgba(COLOR.chrome, 0.12),
        stroke: rgba(COLOR.chrome, 0.3),
      },
      host,
    )
    svg(
      'rect',
      {
        x: 10 + i * 17,
        y: top,
        width: 15,
        height: 2.5,
        fill: rgba(COLOR.chrome, 0.9),
      },
      host,
    )
  })
}

function ladder(host: SVGSVGElement): void {
  const playhead = 236
  // the line sung so far: do, re, mi, each held, then the climb to fa
  const sung = 'M170 116 H184 V102 H198 V88 H212 V81 H236'
  svg(
    'path',
    {
      d: sung,
      fill: 'none',
      stroke: SINGER,
      'stroke-width': 2.4,
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
    },
    host,
  )
  svg(
    'line',
    {
      x1: playhead,
      x2: playhead,
      y1: 22,
      y2: 132,
      stroke: rgba(COLOR.chrome, 0.35),
    },
    host,
  )
  // so, la, ti, do: still to come, one rung each, fading with distance
  const rungs = [7, 9, 11, 12].map((deg, i) => ({
    x: 254 + i * 18,
    y: FOOT - 12 - deg * ROW,
    alpha: 0.85 - i * 0.16,
  }))
  svg(
    'path',
    {
      d: `M${playhead} 81 ${rungs.map((r) => `L${r.x} ${r.y}`).join(' ')}`,
      fill: 'none',
      stroke: rgba(COLOR.chrome, 0.3),
      'stroke-dasharray': '3 4',
    },
    host,
  )
  for (const r of rungs)
    svg(
      'line',
      {
        x1: r.x - 7,
        x2: r.x + 7,
        y1: r.y,
        y2: r.y,
        stroke: rgba(COLOR.chrome, r.alpha),
        'stroke-width': 2.6,
        'stroke-linecap': 'round',
      },
      host,
    )
}

export function drawLadderFigure(): void {
  const host = q<SVGSVGElement>('[data-ladder]')
  staircase(host)
  ladder(host)
}
