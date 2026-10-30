// Drift's pendulum: the beads light as their clicks sound and the arm
// stands upright on each click; the reveal turns the drifted beads and
// says which way the tempo went.

import { cleanup, render, screen } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, describe, expect, it } from 'vitest'
import { LitPendulum } from './LitPendulum'

afterEach(cleanup)

const beads = (flag: string): string[] =>
  [...document.querySelectorAll(`[data-bead][${flag}]`)].map(
    (bead) => bead.getAttribute('data-bead') ?? '',
  )

describe("Drift's pendulum", () => {
  it('lights each bead as its click sounds, the arm upright on the click', () => {
    const [lit, setLit] = createSignal(0)
    render(() => (
      <LitPendulum count={11} lit={lit()} steady={5} reveal={null} />
    ))
    setLit(1)
    setLit(2)
    setLit(3)
    expect(beads('data-sounded')).toEqual(['1', '2', '3'])
    expect(beads('data-drifted')).toEqual([])
    expect(
      document.querySelector('[data-part="arm"]')?.getAttribute('data-angle'),
    ).toBe('0')
    expect(document.querySelector('[data-part="tempo-word"]')).toBeNull()
    expect(screen.getByRole('img').getAttribute('aria-label')).toBe(
      'A pendulum over eleven beads, click 3 of 11',
    )
  })

  it('turns the drifted six at the reveal and says the tempo gained', () => {
    render(() => (
      <LitPendulum
        count={11}
        lit={0}
        steady={5}
        reveal={{ way: 'faster', percent: '4' }}
      />
    ))
    expect(beads('data-drifted')).toEqual(['6', '7', '8', '9', '10', '11'])
    expect(
      document.querySelector('[data-part="tempo-word"]')?.textContent,
    ).toBe('Gained 4%')
    expect(screen.getByRole('img').getAttribute('aria-label')).toBe(
      'A pendulum over eleven beads: the tempo gained 4 percent',
    )
  })

  it('says a steady train held', () => {
    render(() => (
      <LitPendulum
        count={11}
        lit={0}
        steady={5}
        reveal={{ way: 'steady', percent: '4' }}
      />
    ))
    expect(
      document.querySelector('[data-part="tempo-word"]')?.textContent,
    ).toBe('Held steady')
  })
})
