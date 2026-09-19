// ── JamSplitHandle tests ─────────────────────────────────────────────
// The seam between the words and the lanes. Two things have to hold: a
// pointer lands the seam where the pointer is, and a keyboard can move
// it at all.
//
// The second is not a nicety. The stage shipped with a fixed ratio, so
// there was nothing to operate; making it draggable is exactly the kind
// of change that arrives as a div with a pointerdown handler, mouse only
// and silent to a screen reader. A separator that answers to arrows,
// Home and End -- and says where it is in percent -- is the contract,
// and it is asserted here rather than in a review comment.

import { cleanup, fireEvent, render } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { JamSplitHandle } from '@/components/jam/JamSplitHandle'
import { JAM_SPLIT_WIDE_MAX, JAM_SPLIT_WIDE_MIN, setJamSplitShare, } from '@/lib/jam/jam-view-prefs'

/** A stage of a known size, since jsdom measures everything as zero. */
function stageOf(width: number, height: number): HTMLElement {
  const element = document.createElement('div')
  element.getBoundingClientRect = (() =>
    ({
      left: 0,
      top: 0,
      width,
      height,
      right: width,
      bottom: height,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }) as DOMRect) as HTMLElement['getBoundingClientRect']
  return element
}

interface HarnessOptions {
  stacked?: boolean
  share?: number
  width?: number
  height?: number
  /** Pass the share through the real clamp, as the stage does. */
  clamp?: boolean
}

function renderHandle(options: HarnessOptions = {}) {
  const stacked = options.stacked ?? false
  const [share, setShare] = createSignal(options.share ?? 50)
  const onShare = vi.fn((next: number) => {
    setShare(options.clamp === true ? setJamSplitShare(stacked, next) : next)
  })
  const onReset = vi.fn(() => setShare(50))
  const container = stageOf(options.width ?? 1000, options.height ?? 800)

  const utils = render(() => (
    <JamSplitHandle
      stacked={() => stacked}
      share={share}
      min={() => JAM_SPLIT_WIDE_MIN}
      max={() => JAM_SPLIT_WIDE_MAX}
      container={() => container}
      onShare={onShare}
      onReset={onReset}
    />
  ))
  const handle = utils.getByTestId('jam-split-handle')
  // Capture is a no-op in jsdom; dragGesture bails out if it throws.
  const captured = new Set<number>()
  handle.setPointerCapture = vi.fn((id: number) => void captured.add(id))
  handle.hasPointerCapture = vi.fn((id: number) => captured.has(id))
  handle.releasePointerCapture = vi.fn((id: number) => void captured.delete(id))

  return { ...utils, handle, share, onShare, onReset }
}

/** dragGesture reads pointerId/pointerType, which jsdom's MouseEvent lacks. */
function pointer(
  element: HTMLElement,
  type: string,
  clientX: number,
  clientY: number,
  pointerType = 'mouse',
): void {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    button: 0,
    buttons: type === 'pointerup' ? 0 : 1,
    clientX,
    clientY,
  })
  Object.defineProperties(event, {
    pointerId: { value: 1 },
    pointerType: { value: pointerType },
  })
  element.dispatchEvent(event)
}

