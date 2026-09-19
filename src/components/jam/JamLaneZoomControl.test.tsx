// ── JamLaneZoomControl tests ─────────────────────────────────────────
// The visible half of the zoom. Wheel and pinch are the fast path, but
// they are also the path nobody discovers and no screen reader can take,
// so these three buttons are the contract: a name each, a readout that
// says where you are, and a way back to 1x that is not eight notches of
// guesswork.

import { cleanup, fireEvent, render } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { JamZoomSubject } from '@/components/jam/JamLaneZoomControl'
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

// ── A second scalar on the same control ──────────────────────────────
// The lyric column's size uses these three buttons too. Everything about
// the control defaults to the lanes (every test above renders it with no
// subject at all, and is the proof that nothing moved); a host that is
// not the lanes describes its own scalar, and then none of the lanes'
// words, range or test id may leak through.

/** A scale that rests in the middle of its range, unlike the lanes'. */
const SUBJECT: JamZoomSubject = {
  min: 0.5,
  max: 3,
  isDefault: (value) => value === 1,
  format: (value) => `${Math.round(value * 100)}%`,
  outLabel: 'Smaller things',
  outTitle: 'Smaller',
  inLabel: 'Larger things',
  inTitle: 'Larger',
  readoutLabel: (shown) => `Thing size ${shown}`,
  resetTitle: 'Reset thing size',
  testId: 'thing-size',
}

function renderSubject(initial: number) {
  const [value, setValue] = createSignal(initial)
  const utils = render(() => (
    <JamLaneZoomControl
      subject={SUBJECT}
      zoom={value}
      onZoomIn={() => setValue((v) => v + 0.5)}
      onZoomOut={() => setValue((v) => v - 0.5)}
      onReset={() => setValue(1)}
    />
  ))
  return {
    ...utils,
    value,
    out: utils.getByLabelText('Smaller things'),
    in: utils.getByLabelText('Larger things'),
    readout: utils.getByTitle('Reset thing size'),
  }
}

describe('the control, given something other than the lanes to scale', () => {
  afterEach(cleanup)

  it("says the host's words and none of the lanes'", () => {
    const control = renderSubject(1.5)
    expect(control.out).toHaveAttribute('title', 'Smaller')
    expect(control.in).toHaveAttribute('title', 'Larger')
    expect(control.readout).toHaveAttribute('aria-label', 'Thing size 150%')
    expect(control.readout).toHaveTextContent('150%')
    expect(control.queryByTitle('Reset the zoom')).toBeNull()
    expect(control.queryByLabelText(/pitch lanes/)).toBeNull()
  })

  it('answers to its own test id, so two in one room can be told apart', () => {
    const control = renderSubject(1)
    expect(control.getByTestId('thing-size')).toHaveAttribute(
      'data-zoom',
      '1.000',
    )
    expect(control.queryByTestId('jam-lane-zoom')).toBeNull()
  })

  it("stops at the host's ends, not at 1x and 4x", () => {
    // 0.5 is below the lane floor and 3 is inside the lane range: with
    // the lanes' bounds, minus would be dead here and plus alive at 3.
    const low = renderSubject(0.5)
    expect(low.out).toBeDisabled()
    expect(low.in).not.toBeDisabled()
    cleanup()

    const mid = renderSubject(0.75)
    expect(mid.out).not.toBeDisabled()
    cleanup()

    const high = renderSubject(3)
    expect(high.in).toBeDisabled()
    expect(high.out).not.toBeDisabled()
  })

  it('offers a reset from BELOW the resting value as well as above it', () => {
    // The lanes rest on their floor, so "below the default" cannot
    // happen there -- and a check written for them would call 0.5 default.
    const below = renderSubject(0.5)
    expect(below.readout).not.toBeDisabled()
    fireEvent.click(below.readout)
    expect(below.value()).toBe(1)
    expect(below.readout).toBeDisabled()
  })
})
