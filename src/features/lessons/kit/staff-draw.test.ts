// ============================================================
// Staff drawing tests — five lines, the clefs, a note's ledgers, sign and lane
// ============================================================
//
// The staff toy's picture (Lesson 15's WEB-SPEC, Toys 1 and Look): a staff
// in either clef or the grand staff, ledger lines only as far as a note
// needs, a sign to the left of its note's head, a lit note's halo, the gold
// line of a clef, the letters kept beside the staff, the pitch line's lanes
// joined to a sounding note, and the key strip with its C keys named.

import { describe, expect, it } from 'vitest'
import './browser-doubles.test-fixtures'
import type { Spelled } from './notes'
import type { Mark, Scene } from './staff-draw'
import { drawScene, emptyScene, headHalf, layoutScene } from './staff-draw'
import { placeRange } from './staff-places'

const SIZE = { w: 356, h: 310 }

const C4: Spelled = { letter: 'C', alter: 0, octave: 4 }
const G4: Spelled = { letter: 'G', alter: 0, octave: 4 }
const F_SHARP_4: Spelled = { letter: 'F', alter: 1, octave: 4 }
const B_FLAT_4: Spelled = { letter: 'B', alter: -1, octave: 4 }

function figure(): SVGSVGElement {
  const el = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  document.body.replaceChildren(el)
  return el
}

/** A treble staff with `marks` on it, and whatever else `over` sets. */
function treble(marks: readonly Mark[], over: Partial<Scene> = {}): Scene {
  return { ...emptyScene('treble', placeRange('treble')), marks, ...over }
}

const count = (el: Element, sel: string): number =>
  el.querySelectorAll(sel).length

