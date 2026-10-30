// Cadence's orbs: alike and strumming in turn while the progression
// plays; lifted to their roots and numbered at the reveal.

import { cleanup, render } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, describe, expect, it } from 'vitest'
import { LitOrbs } from './LitOrbs'

afterEach(cleanup)

const texts = (part: string): Array<string | null> =>
  [...document.querySelectorAll(`[data-part="${part}"]`)].map(
    (node) => node.textContent,
  )

describe("Cadence's orbs", () => {
  it('strums each orb in its turn and names nothing', () => {
    const [sounding, setSounding] = createSignal(0)
    render(() => <LitOrbs count={4} sounding={sounding()} reveal={null} />)
    setSounding(1)
    setSounding(2)
    expect(
      [...document.querySelectorAll('[data-orb][data-sounding]')].map((orb) =>
        orb.getAttribute('data-orb'),
      ),
    ).toEqual(['2'])
    expect(texts('numeral')).toEqual([])
    expect(texts('progression')).toEqual([])
  })

  it('numbers the orbs at the reveal and names the progression', () => {
    render(() => (
      <LitOrbs
        count={4}
        sounding={0}
        reveal={{ degrees: [1, 5, 6, 4], name: 'I–V–vi–IV' }}
      />
    ))
    expect(texts('numeral')).toEqual(['I', 'V', 'vi', 'IV'])
    expect(texts('progression')).toEqual(['I–V–vi–IV'])
  })
})
