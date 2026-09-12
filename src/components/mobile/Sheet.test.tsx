// ============================================================
// The sheet's top band — what a finger can actually grab
// ============================================================
//
// Device round 2, R7: the grabber was a 4px bar in a 28px band, and on iOS it
// was reported as hard to grab. What is asserted here is the half jsdom can
// answer — that the band and the grabber's target are the elements the
// stylesheet sizes, that a press on the grabber closes the sheet, and that a
// drag still decides by distance and velocity rather than by where it began.
//
// The pixel sizes themselves are a stylesheet's job and are measured in the
// bundle by `apps/mercurypitch/scripts/probe-bundle.mjs`; jsdom applies no
// CSS module, so a test asserting 44px here would pass against any number.

import { cleanup, render, screen } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Sheet } from './Sheet'

afterEach(cleanup)

/**
 * jsdom has no `PointerEvent`, so one is built from a MouseEvent with the
 * pointer fields defined on it — the same shape `src/tests/drag-gesture`
 * uses, and the same one the handlers below actually read.
 *
 * THE TIMESTAMP IS OURS, and it has to be. jsdom stamps every constructed
 * event with `performance.now()`, and two constructions in this Node land
 * ~0.0003 ms apart — so a 30px move read as a flick of 10^5 px/ms and the
 * sheet closed, except on the runs where both landed in the same tick and the
 * velocity stayed 0. That is a test that decides by coin toss: it failed
 * about one run in three (device round 2 review, F2). The gesture's own
 * clock is now part of the case being made.
 */
function pointer(
  node: Element,
  type: string,
  clientY: number,
  timeStamp: number,
): void {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientY,
  })
  Object.defineProperties(event, {
    pointerId: { value: 1 },
    pointerType: { value: 'touch' },
    timeStamp: { value: timeStamp },
  })
  node.dispatchEvent(event)
}

/** One frame at 60Hz — the gap a real pointer stream arrives at. */
const FRAME_MS = 16

/**
 * A press from `from` to `to`, taking `ms` over the move.
 *
 * The default is one frame, which is a FLICK at any distance the tests here
 * use: 30px in 16ms is 1.9px/ms, well over `DISMISS_VELOCITY`. A drag that is
 * not a flick has to say how long it took.
 */
function press(
  node: Element,
  from: number,
  to: number,
  options: { cancel?: boolean; ms?: number } = {},
): void {
  const move = options.ms ?? FRAME_MS
  pointer(node, 'pointerdown', from, 0)
  pointer(node, 'pointermove', to, move)
  pointer(
    node,
    options.cancel === true ? 'pointercancel' : 'pointerup',
    to,
    move + FRAME_MS,
  )
}

function mount(close = vi.fn()) {
  render(() => (
    <Sheet isOpen close={close} ariaLabel="Test sheet">
      <p>body</p>
    </Sheet>
  ))
  return close
}

describe('the sheet handle', () => {
  it('puts the grabber inside a drag band of its own', () => {
    mount()
    const zone = screen.getByTestId('sheet-handle-zone')
    const grabber = screen.getByTestId('sheet-handle')
    expect(zone.contains(grabber)).toBe(true)
    // The bar is decoration; the target around it is what the finger meets.
    expect(grabber.getAttribute('aria-hidden')).toBe('true')
  })

  it('closes on a tap on the grabber', () => {
    const close = mount()
    press(screen.getByTestId('sheet-handle'), 100, 100)
    expect(close).toHaveBeenCalledTimes(1)
  })

  it('does not close on a tap on the band beside the grabber', () => {
    // The band is full width and 44pt tall — wide enough for a thumb resting
    // on the sheet. Only the part that looks like a control acts like one.
    const close = mount()
    press(screen.getByTestId('sheet-handle-zone'), 100, 100)
    expect(close).not.toHaveBeenCalled()
  })

  it('treats a press that travelled as a drag, not a tap', () => {
    // 30px over 400ms is 0.075px/ms — a long way under the flick threshold,
    // and 30px is a long way under the dismiss distance. Neither rule fires,
    // so the only question left is whether the tap rule does, and it must not.
    const close = mount()
    press(screen.getByTestId('sheet-handle'), 100, 130, { ms: 400 })
    expect(close).not.toHaveBeenCalled()
  })

  it('still dismisses the same 30px as a flick', () => {
    // The other half of the same gesture, on purpose: the distance is
    // identical and only the clock differs. 30px in one frame is 1.9px/ms,
    // over DISMISS_VELOCITY, and the flick rule is the one this branch has
    // always had — the tap rule must not have taken it away.
    const close = mount()
    press(screen.getByTestId('sheet-handle'), 100, 130, { ms: FRAME_MS })
    expect(close).toHaveBeenCalledTimes(1)
  })

  it('still dismisses on a long drag, from the grabber or the band', () => {
    // Slowly, so this is the DISTANCE rule and not the flick one: 200px at
    // 0.5px/ms is under DISMISS_VELOCITY and well over DISMISS_DISTANCE.
    for (const testId of ['sheet-handle', 'sheet-handle-zone']) {
      const close = mount()
      press(screen.getByTestId(testId), 100, 300, { ms: 400 })
      expect(close, testId).toHaveBeenCalledTimes(1)
      cleanup()
    }
  })

  it('keeps a cancelled gesture from closing anything', () => {
    const close = mount()
    press(screen.getByTestId('sheet-handle'), 100, 100, { cancel: true })
    expect(close).not.toHaveBeenCalled()
  })
})
