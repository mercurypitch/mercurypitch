// ============================================================
// Lesson 17 wrap — the practice card's rest line and the tease still
// ============================================================
//
// The practice card is Ear Lab's The Chart, with Pulse beside it, in every
// version, since neither asks for a voice (WEB-SPEC, Practice links; FACTS
// 56). After "Effortful", "Uncomfortable" or "Just listen today" in the
// sung bars it shows Lesson 8's rest line above its text, which puts off
// only this page's sung bars. The ending is held in memory for the visit
// (kit/comfort.ts `VisitEnding`), never stored, so a new visit opens with
// no rest line.
//
// The tease still (Toys 11) sits in the next-lesson card's slot: Lesson
// 18's opening line as its stage draws it, on the bass staff for everyone,
// four quarters and then two quarters and a half note, G3 A3 B3 A3 and G3
// B3 D4, over the beat grid, with no cursor, no bracket, no name and no
// syllable, so it shows nothing Lesson 18's predict turns on (FACTS 5). It
// is drawn once, at a size the slot scales, and plays nothing: the card is
// a link.

import { VisitEnding } from '@/features/lessons/kit/comfort'
import { q } from '@/features/lessons/kit/dom'
import type { Letter, Spelled } from '@/features/lessons/kit/notes'
import type { RhythmFigure } from '@/features/lessons/kit/rhythm-draw'
import { drawRhythm } from '@/features/lessons/kit/rhythm-draw'
import type { Bar, Written } from '@/features/lessons/kit/rhythm-model'

const quarter: Written = { kind: 'note', value: 1 }
const half: Written = { kind: 'note', value: 2 }

/** Lesson 18's opening line: four quarters, then two quarters and a half note. */
export const TEASE_BARS: readonly Bar[] = [
  [quarter, quarter, quarter, quarter],
  [quarter, quarter, half],
]

const note = (letter: Letter, octave: number): Spelled => ({
  letter,
  alter: 0,
  octave,
})

/** Its notes, one a sound: G3 A3 B3 A3, then G3 B3 D4. */
export const TEASE_NOTES: readonly Spelled[] = [
  note('G', 3),
  note('A', 3),
  note('B', 3),
  note('A', 3),
  note('G', 3),
  note('B', 3),
  note('D', 4),
]

/** The tease still's size, px; lesson-17.css scales it to its slot. */
const TEASE_SIZE = { w: 360, h: 150 }

/** Draws the tease still into `el`: every note written, the 4/4 shown, nothing lit. */
export function drawTease(el: SVGSVGElement): RhythmFigure {
  const fig = drawRhythm(
    el,
    {
      staff: 'bass',
      strip: false,
      rows: [{ bars: TEASE_BARS, bpm: 60, notes: TEASE_NOTES }],
    },
    TEASE_SIZE,
  )
  fig.set([{ written: fig.rows[0].placed.map(() => true), metre: true }])
  return fig
}

export function initWrap(): void {
  const rest = q('#practiseCard [data-ending="rest"]')
  VisitEnding.subscribe((ending) => {
    rest.hidden = ending !== 'rest'
  })
  drawTease(q<SVGSVGElement>('.l17-tease svg[data-tease-staff]'))
}
