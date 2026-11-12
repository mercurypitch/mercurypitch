// ============================================================
// Read marks — the reading staff's marks over its rhythm figure
// ============================================================
//
// Lesson 18's reading staff writes over Lesson 17's rhythm on the staff:
// the house under do's first note and the syllables counted from it, a
// name over a note and a tag under it as it is read, the cursor on each
// head on its beat, the count-in's four dots before bar 1, gold brackets
// that fade in once and keep a 44 px button, and a song sheet's marks
// where an engraver puts them (its WEB-SPEC, Toys 1 to 3). Drawn into the
// figure's SVG, and drawn again into each new one.

import { describe, expect, it } from 'vitest'
import './browser-doubles.test-fixtures'
import type { Spelled } from './notes'
import { createReadMarks, cursorX } from './read-marks'
import type { RhythmFigure } from './rhythm-draw'
import { drawRhythm } from './rhythm-draw'
import type { RhythmScene } from './rhythm-layout'
import { symbolX } from './rhythm-layout'
import type { Bar, Written } from './rhythm-model'

const quarter: Written = { kind: 'note', value: 1 }
const half: Written = { kind: 'note', value: 2 }
const n = (letter: Spelled['letter'], octave: number): Spelled => ({
  letter,
  alter: 0,
  octave,
})

/** Merc's tune, the cold open's: G3 A3 B3 A3, then G3 B3 and a long D4. */
const BARS: readonly Bar[] = [
  [quarter, quarter, quarter, quarter],
  [quarter, quarter, half],
]
const TUNE = [
  n('G', 3),
  n('A', 3),
  n('B', 3),
  n('A', 3),
  n('G', 3),
  n('B', 3),
  n('D', 4),
]
const DO = n('G', 3)

function scene(staff: 'bass' | 'treble' = 'bass'): RhythmScene {
  const notes =
    staff === 'bass' ? TUNE : TUNE.map((t) => ({ ...t, octave: t.octave + 1 }))
  return {
    staff,
    strip: false,
    space: 14,
    headroom: 1.6,
    footroom: 1.4,
    rows: [{ bars: BARS, bpm: 60, notes }],
  }
}

/** The tune drawn at a phone's figure size, with its marks over it. */
function drawn(staff: 'bass' | 'treble' = 'bass') {
  const el = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  document.body.replaceChildren(el)
  const sc = scene(staff)
  const fig: RhythmFigure = drawRhythm(el, sc, { w: 390, h: 310 })
  const marks = createReadMarks()
  marks.draw(fig, el, sc)
  return { el, fig, marks, sc }
}

const all = (el: Element, sel: string): Element[] =>
  Array.from(el.querySelectorAll(sel))
const num = (e: Element | null | undefined, attr: string): number =>
  Number(e?.getAttribute(attr))
const headX = (fig: RhythmFigure, i: number): number =>
  symbolX(fig.layout.rows[0], fig.rows[0].placed[i])

