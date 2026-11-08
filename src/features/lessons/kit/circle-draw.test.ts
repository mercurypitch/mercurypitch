// ============================================================
// Circle drawing tests — the beads, their names, the thread, the house and the gap
// ============================================================
//
// The circle toy's picture (Lesson 21's WEB-SPEC, Toys 3, and Look): twelve
// beads on the orbit, on the circle of fifths each name outside the ring
// and the bottom three's two names; on the ring by semitones a black key's
// bead small and unnamed unless the key holds it; the thread through each
// bead in turn, the house inside the ring by its bead, and the walk's gap,
// a short arc past C with its label; and a word's small figure, its twelve
// beads apart in 88 px and its names inside the beads.

import { describe, expect, it } from 'vitest'
import './browser-doubles.test-fixtures'
import type { BeadView, CircleScene } from './circle-draw'
import { drawCircle } from './circle-draw'
import { angleOf, CIRCLE, FIFTHS } from './circle-geometry'
import { signName } from './notes'

const SIZE = { w: 320, h: 300 }

function figure(): SVGSVGElement {
  const el = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  document.body.replaceChildren(el)
  return el
}

/** The circle of fifths, every key named, C lit, the five past three dimmed. */
function fifthsScene(over: Partial<CircleScene> = {}): CircleScene {
  const beads: BeadView[] = CIRCLE.map((k) => ({
    pc: k.pc,
    angle: angleOf(k.seat),
    look: !k.read ? 'dim' : k.seat === 0 ? 'lit' : 'rest',
    names: [k.tonic, k.twin].flatMap((s) =>
      s === null ? [] : [signName(s, { octave: false })],
    ),
    big: true,
  }))
  return { beads, fifths: true, house: null, thread: [], gap: null, ...over }
}

const texts = (el: Element): string[] =>
  Array.from(el.querySelectorAll('text'), (t) => t.textContent ?? '')

describe('drawCircle', () => {
  it('draws the orbit and twelve beads, the five past three dimmed', () => {
    // Arrange
    const el = figure()

    // Act
    drawCircle(el, fifthsScene(), SIZE)

    // Assert
    expect(el.querySelectorAll('.ci-orbit')).toHaveLength(1)
    expect(el.querySelectorAll('circle.ci-bead')).toHaveLength(12)
    expect(el.querySelectorAll('circle.ci-bead.is-dim')).toHaveLength(5)
    expect(el.querySelectorAll('circle.ci-bead.is-lit')).toHaveLength(1)
  })

  it('names every key outside the ring, the bottom three twice, the sharp name over the flat', () => {
    // Arrange
    const el = figure()

    // Act
    const L = drawCircle(el, fifthsScene(), SIZE)

    // Assert: twelve names and three second names
    expect(texts(el)).toHaveLength(15)
    for (const t of el.querySelectorAll('text.ci-name')) {
      const dx = Number(t.getAttribute('x')) - L.cx
      const dy = Number(t.getAttribute('y')) - L.cy
      expect(Math.hypot(dx, dy)).toBeGreaterThan(L.r + L.bead)
    }
    const fSharp = Array.from(el.querySelectorAll('text.ci-name')).filter(
      (t) => t.textContent === 'F♯' || t.textContent === 'G♭',
    )
    expect(fSharp.map((t) => t.textContent)).toEqual(['F♯', 'G♭'])
    expect(Number(fSharp[0].getAttribute('y'))).toBeLessThan(
      Number(fSharp[1].getAttribute('y')),
    )
  })

  it('draws the thread through each bead in turn', () => {
    // Arrange: the walk so far, C, G, D, A
    const el = figure()

    // Act
    const L = drawCircle(el, fifthsScene({ thread: FIFTHS.slice(0, 4) }), SIZE)

    // Assert
    const d = el.querySelector('.ci-thread')?.getAttribute('d') ?? ''
    const pts = [...d.matchAll(/[ML]([-\d.]+) ([-\d.]+)/g)].map((m) => ({
      x: Number(m[1]),
      y: Number(m[2]),
    }))
    expect(pts).toHaveLength(4)
    pts.forEach((p, i) => {
      const at = L.at(angleOf(i))
      expect(p.x).toBeCloseTo(at.x, 1)
      expect(p.y).toBeCloseTo(at.y, 1)
    })
  })

  it('draws the gap past C, labelled, only on a walk that overshoots', () => {
    // Arrange: the whole walk, back on C
    const walk = [...FIFTHS, 0]
    const closed = figure()
    drawCircle(closed, fifthsScene({ thread: walk }), SIZE)
    const open = figure()

    // Act
    drawCircle(
      open,
      fifthsScene({
        thread: walk,
        gap: { sweep: Math.PI / 12, label: '23.46 cents' },
      }),
      SIZE,
    )

    // Assert
    expect(closed.querySelectorAll('.ci-gap')).toHaveLength(0)
    expect(open.querySelectorAll('.ci-gap')).toHaveLength(1)
    expect(texts(open)).toContain('23.46 cents')
  })

  it('puts the house inside the ring, by its bead', () => {
    // Arrange
    const el = figure()

    // Act
    const L = drawCircle(el, fifthsScene({ house: angleOf(1) }), SIZE)

    // Assert
    const home = el.querySelector('.ci-home')
    const m = /translate\(([-\d.]+) ([-\d.]+)\)/.exec(
      home?.getAttribute('transform') ?? '',
    )
    const x = Number(m?.[1])
    const y = Number(m?.[2])
    expect(Math.hypot(x - L.cx, y - L.cy)).toBeLessThan(L.r)
    // to the right of the centre, as G is
    expect(x).toBeGreaterThan(L.cx - 30)
  })

  it('on the ring by semitones, draws a black key small and unnamed unless the key holds it', () => {
    // Arrange: D major's two black keys, F sharp and C sharp
    const beads: BeadView[] = Array.from({ length: 12 }, (_, pc) => {
      const black = [1, 3, 6, 8, 10].includes(pc)
      const held = pc === 1 || pc === 6
      return {
        pc,
        angle: angleOf(pc),
        look: held ? 'key' : 'rest',
        names: black && !held ? [] : ['X'],
        big: !black || held,
      }
    })
    const el = figure()

    // Act
    const L = drawCircle(
      el,
      { beads, fifths: false, house: null, thread: [], gap: null },
      SIZE,
    )

    // Assert
    const radii = Array.from(el.querySelectorAll('circle.ci-bead'), (c) =>
      Number(c.getAttribute('r')),
    )
    expect(radii.filter((r) => r < L.bead * 0.6)).toHaveLength(3)
    expect(el.querySelectorAll('circle.ci-bead.is-key')).toHaveLength(2)
    expect(texts(el)).toHaveLength(9)
  })
})

