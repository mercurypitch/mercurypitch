// ============================================================
// Lesson 28 three words — Cadence, Section, Form, each with a small figure
// ============================================================
//
// Lesson 5's word tickets (WEB-SPEC, Toys 4): Cadence plays bars 3 and 4,
// both parts, 6.67 s, its two bars lighting on a small strip, two boxes a
// bar, Tavi's row over Merc's, as the hero's strip draws them; Section has
// no play, its figure eight bars under one bracket, one section; Form's
// Show the letters draws the four blocks of the song, A A B A, their
// letters fading in, small, and plays nothing (FACTS 47, 50). None sounds
// bar 8 or names what changes there, so none waits for the cold open's
// choice. Cadence's play is the page's one sound (kit/words-strip.ts).

import { q, svg } from '@/features/lessons/kit/dom'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type { Run } from '@/features/lessons/kit/run'
import { playNotes } from '@/features/lessons/kit/run'
import { bindWordPlays } from '@/features/lessons/kit/words-strip'
import { A, barAt, barsOf, bothNotes } from './song'

/** What the live line says after each word's figure has played or shown. */
export const WORD_SAID = {
  cadence:
    'Bars 3 and 4: the first phrase ends on V, re over so, an imperfect cadence.',
  form: 'The song is four sections: A, A, B, A.',
} as const

/** Cadence's bars: bars 3 and 4 of A. */
export const CADENCE = barsOf(A, 3, 4)

/** The figure's box: 96 by 96, as every word figure. */
const SIZE = 96

/** Cadence's small strip: bars 3 and 4, two boxes a bar, Tavi's row over Merc's; each bar's pair of boxes. */
function cadenceFigure(el: SVGSVGElement): (bar: number | null) => void {
  el.setAttribute('viewBox', `0 0 ${SIZE} ${SIZE}`)
  const cells: SVGRectElement[][] = [[], []]
  ;[3, 4].forEach((bar, i) => {
    const x = 10 + i * 40
    for (const [k, row] of ['tavi', 'merc'].entries()) {
      const cell = svg(
        'rect',
        {
          x,
          y: 20 + k * 30,
          width: 36,
          height: 24,
          rx: 4,
          class: `w-box w-${row}`,
        },
        el,
      )
      cells[i]?.push(cell)
    }
    svg(
      'text',
      {
        x: x + 18,
        y: 90,
        'text-anchor': 'middle',
        class: 'w-num',
        text: String(bar),
      },
      el,
    )
  })
  return (bar) => {
    cells.forEach((pair, i) => {
      for (const c of pair) c.classList.toggle('is-lit', bar === i + 3)
    })
  }
}

/** Section's figure: eight bars as boxes under one bracket, one section. */
function sectionFigure(el: SVGSVGElement): void {
  el.setAttribute('viewBox', `0 0 ${SIZE} ${SIZE}`)
  for (let i = 0; i < 8; i++)
    svg(
      'rect',
      { x: 6 + i * 10.8, y: 44, width: 8.8, height: 24, rx: 2, class: 'w-box' },
      el,
    )
  svg('path', { d: 'M6 36V28H90.2V36', class: 'w-bracket' }, el)
}

/** Form's figure: four blocks, their letters hidden until shown. */
function formFigure(el: SVGSVGElement): (shown: boolean) => void {
  el.setAttribute('viewBox', `0 0 ${SIZE} ${SIZE}`)
  const letters = ['A', 'A', 'B', 'A'].map((letter, i) => {
    svg(
      'rect',
      { x: 6 + i * 21.5, y: 48, width: 19, height: 24, rx: 3, class: 'w-box' },
      el,
    )
    return svg(
      'text',
      {
        x: 15.5 + i * 21.5,
        y: 38,
        'text-anchor': 'middle',
        class: 'w-letter is-hidden',
        text: letter,
      },
      el,
    )
  })
  return (shown) => {
    for (const l of letters) l.classList.toggle('is-hidden', !shown)
  }
}

export function initWords(): void {
  const root = q('#words')
  const said = q('[data-words-said]', root)
  const lightCadence = cadenceFigure(
    q<SVGSVGElement>('[data-word-fig="cadence"]', root),
  )
  sectionFigure(q<SVGSVGElement>('[data-word-fig="section"]', root))
  const showForm = formFigure(q<SVGSVGElement>('[data-word-fig="form"]', root))
  let run: Run | null = null

  async function play(w: string, audible: boolean): Promise<void> {
    said.textContent = ''
    if (w !== 'cadence') return
    const r = playNotes(bothNotes(CADENCE), {
      audible,
      onNote: (n) => {
        if (run === r) lightCadence(barAt(n.t) + 2)
      },
    })
    run = r
    const heard = await r.done
    if (run !== r) return
    run = null
    lightCadence(null)
    // a play cut short says nothing: the newer sound speaks for itself
    if (heard) said.textContent = WORD_SAID.cadence
  }

  bindWordPlays(root, play, {
    owner: NowPlaying,
    stop: () => {
      run?.stop()
      run = null
      lightCadence(null)
    },
  })

  // Form shows its letters and plays nothing
  q<HTMLButtonElement>('[data-word-show="form"]', root).addEventListener(
    'click',
    () => {
      showForm(true)
      said.textContent = WORD_SAID.form
    },
  )
}
