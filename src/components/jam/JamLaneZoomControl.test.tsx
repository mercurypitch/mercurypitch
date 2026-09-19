// ── JamLaneZoomControl tests ─────────────────────────────────────────
// The visible half of the zoom. Wheel and pinch are the fast path, but
// they are also the path nobody discovers and no screen reader can take,
// so these three buttons are the contract: a name each, a readout that
// says where you are, and a way back to 1x that is not eight notches of
// guesswork.

import { cleanup, fireEvent, render } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { JamLaneZoomControl } from '@/components/jam/JamLaneZoomControl'
import { JAM_ZOOM_MAX, JAM_ZOOM_MIN, JAM_ZOOM_STEP, steppedJamZoom, } from '@/lib/jam/jam-lane-zoom'

function renderControl(initial = JAM_ZOOM_MIN) {
  const [zoom, setZoom] = createSignal(initial)
  const onReset = vi.fn(() => setZoom(JAM_ZOOM_MIN))
  const utils = render(() => (
    <JamLaneZoomControl
      zoom={zoom}
      onZoomIn={() => setZoom((z) => steppedJamZoom(z, 1))}
      onZoomOut={() => setZoom((z) => steppedJamZoom(z, -1))}
      onReset={onReset}
    />
  ))
  return {
    ...utils,
    zoom,
    onReset,
    out: utils.getByLabelText('Show more of the song in the pitch lanes'),
    in: utils.getByLabelText('Look closer at the pitch lanes'),
    readout: utils.getByTitle('Reset the zoom'),
    dock: utils.getByTestId('jam-lane-zoom'),
  }
}

describe('the lane zoom control', () => {
  afterEach(cleanup)

  it('names every button, because two of them are only an icon', () => {
    const control = renderControl(2)
    expect(control.out.tagName).toBe('BUTTON')
    expect(control.in.tagName).toBe('BUTTON')
    expect(control.readout).toHaveAttribute(
      'aria-label',
      'Pitch lane zoom 2×. Reset to 1×',
    )
  })

  it('steps in and out by the same multiplier', () => {
    const control = renderControl(2)
    fireEvent.click(control.in)
    expect(control.zoom()).toBeCloseTo(2 * JAM_ZOOM_STEP, 10)
    fireEvent.click(control.out)
    expect(control.zoom()).toBeCloseTo(2, 10)
  })

  it('shows where you are, rounded to something readable', () => {
    const control = renderControl(1)
    expect(control.readout).toHaveTextContent('1×')
    fireEvent.click(control.in)
    expect(control.readout).toHaveTextContent('1.3×')
  })

  it('publishes the zoom for anything measuring the stage', () => {
    // The e2e checks read this rather than parsing the readout's text.
    const control = renderControl(1)
    expect(control.dock).toHaveAttribute('data-zoom', '1.000')
    fireEvent.click(control.in)
    expect(control.dock).toHaveAttribute('data-zoom', '1.250')
  })

  it('gets back to 1x in one click, from anywhere', () => {
    const control = renderControl(JAM_ZOOM_MAX)
    fireEvent.click(control.readout)
    expect(control.onReset).toHaveBeenCalledTimes(1)
    expect(control.zoom()).toBe(JAM_ZOOM_MIN)
  })

  it('offers no reset when there is nothing to reset', () => {
    const control = renderControl(JAM_ZOOM_MIN)
    expect(control.readout).toBeDisabled()
    fireEvent.click(control.readout)
    expect(control.onReset).not.toHaveBeenCalled()
  })

  it('stops at each end rather than pretending to go further', () => {
    const atMin = renderControl(JAM_ZOOM_MIN)
    expect(atMin.out).toBeDisabled()
    expect(atMin.in).not.toBeDisabled()
    cleanup()

    const atMax = renderControl(JAM_ZOOM_MAX)
    expect(atMax.in).toBeDisabled()
    expect(atMax.out).not.toBeDisabled()
  })

  it('re-enables the far button as soon as the zoom leaves the end', () => {
    const control = renderControl(JAM_ZOOM_MIN)
    fireEvent.click(control.in)
    expect(control.out).not.toBeDisabled()
    expect(control.readout).not.toBeDisabled()
  })
})