/** Each bead's centre and radius, in drawing order. */
const circles = (el: Element) =>
  Array.from(el.querySelectorAll('circle.ci-bead'), (c) => ({
    x: Number(c.getAttribute('cx')),
    y: Number(c.getAttribute('cy')),
    r: Number(c.getAttribute('r')),
  }))

describe("a word's small figure", () => {
  const WORD = { w: 88, h: 120 }

  it('keeps the ring by semitones apart in 88 px: no bead touches the next, F sharp and its neighbours large', () => {
    // Arrange: G major's ring, F sharp's bead large
    const beads: BeadView[] = Array.from({ length: 12 }, (_, pc) => ({
      pc,
      angle: angleOf(pc),
      look: 'rest',
      names: [],
      big: ![1, 3, 8, 10].includes(pc),
    }))
    const el = figure()

    // Act
    drawCircle(
      el,
      { beads, fifths: false, house: null, thread: [], gap: null, small: true },
      WORD,
    )

    // Assert
    const c = circles(el)
    c.forEach((a, i) => {
      const b = c[(i + 1) % 12]
      expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(a.r + b.r)
    })
    expect(texts(el)).toHaveLength(0)
  })

  it('names its beads inside them, on the circle of fifths too, each clear of the next', () => {
    // Arrange: four keys a fifth apart, C at the top
    const beads: BeadView[] = ['C', 'G', 'D', 'A'].map((name, seat) => ({
      pc: FIFTHS[seat],
      angle: angleOf(seat),
      look: 'rest',
      names: [name],
      big: true,
    }))
    const el = figure()

    // Act
    const L = drawCircle(
      el,
      { beads, fifths: true, house: 0, thread: [], gap: null, small: true },
      WORD,
    )

    // Assert
    const names = Array.from(el.querySelectorAll('text.ci-name'))
    expect(names.map((t) => t.textContent)).toEqual(['C', 'G', 'D', 'A'])
    names.forEach((t, seat) => {
      const at = L.at(angleOf(seat))
      expect(Number(t.getAttribute('x'))).toBeCloseTo(at.x, 1)
      expect(Number(t.getAttribute('y'))).toBeCloseTo(at.y, 1)
      expect(t.classList.contains('is-out')).toBe(false)
    })
    const c = circles(el)
    for (let i = 1; i < 4; i++)
      expect(
        Math.hypot(c[i].x - c[i - 1].x, c[i].y - c[i - 1].y),
      ).toBeGreaterThanOrEqual(c[i].r + c[i - 1].r)
  })
})
