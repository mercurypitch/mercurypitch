// The metronome drawing: one gradient id per copy, so copies on one page
// never share one. Lesson 17's bar of four quarter notes over four pads,
// reading nothing in seconds.

import { describe, expect, it } from 'vitest'
import './browser-doubles.test-fixtures'
import { cardFigure, metronomeSVG } from './explorer-figures'
import { LESSONS_2, SEASON_2 } from './season-2'

describe('metronomeSVG', () => {
  it("keeps the explorer card's gradient id by default", () => {
    const svg = metronomeSVG()
    expect(svg).toContain('<linearGradient id="mt-body"')
    expect(svg).toContain('fill="url(#mt-body)"')
  })

  it('gives two copies on one page distinct ids, each filled from its own', () => {
    document.body.innerHTML = metronomeSVG('mt-stage') + metronomeSVG('mt-hero')
    const ids = [...document.querySelectorAll('linearGradient')].map(
      (g) => g.id,
    )
    expect(ids).toEqual(['mt-stage', 'mt-hero'])
    const fills = [
      ...document.querySelectorAll('svg.metro > path:first-of-type'),
    ].map((p) => p.getAttribute('fill'))
    expect(fills).toEqual(['url(#mt-stage)', 'url(#mt-hero)'])
    expect(document.querySelectorAll('svg.metro g.arm')).toHaveLength(2)
  })
})

describe("Lesson 17's figure", () => {
  it('writes four quarter notes on one line over four numbered pads, captioned, with no reading in seconds', () => {
    // Arrange: Lesson 17's WEB-SPEC, Explorer and season data
    const L17 = LESSONS_2.find((L) => L.n === 17)
    if (L17 === undefined) throw new Error('no Lesson 17')

    // Act
    const f = cardFigure(L17, undefined, SEASON_2.figures)

    // Assert
    const svg = f?.querySelector('svg.ex-rhythm')
    expect(L17.fig).toBe('rhythm')
    expect(svg?.getAttribute('aria-hidden')).toBe('true')
    expect(svg?.querySelectorAll('path.line')).toHaveLength(1)
    expect(svg?.querySelectorAll('ellipse')).toHaveLength(4)
    expect(svg?.querySelectorAll('path.stem')).toHaveLength(4)
    expect(svg?.querySelectorAll('rect')).toHaveLength(4)
    const said = (sel: string) =>
      Array.from(svg?.querySelectorAll(sel) ?? [], (t) => t.textContent)
    expect(said('text:not(.metre)')).toEqual(['1', '2', '3', '4'])
    expect(said('text.metre')).toEqual(['4', '4'])
    const caption = f?.querySelector('figcaption')?.textContent ?? ''
    expect(caption).toBe(
      "A bar of four quarter notes, written over Lesson 8's beat pads",
    )
    expect([caption, ...said('text')].join(' ')).not.toMatch(/\d\s?s\b|second/)
  })

  it('draws no figure for a kind its season does not bring, never the plate', () => {
    // Arrange
    const L17 = LESSONS_2.find((L) => L.n === 17)
    if (L17 === undefined) throw new Error('no Lesson 17')

    // Act
    const f = cardFigure(L17, undefined)

    // Assert
    expect(f).toBeNull()
  })
})
