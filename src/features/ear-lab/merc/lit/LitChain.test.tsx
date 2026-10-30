// The phrase drills' ladder: the beads light in turn on one level while
// the phrase sounds; at the reveal a match is ringed teal and a miss
// leaves a red ring where it was tapped. Bassline's ladder is the seven
// roots over the held tonic, and Echo's cadence lights its lamps.

import { cleanup, render } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, describe, expect, it } from 'vitest'
import { LitChain } from './LitChain'

afterEach(cleanup)

const parts = (part: string): Element[] => [
  ...document.querySelectorAll(`[data-part="${part}"]`),
]

describe('The phrase ladder', () => {
  it('lights the beads in turn and keeps their heights back', () => {
    const [sounding, setSounding] = createSignal(0)
    render(() => <LitChain count={4} sounding={sounding()} reveal={null} />)
    setSounding(1)
    setSounding(2)
    expect(
      [...document.querySelectorAll('[data-bead][data-sounding]')].map((bead) =>
        bead.getAttribute('data-bead'),
      ),
    ).toEqual(['2'])
    const heights = new Set(
      [...document.querySelectorAll('[data-bead] > g')].map(
        (orb) => orb.getAttribute('transform')?.split(' ')[1],
      ),
    )
    expect(heights.size).toBe(1)
    expect(document.body.textContent).toContain('Do′')
  })

  it('rings a match teal and a miss red at the reveal, naming the first slip', () => {
    render(() => (
      <LitChain
        count={4}
        sounding={0}
        reveal={{
          expected: [1, 3, 2, 1],
          answered: [1, 3, 4, 1],
          perNote: [true, true, false, true],
        }}
      />
    ))
    expect(parts('match')).toHaveLength(3)
    expect(parts('miss')).toHaveLength(1)
    expect(parts('slip')[0]?.textContent).toBe('first slip at note 3')
  })

  it("draws Bassline's seven roots over the held tonic", () => {
    render(() => (
      <LitChain count={4} sounding={0} reveal={null} ladder="roots" />
    ))
    expect(document.body.textContent).toContain('vii°')
    expect(document.body.textContent).not.toContain('Do′')
    expect(parts('held')).toHaveLength(1)
  })

  it("lights Echo's cadence lamp for the chord sounding", () => {
    const [cadence, setCadence] = createSignal(0)
    render(() => (
      <LitChain count={4} sounding={0} reveal={null} cadence={cadence()} />
    ))
    expect(parts('cadence-lamp')).toHaveLength(4)
    setCadence(1)
    setCadence(2)
    expect(
      parts('cadence-lamp').map((lamp) => lamp.hasAttribute('data-lit')),
    ).toEqual([false, true, false, false])
  })
})
