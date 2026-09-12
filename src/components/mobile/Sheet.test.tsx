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
 */
function pointer(node: Element, type: string, clientY: number): void {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientY,
  })
  Object.defineProperties(event, {
    pointerId: { value: 1 },
    pointerType: { value: 'touch' },
  })
  node.dispatchEvent(event)
}

function press(
  node: Element,
  from: number,
  to: number,
  options: { cancel?: boolean } = {},
): void {
  pointer(node, 'pointerdown', from)
  pointer(node, 'pointermove', to)
  pointer(node, options.cancel === true ? 'pointercancel' : 'pointerup', to)
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
    const close = mount()
    press(screen.getByTestId('sheet-handle'), 100, 130)
    expect(close).not.toHaveBeenCalled()
  })

  it('still dismisses on a long drag, from the grabber or the band', () => {
    for (const testId of ['sheet-handle', 'sheet-handle-zone']) {
      const close = mount()
      press(screen.getByTestId(testId), 100, 300)
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
