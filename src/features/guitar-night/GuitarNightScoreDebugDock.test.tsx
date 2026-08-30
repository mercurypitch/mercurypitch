// The dock's own chrome: the panel covers the tab it reports on, so it has to
// be able to get out of the way without being closed.
// ============================================================

import { fireEvent, render, screen } from '@solidjs/testing-library'
import { beforeEach, describe, expect, it } from 'vitest'
import { GuitarNightScoreDebugDock } from './GuitarNightScoreDebug'

const DOCK_STORAGE_KEY = 'guitar-night-score-debug-dock'

// The dock portals to the document body, so it is never inside the render
// container the testing library hands back.
const mount = () =>
  render(() => (
    <GuitarNightScoreDebugDock
      model={() => null}
      playheadSeconds={() => null}
    />
  ))
const dockEl = (): HTMLElement => screen.getByTestId('guitar-score-debug-dock')
const sliderEl = (): HTMLInputElement =>
  screen.getByTestId('guitar-score-debug-alpha') as HTMLInputElement

describe('GuitarNightScoreDebugDock', () => {
  beforeEach(() => globalThis.localStorage.clear())

  it('fades the panel from the bar and remembers the setting', () => {
    const { unmount } = mount()
    const dock = dockEl()
    expect(dock.style.getPropertyValue('--debug-dock-alpha')).toBe('1')

    const slider = sliderEl()
    fireEvent.input(slider, { target: { value: '0.4' } })
    expect(dock.style.getPropertyValue('--debug-dock-alpha')).toBe('0.4')

    const stored = JSON.parse(
      globalThis.localStorage.getItem(DOCK_STORAGE_KEY) ?? '{}',
    ) as { alpha?: number }
    expect(stored.alpha).toBeCloseTo(0.4)
    unmount()

    // A reload reads it back rather than starting opaque again.
    const second = mount()
    expect(dockEl().style.getPropertyValue('--debug-dock-alpha')).toBe('0.4')
    second.unmount()
  })

  it('never fades so far that the panel cannot be found again', () => {
    mount()
    const dock = dockEl()
    const slider = sliderEl()

    fireEvent.input(slider, { target: { value: '0' } })
    expect(
      Number(dock.style.getPropertyValue('--debug-dock-alpha')),
    ).toBeGreaterThan(0)
  })
})
