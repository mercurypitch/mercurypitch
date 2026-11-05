// ============================================================
// Lesson 17 lift tests — Step 4's line, sliding onto Step 5's staff
// ============================================================
//
// WEB-SPEC, Toys 5: each part of the staff starts where the one line drew
// it, so the plan's shifts are the two drawings' differences, a note's head
// from the line to A3 on the bass staff or A4 on the treble, a rest's from
// the line to the middle line; and the lift marks the drawing with them and
// takes its mark off once the slide is done.

import { afterEach, describe, expect, it, vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import type { RhythmRow } from '@/features/lessons/kit/rhythm-draw'
import { drawRhythm } from '@/features/lessons/kit/rhythm-draw'
import type { NoteValue, Written } from '@/features/lessons/kit/rhythm-model'
import type { Clef } from '@/features/lessons/kit/staff-places'
import { lift, liftPlan } from './lift'

const note = (value: NoteValue): Written => ({ kind: 'note', value })
const rest = (value: NoteValue): Written => ({ kind: 'rest', value })

const SIZE = { w: 356, h: 250 }

/** A row drawn on `staff`, in a fresh SVG. */
function drawn(
  rows: readonly RhythmRow[],
  staff: 'line' | Clef,
): SVGSVGElement {
  const el = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  drawRhythm(el, { staff, rows }, SIZE)
  return el
}

/** Each note's head, by symbol: its centre. */
const heads = (el: SVGSVGElement): Map<number, [number, number]> =>
  new Map(
    Array.from(el.querySelectorAll('.rb-sym.rb-note'), (g) => {
      const head = g.querySelector('.rb-head')
      return [
        Number(g.getAttribute('data-i')),
        [Number(head?.getAttribute('cx')), Number(head?.getAttribute('cy'))],
      ]
    }),
  )

/** A rest, by symbol: where its stroke starts, or its block's corner. */
const restStarts = (el: SVGSVGElement): Map<number, [number, number]> =>
  new Map(
    Array.from(el.querySelectorAll('.rb-sym.rb-rest'), (g) => {
      const i = Number(g.getAttribute('data-i'))
      const block = g.querySelector('rect')
      if (block !== null)
        return [
          i,
          [Number(block.getAttribute('x')), Number(block.getAttribute('y'))],
        ]
      const d = g.querySelector('path')?.getAttribute('d') ?? ''
      const m = /^M (\S+) (\S+)/.exec(d)
      return [i, [Number(m?.[1]), Number(m?.[2])]]
    }),
  )

afterEach(() => {
  vi.useRealTimers()
  document.body.textContent = ''
})

describe('the lift', () => {
  it.each(['bass', 'treble'] as const)(
    'starts each note and rest on the %s staff where the line drew it',
    (clef) => {
      // Arrange
      const rows: RhythmRow[] = [
        {
          bars: [
            [note(1), rest(1), note(0.5), note(0.5), note(1)],
            [rest(4)],
            [note(1), note(1), rest(2)],
          ],
          bpm: 60,
        },
      ]
      const line = drawn(rows, 'line')
      const staff = drawn(rows, clef)

      // Act
      const plan = liftPlan(rows, clef, SIZE.w, SIZE.h)

      // Assert: every shift is the two drawings' difference, to a pixel
      const lineHeads = heads(line)
      for (const [i, [x, y]] of heads(staff)) {
        const [lx, ly] = lineHeads.get(i) ?? [NaN, NaN]
        expect(plan.symbols[i].dx).toBeCloseTo(lx - x, 0)
        expect(plan.symbols[i].dy).toBeCloseTo(ly - y, 0)
      }
      const lineRests = restStarts(line)
      for (const [i, [x, y]] of restStarts(staff)) {
        const [lx, ly] = lineRests.get(i) ?? [NaN, NaN]
        expect(plan.symbols[i].dx).toBeCloseTo(lx - x, 0)
        expect(plan.symbols[i].dy).toBeCloseTo(ly - y, 0)
      }
      expect(restStarts(staff).size).toBe(3)
      expect(plan.beams).toEqual([plan.symbols[2]])
      expect(plan.lineY).toBeCloseTo(
        Number(line.querySelector('.rb-line')?.getAttribute('y1')),
        0,
      )
    },
  )

  it('marks the staff with each shift, the five lines from the one, and takes the mark off after the slide', () => {
    // Arrange
    vi.useFakeTimers()
    const rows: RhythmRow[] = [{ bars: [[note(2), note(2)]], bpm: 60 }]
    const figure = document.createElement('div')
    figure.append(drawn(rows, 'bass'))
    const plan = liftPlan(rows, 'bass', SIZE.w, SIZE.h)

    // Act
    lift(figure, plan)
    const marked = figure.classList.contains('is-lifting')
    const lines = Array.from(
      figure.querySelectorAll<SVGElement>('.rb-staff[data-place]'),
      (l) => [
        Number(l.getAttribute('y1')),
        parseFloat(l.style.getPropertyValue('--lift-y')),
      ],
    )
    const first = figure.querySelector<SVGElement>('.rb-sym[data-i="0"]')
    vi.advanceTimersByTime(700)

    // Assert (WEB-SPEC, Toys 5)
    expect(marked).toBe(true)
    expect(lines).toHaveLength(5)
    for (const [y, lift] of lines) expect(y + lift).toBeCloseTo(plan.lineY, 0)
    expect(first?.style.getPropertyValue('--lift-x')).toBe(
      `${plan.symbols[0].dx.toFixed(1)}px`,
    )
    expect(figure.classList.contains('is-lifting')).toBe(false)
  })
})