describe('the reading staff’s marks', () => {
  it('puts the house under the first note on do, and each note’s syllable under the staff while Names is on (Lesson 16’s)', () => {
    // Arrange
    const { el, marks } = drawn()

    // Act
    marks.set({ home: DO, syllables: true })
    const named = all(el, '.rd-syl').map((t) => t.textContent)
    marks.set({ syllables: false })

    // Assert
    expect(all(el, '.rd-house').map((h) => h.getAttribute('data-i'))).toEqual([
      '0',
    ])
    expect(named).toEqual(['do', 're', 'mi', 're', 'do', 'mi', 'so'])
    expect(all(el, '.rd-syl')).toHaveLength(0)
    expect(all(el, '.rd-house')).toHaveLength(1)
  })

  it('writes a name over a note and a tag under it as it is read, the tag in its syllable’s place, in two short lines', () => {
    // Arrange
    const { el, fig, marks } = drawn()
    marks.set({ home: DO, syllables: true })

    // Act: Merc named do on beat 1 and sang it on beat 2
    marks.set({ names: ['do'], tags: ['1 beat late'] })

    // Assert: the name sits over the head, the tag under the staff
    const name = el.querySelector('.rd-name')
    const tag = el.querySelector('.rd-tag')
    expect(name?.textContent).toBe('do')
    expect(
      Array.from(tag?.querySelectorAll('tspan') ?? [], (t) => t.textContent),
    ).toEqual(['1 beat', 'late'])
    expect(num(name, 'y')).toBeLessThan(num(tag, 'y'))
    // its second line ends above the pads' numbers
    const second = tag?.querySelectorAll('tspan')[1]
    expect(num(tag, 'y') + num(second, 'dy')).toBeLessThan(
      fig.layout.rows[0].numberY - fig.layout.rows[0].space,
    )
    expect(
      all(el, '.rd-syl').map((t) => t.getAttribute('data-i')),
    ).not.toContain('0')
    expect(all(el, '.rd-syl')).toHaveLength(6)
  })

  it('moves the cursor onto each note’s head on its beat, and stops it at the final bar line', () => {
    // Arrange
    const { el, fig, marks } = drawn()
    const row = fig.layout.rows[0]

    // Act
    marks.set({ cursor: 0 })
    const first = num(el.querySelector('.rd-cursor'), 'x1')
    marks.set({ cursor: 5 })
    const sixth = num(el.querySelector('.rd-cursor'), 'x1')
    marks.set({ cursor: 8 })
    const end = num(el.querySelector('.rd-cursor'), 'x1')
    marks.set({ cursor: null })

    // Assert
    expect(first).toBeCloseTo(headX(fig, 0), 1)
    expect(sixth).toBeCloseTo(headX(fig, 5), 1)
    expect(end).toBeCloseTo(row.x1, 1)
    expect(cursorX(row, 8)).toBe(row.x1)
    expect(el.querySelector('.rd-cursor')).toBeNull()
  })

  it('lights the count-in’s dots one at a time, all four before bar 1', () => {
    // Arrange
    const { el, fig, marks } = drawn()

    // Act
    marks.set({ countIn: { dots: 4, lit: 2 } })

    // Assert
    const dots = all(el, '.rd-dot')
    expect(dots).toHaveLength(4)
    expect(dots.map((d) => d.classList.contains('is-lit'))).toEqual([
      false,
      false,
      true,
      false,
    ])
    for (const d of dots)
      expect(num(d, 'cx')).toBeLessThan(fig.layout.rows[0].x0)
  })

  it('fades a bracket in the first time it is drawn, never on a redraw, over its notes and above the highest, with a button at least 44 px tall', () => {
    // Arrange
    const { el, fig, marks, sc } = drawn()
    const run = { first: 0, last: 3, label: 'a run of steps' }

    // Act
    marks.set({ brackets: [run] })
    const fresh = el
      .querySelector('.rd-bracket')
      ?.classList.contains('is-fresh')
    marks.set({
      brackets: [run, { first: 4, last: 6, label: 'do-mi-so' }],
    })
    const second = all(el, '.rd-bracket').map((b) =>
      b.classList.contains('is-fresh'),
    )
    marks.draw(fig, el, sc)

    // Assert
    expect(fresh).toBe(true)
    expect(second).toEqual([false, true])
    expect(
      all(el, '.rd-bracket').map((b) => [
        b.classList.contains('is-fresh'),
        b.querySelector('text')?.textContent,
      ]),
    ).toEqual([
      [false, 'a run of steps'],
      [false, 'do-mi-so'],
    ])
    const [box, boxSo] = marks.bracketBoxes()
    expect(box.h).toBeGreaterThanOrEqual(44)
    expect(box.x).toBeLessThan(headX(fig, 0))
    expect(box.x + box.w).toBeGreaterThan(headX(fig, 3))
    // D4 stands over the bass staff: its bracket clears it, and the figure's top
    expect(boxSo.y + boxSo.h).toBeLessThan(fig.layout.rows[0].y)
    expect(boxSo.y).toBeGreaterThanOrEqual(0)
  })

  it('writes a song sheet’s marks where an engraver puts them: p over its note, a hairpin as far as it is drawn, a staccato dot over a head whose stem points down, a slur drawn as far as its notes have sounded, and a breath mark over its bar line', () => {
    // Arrange
    const { el, fig, marks } = drawn()
    const row = fig.layout.rows[0]

    // Act
    marks.set({
      marks: [
        { kind: 'p', at: 0 },
        { kind: 'cresc', from: 6, to: 7, drawn: 0.5 },
        { kind: 'staccato', at: 1 },
        { kind: 'slur', first: 0, last: 2, drawn: 0.5 },
        { kind: 'breath', beat: 4 },
      ],
    })

    // Assert
    const p = el.querySelector('[data-mark="p"]')
    expect(p?.textContent).toBe('p')
    expect(num(p, 'y')).toBeLessThan(row.y - row.space * 2)
    expect(el.querySelector('[data-mark="cresc"]')).not.toBeNull()
    const dot = el.querySelector('[data-mark="staccato"]')
    expect(num(dot, 'cy')).toBeLessThan(row.y - row.space * 0.5)
    expect(
      el.querySelector('[data-mark="slur"]')?.getAttribute('stroke-dasharray'),
    ).toBe('0.500 1')
    const comma = el.querySelector('[data-mark="breath"]')
    expect(comma?.textContent).toBe(',')
    expect(
      Math.abs(num(comma, 'x') - (row.x0 + (row.x1 - row.x0) / 2)),
    ).toBeLessThan(row.space)
  })

  it('moves the cursor every frame without touching the rest', () => {
    // Arrange
    const { el, marks } = drawn()
    marks.set({
      home: DO,
      brackets: [{ first: 0, last: 3, label: 'a run of steps' }],
    })
    const bracket = el.querySelector('.rd-bracket')
    const house = el.querySelector('.rd-house')

    // Act
    marks.set({ cursor: 1.5 })
    marks.set({ cursor: 2 })

    // Assert
    expect(el.querySelector('.rd-bracket')).toBe(bracket)
    expect(el.querySelector('.rd-house')).toBe(house)
    expect(all(el, '.rd-cursor')).toHaveLength(1)
  })

  it('writes the treble staff’s marks too: the house on G4’s line, a name over an up stem', () => {
    // Arrange
    const { el, fig, marks } = drawn('treble')
    const row = fig.layout.rows[0]

    // Act
    marks.set({ home: n('G', 4), names: ['do'] })

    // Assert: G4's stem points up, so its name clears the stem's end
    expect(all(el, '.rd-house')).toHaveLength(1)
    expect(num(el.querySelector('.rd-name'), 'y')).toBeLessThan(
      row.y - row.space * 2,
    )
  })
})