describe('the split handle as a control', () => {
  afterEach(cleanup)

  it('is a separator a screen reader can read a percentage off', () => {
    const { handle } = renderHandle({ share: 42 })
    expect(handle).toHaveAttribute('role', 'separator')
    expect(handle).toHaveAttribute('aria-orientation', 'vertical')
    expect(handle).toHaveAttribute('aria-valuemin', String(JAM_SPLIT_WIDE_MIN))
    expect(handle).toHaveAttribute('aria-valuemax', String(JAM_SPLIT_WIDE_MAX))
    expect(handle).toHaveAttribute('aria-valuenow', '42')
    expect(handle.getAttribute('aria-valuetext')).toContain('42 percent')
    expect(handle.tabIndex).toBe(0)
  })

  it('turns with the layout, because stacked it trades height', () => {
    const { handle } = renderHandle({ stacked: true })
    expect(handle).toHaveAttribute('aria-orientation', 'horizontal')
  })

  it('reports the share it moves to, not just that it moved', () => {
    const { handle, share } = renderHandle({ share: 20 })
    fireEvent.keyDown(handle, { key: 'ArrowRight' })
    expect(share()).toBe(22)
    fireEvent.keyDown(handle, { key: 'ArrowLeft' })
    expect(share()).toBe(20)
    expect(handle).toHaveAttribute('aria-valuenow', '20')
  })

  it('answers to both axes of arrow key, whichever way it is turned', () => {
    // Up/Left both mean "give the lyrics less"; on a stacked stage the
    // meaningful pair is up/down, side by side it is left/right, and a
    // keyboard user should not have to work out which.
    const { handle, share } = renderHandle({ share: 50 })
    fireEvent.keyDown(handle, { key: 'ArrowDown' })
    expect(share()).toBe(52)
    fireEvent.keyDown(handle, { key: 'ArrowUp' })
    expect(share()).toBe(50)
  })

  it('goes to either end with Home and End', () => {
    const { handle, share } = renderHandle({ share: 50 })
    fireEvent.keyDown(handle, { key: 'Home' })
    expect(share()).toBe(JAM_SPLIT_WIDE_MIN)
    fireEvent.keyDown(handle, { key: 'End' })
    expect(share()).toBe(JAM_SPLIT_WIDE_MAX)
  })

  it('has a way back: double-click, Enter or Space', () => {
    const { handle, onReset } = renderHandle({ share: 70 })
    fireEvent.dblClick(handle)
    fireEvent.keyDown(handle, { key: 'Enter' })
    fireEvent.keyDown(handle, { key: ' ' })
    expect(onReset).toHaveBeenCalledTimes(3)
  })

  it('ignores a key it has no business claiming', () => {
    // Tab has to keep moving focus out of the separator.
    const { handle, onShare, onReset } = renderHandle()
    fireEvent.keyDown(handle, { key: 'Tab' })
    fireEvent.keyDown(handle, { key: 'a' })
    expect(onShare).not.toHaveBeenCalled()
    expect(onReset).not.toHaveBeenCalled()
  })

  it('clamps through the stage, so a key cannot walk past the end', () => {
    const { handle, share } = renderHandle({
      share: JAM_SPLIT_WIDE_MAX,
      clamp: true,
    })
    fireEvent.keyDown(handle, { key: 'ArrowRight' })
    expect(share()).toBe(JAM_SPLIT_WIDE_MAX)
  })
})

describe('the split handle under a pointer', () => {
  afterEach(cleanup)

  it('puts the seam where the pointer is, across the stage width', () => {
    const { handle, share } = renderHandle({ width: 1000 })
    pointer(handle, 'pointerdown', 300, 400)
    expect(share()).toBeCloseTo(30, 6)
    pointer(handle, 'pointermove', 620, 400)
    expect(share()).toBeCloseTo(62, 6)
    pointer(handle, 'pointerup', 620, 400)
  })

  it('measures down the stage when it is stacked', () => {
    // The bug this pins: reading clientX in both layouts, which on a
    // phone makes the handle jump to wherever your thumb is horizontally
    // and ignore the drag entirely.
    const { handle, share } = renderHandle({
      stacked: true,
      height: 800,
      width: 400,
    })
    pointer(handle, 'pointerdown', 200, 560)
    expect(share()).toBeCloseTo(70, 6)
  })

  it('takes a finger, which carries no button at all', () => {
    const { handle, share } = renderHandle({ width: 500 })
    const event = new MouseEvent('pointerdown', {
      bubbles: true,
      cancelable: true,
      button: 0,
      buttons: 0,
      clientX: 200,
      clientY: 100,
    })
    Object.defineProperties(event, {
      pointerId: { value: 9 },
      pointerType: { value: 'touch' },
    })
    handle.dispatchEvent(event)
    expect(share()).toBeCloseTo(40, 6)
  })

  it('refuses a right-click, which is a context menu', () => {
    const { handle, onShare } = renderHandle()
    const event = new MouseEvent('pointerdown', {
      bubbles: true,
      cancelable: true,
      button: 2,
      buttons: 2,
      clientX: 300,
      clientY: 100,
    })
    Object.defineProperties(event, {
      pointerId: { value: 3 },
      pointerType: { value: 'mouse' },
    })
    handle.dispatchEvent(event)
    expect(onShare).not.toHaveBeenCalled()
  })

  it('marks itself while dragging, and stops when the pointer goes up', () => {
    // The grip only lights up on [data-dragging]; without the flag the
    // seam gives no feedback that it has hold of the pointer.
    const { handle } = renderHandle()
    pointer(handle, 'pointerdown', 400, 100)
    expect(handle.dataset.dragging).toBe('true')
    pointer(handle, 'pointerup', 400, 100)
    expect(handle.dataset.dragging).toBeUndefined()
  })
})
