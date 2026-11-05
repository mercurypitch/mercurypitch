// ============================================================
// Lesson 17 rhythm views tests — each step's bars, plays and names
// ============================================================
//
// WEB-SPEC, Toys 1 and 5: every bar the steps write is whole, save the two
// rest examples that end on the next bar's first note; each rest example
// places its rest as FACTS 26a writes it, and only its cell reads; Dot and
// Tie make the bars the spec gives; the plays run in the spec's order and
// tempi; and each view is named for what it shows, written or on the pitch
// line.

import { describe, expect, it } from 'vitest'
import { fillsBars, placeBars, stripCells, } from '@/features/lessons/kit/rhythm-model'
import { lengthsWords } from '@/features/lessons/kit/rhythm-words'
import { BOTH_PARTS, BOTH_SIXTY, BOTH_TWICE, BOTH_VIEW, COUNT_BARS, COUNT_PARTS, FIG, HALVING_PARTS, REST_EXAMPLES, restView, rowView, staffBars, STATE_OF, TAKE_BARS, TEMPO_BAR, } from './rhythm-views'
import { TAKE_ONSETS } from './take-judge'

describe("the checkpoint's bars", () => {
  it('writes the two bars whose nine notes the take judges (FACTS 36)', () => {
    expect(fillsBars(TAKE_BARS)).toBe(true)
    expect(placeBars(TAKE_BARS).map((p) => p.beat)).toEqual([...TAKE_ONSETS])
  })
})

describe("the steps' bars", () => {
  it('gives each step a state and a figure label', () => {
    // Assert (WEB-SPEC, Toys 5)
    expect(Object.values(STATE_OF)).toEqual([
      'halves',
      'tempo',
      'count',
      'rests',
      'staff',
    ])
    expect([1, 2, 3, 4, 5].map((n) => FIG[n].replace(/<[^>]+>/g, ''))).toEqual([
      'Fig. 1 A bar, halved and joined',
      'Fig. 2 One bar, any tempo',
      'Fig. 3 The counts under the notes',
      'Fig. 4 Notes and rests',
      'Fig. 5 Two bars on the staff',
    ])
  })

  it('writes every bar whole', () => {
    // Arrange
    const bars = [
      [TEMPO_BAR],
      [BOTH_SIXTY],
      BOTH_TWICE,
      COUNT_BARS,
      ...[false, true].flatMap((dot) =>
        [false, true].map((tie) => staffBars(dot, tie)),
      ),
    ]

    // Assert
    for (const b of bars) expect(fillsBars(b)).toBe(true)
  })

  it('makes the bars Dot and Tie give, a tied pair one length', () => {
    // Act
    const plain = lengthsWords(staffBars(false, false), 60)
    const dotted = lengthsWords(staffBars(true, false), 60)
    const both = lengthsWords(staffBars(true, true), 60)

    // Assert (WEB-SPEC, Toys 1)
    expect(plain).toContain(': 2 seconds, then 1 second each, then 2 seconds.')
    expect(dotted).toContain(
      ': 3 seconds, then 1 second, then 1.5 seconds, then 0.5 seconds, then 2 seconds.',
    )
    expect(both).toContain(
      ': 3 seconds, then 2.5 seconds, then 0.5 seconds, then 2 seconds.',
    )
  })

  it("places each rest example's rest as 4/4 writes it, between two notes, and reads only its cell", () => {
    // Act
    const placed = Object.entries(REST_EXAMPLES).map(([key, ex]) => {
      const symbols = placeBars(ex.bars)
      const r = symbols.find((p) => p.kind === 'rest')
      const end = symbols.at(-1)
      const view = restView(key)
      const reads = stripCells(symbols).map(
        (_, i) => view?.scene.rows[0].reads?.(i) ?? true,
      )
      return {
        key,
        at: r?.beat,
        beats: end === undefined ? 0 : end.beat + end.beats,
        last: end?.kind,
        reads: reads.flatMap((on, i) => (on ? [i] : [])),
      }
    })

    // Assert (WEB-SPEC, Toys 1, "The rest strip"; FACTS 26a)
    expect(placed).toEqual([
      { key: '1', at: 1, beats: 4, last: 'note', reads: [1] },
      { key: '2', at: 2, beats: 5, last: 'note', reads: [2] },
      { key: '4', at: 4, beats: 9, last: 'note', reads: [4] },
      { key: '0.5', at: 1, beats: 4, last: 'note', reads: [1] },
      { key: '0.25', at: 1, beats: 4, last: 'note', reads: [1] },
    ])
    expect(restView('8')).toBeNull()
    expect(fillsBars(REST_EXAMPLES['2'].bars, true)).toBe(true)
  })

  it("plays the halvings and Step 3's bars in turn, each written fresh at 60, and Play both a second apart", () => {
    // Assert
    expect(HALVING_PARTS.map((p) => [p.fresh, p.bpm()])).toEqual(
      Array.from({ length: 5 }, () => [true, 60]),
    )
    expect(
      HALVING_PARTS.map((p) => p.view.scene.rows[0].bars[0].length),
    ).toEqual([1, 2, 4, 8, 16])
    expect(COUNT_PARTS.map((p) => [p.fresh, p.bpm()])).toEqual([
      [true, 60],
      [true, 60],
    ])
    expect(
      BOTH_PARTS.map((p) => [p.row, p.bpm(), p.pause ?? 0, p.view]),
    ).toEqual([
      [0, 60, 0, BOTH_VIEW],
      [1, 120, 1, BOTH_VIEW],
    ])
  })

  it('names each view for what it shows, written and on the pitch line', () => {
    // Act
    const tempo = rowView([TEMPO_BAR], 90, 'line')
    const staff = rowView(staffBars(false, true), 60, 'treble')

    // Assert (WEB-SPEC, Toys 1, "Keyboard and screen readers")
    expect([tempo.label, tempo.laneLabel]).toEqual([
      'One bar of 4/4: two quarter notes and a half note, on one line',
      'One bar of 4/4: two quarter notes and a half note, on the pitch line',
    ])
    expect(staff.label).toBe(
      'Two bars of 4/4: a half note and two quarter notes, then two quarter notes and a half note, tied across the bar line, on the treble staff',
    )
    expect(tempo.scene.rows[0].bpm).toBe(90)
    expect(BOTH_VIEW.label).toMatch(/^Two rows on one time axis, on one line/)
    expect(BOTH_VIEW.laneLabel).toMatch(
      /^Two rows on one time axis, on the pitch line/,
    )
  })
})
