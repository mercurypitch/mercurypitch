// ============================================================
// Lesson 4 staircase parts — the stage's elements, and the buttons over the drawing
// ============================================================
//
// What the staircase toy finds in its stage's markup (the figure, its live
// lines, the readout, the white-keys note and hint, the start slider), and
// the buttons it lays over the drawing: one per stair and one per Group
// bracket, each placed on its tap zone as the layout changes. The brackets
// start hidden, since only Group shows them.

import { q } from '@/features/lessons/kit/dom'
import { majorScale } from '@/features/lessons/kit/major-scale'
import { signName } from '@/features/lessons/kit/notes'
import type { Rect } from './stairs-geometry'

export interface StairsParts {
  readonly viz: HTMLElement
  readonly hits: HTMLElement
  readonly stairBtns: HTMLButtonElement[]
  readonly bracketBtns: HTMLButtonElement[]
  readonly said: HTMLElement
  readonly description: HTMLElement
  readonly readoutEl: HTMLElement
  readonly whiteNote: HTMLElement | null
  readonly whiteHint: HTMLElement | null
  readonly slider: HTMLElement | null
  readonly sliderValue: HTMLElement | null
}

function makeButtons(hits: HTMLElement): {
  stairBtns: HTMLButtonElement[]
  bracketBtns: HTMLButtonElement[]
} {
  const make = (
    cls: string,
    attr: string,
    value: number,
  ): HTMLButtonElement => {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = cls
    b.setAttribute(attr, String(value))
    hits.appendChild(b)
    return b
  }
  const stairBtns = Array.from({ length: 8 }, (_, i) =>
    make('stair-hit', 'data-stair', i),
  )
  const bracketBtns = [0, 1].map((g) => {
    const b = make('stair-hit bracket-hit', 'data-bracket', g)
    b.hidden = true
    return b
  })
  return { stairBtns, bracketBtns }
}

/** The stage's parts, with the stair and bracket buttons made over the figure. */
export function findParts(root: HTMLElement): StairsParts {
  const viz = q('[data-stairs-viz]', root)
  const hits = q('[data-stairs-hits]', viz)
  return {
    viz,
    hits,
    ...makeButtons(hits),
    said: q('[data-stairs-said]', root),
    description: q('[data-stairs-summary]', root),
    readoutEl: q('[data-stairs-readout]', root),
    whiteNote: root.querySelector('[data-white-note]'),
    whiteHint: root.querySelector('[data-white-hint]'),
    slider: root.querySelector('[data-start-slider]'),
    sliderValue: root.querySelector('[data-start-value]'),
  }
}

/** Places a button over a rectangle of the drawing. */
export function place(b: HTMLElement, r: Rect): void {
  b.style.left = `${r.x}px`
  b.style.top = `${r.y}px`
  b.style.width = `${r.w}px`
  b.style.height = `${r.h}px`
}

/** A Group bracket's button: "Play the first group: C, D, E, F". */
export function groupName(tonic: number, g: number): string {
  const names = majorScale(tonic)
    .slice(g * 4, g * 4 + 4)
    .map((s) => signName(s, { octave: false }))
  return `Play the ${g === 0 ? 'first' : 'second'} group: ${names.join(', ')}`
}
