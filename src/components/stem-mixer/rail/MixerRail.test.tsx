// The rail: the capsule's two ends and the timeline in one bar, a side dock
// that leaves the timeline out, the focus pill's bare look, and the width
// it reports for the speed fold. Where things land at each width is a
// layout question for the browser spec (src/e2e/stem-mixer-rail.spec.ts);
// jsdom has no layout.

import { cleanup, render, screen } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MixerRail } from './MixerRail'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('MixerRail', () => {
  it('puts the timeline after the capsule, and drops it on a side dock', () => {
    const [vertical, setVertical] = createSignal(false)
    render(() => (
      <MixerRail
        vertical={vertical()}
        capsule={
          <>
            <div data-testid="left" />
            <div data-testid="right" />
          </>
        }
        timeline={<div data-testid="timeline" />}
      />
    ))
    const rail = screen.getByTestId('mixer-rail')
    expect(
      Array.from(rail.querySelectorAll('[data-testid]')).map((el) =>
        el.getAttribute('data-testid'),
      ),
    ).toEqual(['left', 'right', 'timeline'])

    setVertical(true)
    expect(screen.queryByTestId('timeline')).toBeNull()
    expect(rail).toHaveAttribute('data-vertical', 'true')

    setVertical(false)
    expect(rail).toContainElement(screen.getByTestId('timeline'))
  })

  it('draws no bar of its own inside the focus pill', () => {
    const [bare, setBare] = createSignal(false)
    render(() => (
      <MixerRail bare={bare()} capsule={<div />} timeline={<div />} />
    ))
    const rail = screen.getByTestId('mixer-rail')
    expect(rail).toHaveAttribute('data-bare', 'false')

    setBare(true)

    expect(rail).toHaveAttribute('data-bare', 'true')
  })

  it('reports its width each time it changes, and stops when it goes', () => {
    type Resize = (entries: { contentRect: { width: number } }[]) => void
    const callbacks: Resize[] = []
    const disconnect = vi.fn()
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: Resize) {
          callbacks.push(callback)
        }
        observe() {}
        disconnect = disconnect
      },
    )
    const onWidth = vi.fn()
    const { unmount } = render(() => (
      <MixerRail onWidth={onWidth} capsule={<div />} timeline={<div />} />
    ))

    for (const width of [1180, 720])
      callbacks.forEach((callback) => callback([{ contentRect: { width } }]))

    expect(onWidth.mock.calls).toEqual([[1180], [720]])
    unmount()
    expect(disconnect).toHaveBeenCalledTimes(1)
  })
})
