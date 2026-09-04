import { render } from '@solidjs/testing-library'
import { describe, expect, it } from 'vitest'
import { GAUGE, ShapeGauge, TUBE_HEIGHT, yFor } from './ShapeGauge'

const column = (c: HTMLElement): HTMLElement =>
  c.querySelector('.shape-gauge__column') as HTMLElement

/** The translateY the column was slid by, in drawing units, upward. */
const liftOf = (c: HTMLElement): number => {
  const m = /translateY\((-?[\d.]+)px\)/u.exec(column(c).style.transform)
  if (m === null)
    throw new Error(`no translateY in "${column(c).style.transform}"`)
  return -Number.parseFloat(m[1]!) + 0
}

describe('the shape gauge', () => {
  it('sits the column at the bottom for t = 0 and at the top for t = 1', () => {
    const low = render(() => (
      <ShapeGauge t={0} heard band={null} inBand={false} semis={24} />
    ))
    expect(liftOf(low.container)).toBeCloseTo(0, 9)
    const high = render(() => (
      <ShapeGauge t={1} heard band={null} inBand={false} semis={24} />
    ))
    expect(liftOf(high.container)).toBeCloseTo(TUBE_HEIGHT, 9)
  })

  it('clamps a t that ran off either end', () => {
    const c = render(() => (
      <ShapeGauge t={7} heard band={null} inBand={false} semis={24} />
    ))
    expect(liftOf(c.container)).toBeCloseTo(TUBE_HEIGHT, 9)
  })

  it('draws the band where the gate is, in the same scale as the column', () => {
    const c = render(() => (
      <ShapeGauge t={0.1} heard band={{ lo: 0, hi: 0.25 }} inBand semis={24} />
    ))
    const band = c.container.querySelector('.shape-gauge__band')!
    expect(Number(band.getAttribute('y'))).toBeCloseTo(yFor(0.25), 6)
    expect(Number(band.getAttribute('height'))).toBeCloseTo(
      0.25 * TUBE_HEIGHT,
      6,
    )
    expect(yFor(0)).toBe(GAUGE.tubeBottom)
    expect(c.container.querySelector('.shape-gauge')!.classList).toContain(
      'is-lit',
    )
  })

  it('draws no band when there is nothing to aim for', () => {
    const c = render(() => (
      <ShapeGauge t={0.1} heard band={null} inBand={false} semis={24} />
    ))
    expect(c.container.querySelector('.shape-gauge__band')).toBeNull()
  })

  // The Blackout's graft: a lost mic is greyed, never hidden.
  it('greys rather than hides when the mic loses the voice', () => {
    const c = render(() => (
      <ShapeGauge t={0.6} heard={false} band={null} inBand={false} semis={24} />
    ))
    const root = c.container.querySelector('.shape-gauge')!
    expect(root.classList).toContain('is-lost')
    expect(column(c.container)).not.toBeNull()
    expect(liftOf(c.container)).toBeCloseTo(0.6 * TUBE_HEIGHT, 6)
  })

  it('draws one tick per semitone with the octaves longer', () => {
    const c = render(() => (
      <ShapeGauge t={0} heard band={null} inBand={false} semis={24} />
    ))
    const ticks = [...c.container.querySelectorAll('.shape-gauge__ticks line')]
    expect(ticks).toHaveLength(25)
    expect(ticks.filter((l) => l.classList.contains('is-octave'))).toHaveLength(
      3,
    )
  })
})
