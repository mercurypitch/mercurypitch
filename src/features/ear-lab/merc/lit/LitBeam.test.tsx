// The Pull's beam: level while the notes sound, each pan lit as its note
// does; at the reveal the leaning pan named teal and the other at rest.

import { cleanup, render } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, describe, expect, it } from 'vitest'
import { LitBeam } from './LitBeam'

afterEach(cleanup)

describe("The Pull's beam", () => {
  it('lights the pan of the note sounding and names nothing', () => {
    const [sounding, setSounding] = createSignal<0 | 1 | 2>(0)
    render(() => <LitBeam sounding={sounding()} reveal={null} />)
    setSounding(2)
    expect(
      document
        .querySelector('[data-pan][data-sounding]')
        ?.getAttribute('data-pan'),
    ).toBe('2')
    expect(document.querySelectorAll('[data-part="pan-words"]')).toHaveLength(0)
  })

  it('names the leaning note and the one at rest at the reveal', () => {
    render(() => (
      <LitBeam
        sounding={0}
        reveal={{
          side: 2,
          pull: 4,
          word: 'Ti leaning to Do′',
          rest: 'Mi at rest',
          toward: 'up',
        }}
      />
    ))
    expect(
      document.querySelector('[data-leaning]')?.getAttribute('data-pan'),
    ).toBe('2')
    expect(
      [...document.querySelectorAll('[data-part="pan-words"]')].map(
        (words) => words.textContent,
      ),
    ).toEqual(['Mi at rest', 'Ti leaning to Do′'])
  })

  it("draws the cadence's four lamps", () => {
    render(() => <LitBeam sounding={0} reveal={null} cadence={0} />)
    expect(
      document.querySelectorAll('[data-part="cadence-lamp"]'),
    ).toHaveLength(4)
  })
})
