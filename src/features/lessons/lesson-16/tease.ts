// ============================================================
// Lesson 16 tease still — Lesson 17's stage before its first play
// ============================================================
//
// Loaded after first paint (wrap.ts): Lesson 8's four beat pads numbered 1
// to 4 under one bar of 4/4 on one line, the line empty, and the stopwatch
// strip under the pads, empty, nothing written and nothing lit (WEB-SPEC,
// Toys 7; FACTS 5), as Lesson 17's rhythm bar draws its stage.

import type { RhythmFigure } from '@/features/lessons/kit/rhythm-draw'
import { drawRhythm } from '@/features/lessons/kit/rhythm-draw'
import type { Bar, Written } from '@/features/lessons/kit/rhythm-model'

const quarter: Written = { kind: 'note', value: 1 }

/** The bar the pads stand under: four beats, none written yet. */
export const TEASE_BAR: Bar = [quarter, quarter, quarter, quarter]

/** The still's size, px; lesson-16.css scales it to its slot. */
const TEASE_SIZE = { w: 320, h: 150 }

/** Draws the still into `el`: the line, the pads and the strip, nothing written. */
export function drawTease(el: SVGSVGElement): RhythmFigure {
  const fig = drawRhythm(
    el,
    {
      staff: 'line',
      rows: [{ bars: [TEASE_BAR], bpm: 60 }],
      pads: true,
      strip: true,
    },
    TEASE_SIZE,
  )
  fig.set([{ written: fig.rows[0].placed.map(() => false), metre: false }])
  return fig
}
