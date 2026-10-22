// The metronome drawing: one gradient id per copy, so copies on one page never share one.

import { describe, expect, it } from 'vitest'
import './browser-doubles.test-fixtures'
import { metronomeSVG } from './explorer-figures'

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
