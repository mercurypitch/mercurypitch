// ============================================================
// Lesson 18 wrap — the practice card in its version, and the tease still
// ============================================================
//
// The practice card is Sight-Singing's, with The Chart under it for the
// beat (WEB-SPEC, Practice links). After "Effortful", "Uncomfortable" or
// "Just listen today" in Sing it the card takes Lesson 12's rest form:
// "Rest today" over the rest line, Sight-Singing no longer a link, since
// it asks for the voice, and The Chart kept, since it asks for none
// (FACTS 60; kit/comfort.ts `mountPractiseCard`). The ending is held in
// memory for the visit (`VisitEnding`), never stored, so a new visit opens
// on the practice version.
//
// The tease still (Toys 6) sits in the next-lesson card's slot: Lesson
// 19's stage before its first play, six of Lesson 8's pads in a row,
// numbered 1 to 6, all one size, with no grouping, no arcs and nothing
// written or lit (FACTS 5). It is drawn once, at a size the slot scales,
// holds no button and plays nothing: the card is a link.

import { mountPractiseCard } from '@/features/lessons/kit/comfort'
import { q } from '@/features/lessons/kit/dom'
import type { RhythmFigure } from '@/features/lessons/kit/rhythm-draw'
import { drawRhythm } from '@/features/lessons/kit/rhythm-draw'
import type { Bar, Written } from '@/features/lessons/kit/rhythm-model'
import { SIX_EIGHT } from '@/features/lessons/kit/rhythm-model'

const eighth: Written = { kind: 'note', value: 0.5 }

/** The bar the six pads stand under: six eighths, none written. */
export const TEASE_BAR: Bar = [eighth, eighth, eighth, eighth, eighth, eighth]

/** The still's size, px; lesson-18.css scales it to its slot. */
const TEASE_SIZE = { w: 320, h: 96 }

/** Draws the still into `el`: six pads numbered 1 to 6, nothing written, grouped or lit. */
export function drawTease(el: SVGSVGElement): RhythmFigure {
  const fig = drawRhythm(
    el,
    {
      staff: 'line',
      rows: [{ bars: [TEASE_BAR], bpm: 60, metre: SIX_EIGHT }],
      // a pad an eighth, six to the bar, as Lesson 19's stage stands them
      padEvery: 0.5,
      pads: true,
      arcs: false,
      notation: false,
      strip: false,
      compact: true,
    },
    TEASE_SIZE,
  )
  fig.set([{ written: fig.rows[0].placed.map(() => false), metre: false }])
  return fig
}

export function initWrap(): void {
  mountPractiseCard(q('#practiseCard'))
  drawTease(q<SVGSVGElement>('.l18-tease svg[data-tease-pads]'))
}
