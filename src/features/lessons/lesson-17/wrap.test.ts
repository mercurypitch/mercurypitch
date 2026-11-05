// ============================================================
// Lesson 17 wrap tests — the practice card's rest line, the tease still
// ============================================================
//
// On the page's own markup (WEB-SPEC, Practice links; FACTS 56): the rest
// line shows above the card's text only while the sung bars' ending is
// rest, and The Chart's link stays either way, since it asks for no voice.
// The tease still (Toys 11) is Lesson 18's opening line on the bass staff,
// written whole over the beat grid, with nothing lit and nothing read.

import { afterEach, describe, expect, it } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import { VisitEnding } from '@/features/lessons/kit/comfort'
import { el, loadPage } from './page-dom.test-fixtures'
import { drawTease, initWrap, TEASE_BARS, TEASE_NOTES } from './wrap'

afterEach(() => {
  VisitEnding.set('practise')
  document.body.textContent = ''
})

describe('the practice card', () => {
  it("shows the rest line only once the sung bars' ending is rest, keeping The Chart's link", () => {
    // Arrange
    loadPage()
    initWrap()
    const rest = el('#practiseCard [data-ending="rest"]')
    const before = rest.hidden

    // Act
    VisitEnding.set('rest')
    const resting = rest.hidden
    VisitEnding.set('practise')

    // Assert
    expect([before, resting, rest.hidden]).toEqual([true, false, true])
    expect(el('#practiseCard a.addr').getAttribute('href')).toBe(
      '/ear-lab?lesson=17',
    )
  })
})

describe('the tease still', () => {
  it("writes Lesson 18's opening line on the bass staff over the beat grid, whole, with nothing lit and nothing read", () => {
    // Arrange
    loadPage()
    const svg = el<SVGSVGElement>('.l17-tease svg[data-tease-staff]')

    // Act
    initWrap()
    const drawn = svg.querySelectorAll('.rb-head').length
    const fig = drawTease(svg)

    // Assert: G3 A3 B3 A3, then G3 B3 D4, over the bass staff's middle line (FACTS 5)
    expect(drawn).toBe(7)
    const row = fig.layout.rows[0]
    const heads = Array.from(svg.querySelectorAll('.rb-head'))
    expect(
      heads.map((h) => (row.y - Number(h.getAttribute('cy'))) / row.space),
    ).toEqual([1.5, 2, 2.5, 2, 1.5, 2.5, 3.5])
    expect(svg.querySelectorAll('.rb-head.rb-open')).toHaveLength(1)
    expect(svg.querySelectorAll('.rb-note .rb-staff')).toHaveLength(1)
    expect(svg.dataset.staff).toBe('bass')
    expect(
      Array.from(svg.querySelectorAll('.rb-pad-n'), (n) => n.textContent),
    ).toEqual(['1', '2', '3', '4', '1', '2', '3', '4'])
    expect(svg.querySelectorAll('.rb-cell, .rb-read')).toHaveLength(0)
    expect(
      svg.querySelectorAll(
        '.rb-sym.is-hidden, .rb-barline.is-hidden, .rb-metre.is-hidden',
      ),
    ).toHaveLength(0)
    expect(
      svg.querySelectorAll('.is-sounding, .is-now, .is-chosen'),
    ).toHaveLength(0)
    expect(svg.closest('[aria-hidden="true"]')).not.toBeNull()
    expect(svg.closest('[data-next-card]')).not.toBeNull()
    expect(TEASE_BARS.flat()).toHaveLength(TEASE_NOTES.length)
  })
})
