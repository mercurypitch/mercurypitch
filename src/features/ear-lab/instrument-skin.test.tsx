// An instrument a stage may draw its own way (instrument-skin.ts): the
// web's drawing where the stage has none, the stage's own where it has
// one, with the props the drill passed either way.

import { cleanup, render, screen } from '@solidjs/testing-library'
import type { JSX } from 'solid-js'
import { afterEach, describe, expect, it } from 'vitest'
import type { InstrumentSkin } from './instrument-skin'
import { InstrumentSkinContext, skinnable } from './instrument-skin'

afterEach(cleanup)

interface DialProps {
  value: number
}

const Dial = skinnable('Dial', (props: DialProps) => (
  <span data-testid="drawn">web {props.value}</span>
))

const OWN: InstrumentSkin = {
  Dial: ((props: DialProps): JSX.Element => (
    <span data-testid="drawn">lit {props.value}</span>
  )) as never,
}

describe('an instrument a stage may draw its own way', () => {
  it('draws itself where the stage has no drawing of its own', () => {
    render(() => <Dial value={3} />)
    expect(screen.getByTestId('drawn').textContent).toBe('web 3')
  })

  it("is the stage's own drawing under a stage that has one, given the same props", () => {
    render(() => (
      <InstrumentSkinContext.Provider value={OWN}>
        <Dial value={7} />
      </InstrumentSkinContext.Provider>
    ))
    expect(screen.getByTestId('drawn').textContent).toBe('lit 7')
  })

  it('draws itself under a stage that draws other instruments, not this one', () => {
    render(() => (
      <InstrumentSkinContext.Provider value={{ Arc: OWN.Dial }}>
        <Dial value={2} />
      </InstrumentSkinContext.Provider>
    ))
    expect(screen.getByTestId('drawn').textContent).toBe('web 2')
  })
})
