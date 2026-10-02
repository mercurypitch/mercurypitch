// The rail: the capsule then the timeline, and a side dock that leaves the
// timeline out. Its widths are a layout question for the browser spec
// (src/e2e/stem-mixer-rail.spec.ts); jsdom has no layout.

import { cleanup, render, screen } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, describe, expect, it } from 'vitest'
import { MixerRail } from './MixerRail'

afterEach(cleanup)

describe('MixerRail', () => {
  it('puts the timeline after the capsule, and drops it on a side dock', () => {
    const [vertical, setVertical] = createSignal(false)
    render(() => (
      <MixerRail
        vertical={vertical()}
        capsule={<div data-testid="capsule" />}
        timeline={<div data-testid="timeline" />}
      />
    ))
    const rail = screen.getByTestId('mixer-rail')
    expect(
      Array.from(rail.querySelectorAll('[data-testid]')).map((el) =>
        el.getAttribute('data-testid'),
      ),
    ).toEqual(['capsule', 'timeline'])

    setVertical(true)
    expect(screen.queryByTestId('timeline')).toBeNull()
    expect(rail).toHaveAttribute('data-vertical', 'true')

    setVertical(false)
    expect(screen.getByTestId('timeline').parentElement?.parentElement).toBe(
      rail,
    )
  })
})
