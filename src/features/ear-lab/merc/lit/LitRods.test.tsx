// The Grid's rods: each click lights its own rod on the lattice and the
// answer stays back; the reveal slides the off rod, leaves its ghost and
// says how far.

import { cleanup, render, screen } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, describe, expect, it } from 'vitest'
import { LitRods } from './LitRods'

afterEach(cleanup)

const sounded = (): string[] =>
  [...document.querySelectorAll('[data-rod][data-sounded]')].map(
    (rod) => rod.getAttribute('data-rod') ?? '',
  )

describe("The Grid's rods", () => {
  it('lights each rod as its click sounds and keeps the answer back', () => {
    const [lit, setLit] = createSignal(0)
    render(() => <LitRods lit={lit()} running reveal={null} />)
    setLit(1)
    setLit(2)
    setLit(3)
    expect(sounded()).toEqual(['1', '2', '3'])
    expect(document.querySelector('[data-off]')).toBeNull()
    expect(document.querySelector('[data-part="ghost"]')).toBeNull()
    expect(screen.getByRole('img').getAttribute('aria-label')).toBe(
      'Six rods on a lattice; one of the last four is off the grid',
    )
  })

  it('starts the lights again with the next train', () => {
    const [lit, setLit] = createSignal(0)
    render(() => <LitRods lit={lit()} running reveal={null} />)
    for (const n of [1, 2, 3, 4, 5, 6, 0, 1]) setLit(n)
    expect(sounded()).toEqual(['1'])
  })

  it('slides the off rod at the reveal, leaves its ghost and says how far', () => {
    render(() => (
      <LitRods
        lit={0}
        running={false}
        reveal={{ index: 4, early: false, ms: 18 }}
      />
    ))
    expect(document.querySelector('[data-off]')?.getAttribute('data-rod')).toBe(
      '5',
    )
    expect(document.querySelector('[data-part="ghost"]')).not.toBeNull()
    expect(document.querySelector('[data-part="offset"]')?.textContent).toBe(
      '18 ms late',
    )
    expect(screen.getByRole('img').getAttribute('aria-label')).toBe(
      'Six rods on a lattice: the fifth click was 18 ms late',
    )
  })
})