describe('drawScene', () => {
  it('draws one staff as five lines and its clef, and the grand staff as ten lines, two clefs and a brace', () => {
    // Arrange
    const one = figure()
    drawScene(one, treble([]), SIZE)
    const both = figure()

    // Act
    drawScene(both, emptyScene('grand', placeRange('grand')), SIZE)

    // Assert
    expect(count(one, '.st-line')).toBe(5)
    expect(count(one, '.st-clef')).toBe(1)
    expect(count(one, '.st-brace')).toBe(0)
    // the grand staff's ten lines and the line that joins them at the left
    expect(count(both, 'line.st-line')).toBe(11)
    expect(count(both, '.st-clef')).toBe(2)
    expect(count(both, '.st-brace')).toBe(1)
    // no ledger line until a note needs one: middle C's is drawn with its note
    expect(count(both, '.st-ledger')).toBe(0)
  })

  it('draws a staff with no clef where the scene leaves it out', () => {
    // Arrange
    const el = figure()

    // Act
    drawScene(el, treble([], { noClef: true }), SIZE)

    // Assert
    expect(count(el, '.st-line')).toBe(5)
    expect(count(el, '.st-clef')).toBe(0)
  })

  it('spaces the five lines evenly, the clef of each staff on its own bottom line', () => {
    // Arrange
    const el = figure()
    const L = drawScene(el, treble([]), SIZE)

    // Act
    const ys = Array.from(el.querySelectorAll('.st-line'), (l) =>
      Number(l.getAttribute('y1')),
    )

    // Assert
    const gaps = ys.slice(1).map((y, i) => ys[i] - y)
    for (const gap of gaps) expect(gap).toBeCloseTo(L.space, 1)
    expect(ys[0]).toBeCloseTo(L.yOf(0), 1)
  })

  it('draws a note with only the ledger lines it needs, each a little wider than its head', () => {
    // Arrange
    const el = figure()

    // Act: middle C under the treble staff
    const L = drawScene(el, treble([{ note: C4, tone: 'rest' }]), SIZE)

    // Assert
    const ledgers = Array.from(el.querySelectorAll('.st-ledger'))
    expect(ledgers).toHaveLength(1)
    const [l] = ledgers
    expect(Number(l.getAttribute('y1'))).toBeCloseTo(L.yOf(-2), 1)
    const width = Number(l.getAttribute('x2')) - Number(l.getAttribute('x1'))
    expect(width).toBeGreaterThan(2 * headHalf(L.space))
    expect(width).toBeLessThan(2 * L.space)
  })

  it("draws middle C's one line between the grand staff's staves", () => {
    // Arrange
    const el = figure()

    // Act
    const L = drawScene(
      el,
      {
        ...emptyScene('grand', placeRange('grand')),
        marks: [{ note: C4, tone: 'rest' }],
      },
      SIZE,
    )

    // Assert
    const ledgers = Array.from(el.querySelectorAll('.st-ledger'))
    expect(ledgers).toHaveLength(1)
    expect(Number(ledgers[0].getAttribute('y1'))).toBeCloseTo(L.yOf(10), 1)
  })

  it("writes a sharp or a flat on its letter's place, to the left of the head", () => {
    // Arrange
    const sharp = figure()
    drawScene(sharp, treble([{ note: F_SHARP_4, tone: 'rest' }]), SIZE)
    const flat = figure()

    // Act
    drawScene(flat, treble([{ note: B_FLAT_4, tone: 'rest' }]), SIZE)

    // Assert
    for (const el of [sharp, flat]) {
      expect(count(el, '.st-sign')).toBe(1)
      const x = (sel: string): number =>
        Number(
          /translate\(([-\d.]+)/.exec(
            el.querySelector(sel)?.getAttribute('transform') ?? '',
          )?.[1],
        )
      expect(x('.st-sign')).toBeLessThan(x('.st-head'))
    }
    expect(sharp.querySelector('.st-sign')?.getAttribute('d')).not.toBe(
      flat.querySelector('.st-sign')?.getAttribute('d'),
    )
  })

  it('lights a sounding note with a halo, never by colour alone, and names it beside it', () => {
    // Arrange
    const el = figure()

    // Act
    drawScene(el, treble([{ note: G4, tone: 'lit', named: true }]), SIZE)

    // Assert
    expect(el.querySelector('.st-head')?.getAttribute('class')).toBe(
      'st-head is-lit',
    )
    expect(count(el, '.st-halo')).toBe(1)
    expect(el.querySelector('.st-name')?.textContent).toBe('G4')
  })

  it('draws a note at rest with no halo, Merc’s sung note blue and the sung model amber', () => {
    // Arrange
    const el = figure()

    // Act
    drawScene(
      el,
      treble(
        [
          { note: G4, col: 0, tone: 'rest' },
          { note: G4, col: 1, tone: 'blue' },
          { note: G4, col: 2, tone: 'amber' },
        ],
        { cols: 3 },
      ),
      SIZE,
    )

    // Assert
    expect(
      Array.from(el.querySelectorAll('.st-head'), (h) =>
        h.getAttribute('class'),
      ),
    ).toEqual(['st-head', 'st-head is-blue', 'st-head is-amber'])
    expect(count(el, '.st-halo')).toBe(2)
  })

  it("draws the gold line on the place its clef names, with that place's letter", () => {
    // Arrange
    const el = figure()

    // Act
    const L = drawScene(el, treble([], { gold: 'treble' }), SIZE)

    // Assert
    const gold = el.querySelector('.st-gold')
    expect(Number(gold?.getAttribute('y1'))).toBeCloseTo(L.yOf(2), 1)
    expect(el.querySelector('.st-gold-name')?.textContent).toBe('G')
  })

  it("keeps each played place's letter, lines' and spaces' in columns of their own", () => {
    // Arrange
    const el = figure()

    // Act: E, F and G, a line, a space and a line
    drawScene(el, treble([], { letters: [0, 1, 2] }), SIZE)

    // Assert
    const letters = Array.from(el.querySelectorAll('.st-letter'))
    expect(letters.map((t) => t.textContent)).toEqual(['E', 'F', 'G'])
    const [e, f, g] = letters.map((t) => Number(t.getAttribute('x')))
    expect(e).toBe(g)
    expect(f).toBeGreaterThan(e)
  })

  it('draws the pitch line a lane a semitone, the sounding lane lit and joined to its head', () => {
    // Arrange
    const el = figure()

    // Act: D4 to G5 beside the treble staff, G4 sounding
    drawScene(
      el,
      treble([{ note: G4, tone: 'lit' }], { lanes: { lo: 62, hi: 79 } }),
      SIZE,
    )

    // Assert
    expect(count(el, '.st-lane')).toBe(18)
    expect(count(el, '.st-lane.is-black')).toBe(7)
    expect(count(el, '.st-lane.is-lit')).toBe(1)
    expect(count(el, '.st-connector')).toBe(1)
  })

  it('draws no pitch line where the scene has none, and joins no lane to a note at rest', () => {
    // Arrange
    const off = figure()
    drawScene(off, treble([{ note: G4, tone: 'lit' }]), SIZE)
    const resting = figure()

    // Act
    drawScene(
      resting,
      treble([{ note: G4, tone: 'rest' }], { lanes: { lo: 62, hi: 79 } }),
      SIZE,
    )

    // Assert
    expect(count(off, '.st-lane')).toBe(0)
    expect(count(resting, '.st-lane.is-lit')).toBe(0)
    expect(count(resting, '.st-connector')).toBe(0)
  })

  it("draws the key strip's window of white keys, naming each C and the lit key", () => {
    // Arrange
    const el = figure()

    // Act: G2 to F5, seven keys from C4, C♯4 lit
    drawScene(
      el,
      {
        ...emptyScene('grand', placeRange('grand')),
        keys: { lo: 43, hi: 77, from: 7, count: 7, lit: [61] },
      },
      SIZE,
    )

    // Assert
    const named = Array.from(
      el.querySelectorAll('.st-key-name'),
      (t) => t.textContent,
    )
    expect(named).toContain('C4')
    expect(count(el, '.st-key.is-black.is-lit')).toBe(1)
  })

  it('puts the house under do', () => {
    // Arrange
    const el = figure()

    // Act
    drawScene(el, treble([{ note: G4, tone: 'rest', home: true }]), SIZE)

    // Assert
    expect(count(el, '.st-home')).toBe(1)
  })

  it('draws the guide’s line across the run where the scene sweeps it', () => {
    // Arrange
    const el = figure()

    // Act
    drawScene(el, treble([], { sweep: 0.5, cols: 5 }), SIZE)

    // Assert
    expect(count(el, '.st-sweep')).toBe(1)
  })
})

describe('layoutScene', () => {
  it('reads a height back to the place drawn there, whatever the figure', () => {
    for (const size of [SIZE, { w: 900, h: 520 }]) {
      // Arrange
      const L = layoutScene(size.w, size.h, treble([]))

      // Assert
      for (let p = -4; p <= 12; p++) expect(L.placeAt(L.yOf(p))).toBe(p)
      // places are half a space apart, and a staff space keeps its bounds
      expect(L.yOf(0) - L.yOf(1)).toBeCloseTo(L.space / 2, 5)
      expect(L.space).toBeGreaterThanOrEqual(6)
      expect(L.space).toBeLessThanOrEqual(34)
    }
  })

  it("gives a single staff a phone's figure a space of 13 px or more, so a place is a usable tap", () => {
    // Act: the toy's whole range, two ledger lines each way
    const L = layoutScene(356, 310, treble([]))

    // Assert: FACTS 71, places 13 px apart on a phone
    expect(L.space / 2).toBeGreaterThanOrEqual(13)
  })

  it('makes room for the pitch line and the key strip when the scene draws them', () => {
    // Arrange
    const plain = layoutScene(356, 310, treble([]))

    // Act
    const lanes = layoutScene(
      356,
      310,
      treble([], { lanes: { lo: 57, hi: 84 } }),
    )
    const keys = layoutScene(356, 310, {
      ...emptyScene('grand', placeRange('grand')),
      keys: { lo: 43, hi: 77, from: 0, count: 7, lit: [] },
    })

    // Assert
    expect(plain.lanes).toBeNull()
    expect(lanes.lanes).not.toBeNull()
    expect(lanes.x0).toBeGreaterThan(plain.x0)
    expect(keys.strip).not.toBeNull()
    expect(keys.yOf(0)).toBeLessThan(keys.strip?.spec.top ?? 0)
  })
})
