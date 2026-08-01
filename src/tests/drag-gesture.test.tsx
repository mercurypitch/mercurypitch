import { cleanup, render } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DragGestureOptions } from '@/components/shared/drag-gesture'
import { dragGesture } from '@/components/shared/drag-gesture'

const dispatchPointer = (
  element: HTMLElement,
  type: string,
  pointerId: number,
  clientX = 0,
  // Model real devices: the primary button is reported as held for every
  // event of a press except the terminating up/cancel. Hover tests override.
  buttons = type === 'pointerup' || type === 'pointercancel' ? 0 : 1,
): PointerEvent => {
  const event = new MouseEvent(type, {
    bubbles: true,
    button: 0,
    buttons,
    cancelable: true,
    clientX,
  })
  Object.defineProperties(event, {
    pointerId: { value: pointerId },
    pointerType: { value: 'mouse' },
  })
  element.dispatchEvent(event)
  return event as PointerEvent
}

const installPointerCapture = (element: HTMLElement) => {
  const captured = new Set<number>()
  const setPointerCapture = vi.fn((pointerId: number) => {
    captured.add(pointerId)
  })
  const hasPointerCapture = vi.fn((pointerId: number) =>
    captured.has(pointerId),
  )
  const releasePointerCapture = vi.fn((pointerId: number) => {
    captured.delete(pointerId)
  })
  element.setPointerCapture = setPointerCapture
  element.hasPointerCapture = hasPointerCapture
  element.releasePointerCapture = releasePointerCapture
  return { captured, releasePointerCapture, setPointerCapture }
}

describe('dragGesture', () => {
  afterEach(cleanup)

  it('updates a slider during drag with touch and ARIA defaults (REQ-DRAG-001, REQ-DRAG-003, REQ-DRAG-004)', () => {
    const [value, setValue] = createSignal(2)
    const options: DragGestureOptions = {
      slider: {
        getAriaLabel: () => 'Test level',
        getValue: value,
        getMin: () => 0,
        getMax: () => 10,
        getStep: () => 1,
        getValueFromPointer: (event) => event.clientX / 10,
        onChange: setValue,
      },
    }

    const { getByRole } = render(() => (
      <div ref={(element) => dragGesture(element, () => options)}>
        {value()}
      </div>
    ))
    const slider = getByRole('slider', { name: 'Test level' })
    const capture = installPointerCapture(slider)

    expect(slider.style.touchAction).toBe('none')
    expect(slider).toHaveAttribute('aria-valuemin', '0')
    expect(slider).toHaveAttribute('aria-valuemax', '10')
    expect(slider).toHaveAttribute('aria-valuenow', '2')

    dispatchPointer(slider, 'pointerdown', 7, 20)
    dispatchPointer(slider, 'pointermove', 7, 80)

    expect(capture.setPointerCapture).toHaveBeenCalledWith(7)
    expect(slider).toHaveAttribute('aria-valuenow', '8')
  })

  it('releases capture on cancel and accepts the next drag (REQ-DRAG-002)', () => {
    const onStart = vi.fn()
    const onMove = vi.fn()
    const options: DragGestureOptions = { onStart, onMove }
    const { getByTestId } = render(() => (
      <div
        data-testid="surface"
        ref={(element) => dragGesture(element, () => options)}
      />
    ))
    const surface = getByTestId('surface')
    const capture = installPointerCapture(surface)

    dispatchPointer(surface, 'pointerdown', 3)
    dispatchPointer(surface, 'pointercancel', 3)
    expect(capture.releasePointerCapture).toHaveBeenCalledWith(3)
    expect(capture.captured.size).toBe(0)

    dispatchPointer(surface, 'pointerdown', 4)
    dispatchPointer(surface, 'pointermove', 4, 60)
    dispatchPointer(surface, 'pointerup', 4)

    expect(onStart).toHaveBeenCalledTimes(2)
    expect(onMove).toHaveBeenCalledTimes(1)
    expect(capture.releasePointerCapture).toHaveBeenCalledWith(4)
    expect(capture.captured.size).toBe(0)
  })

  it('releases capture after a completed drag (REQ-DRAG-002)', () => {
    const options: DragGestureOptions = {}
    const { getByTestId } = render(() => (
      <div
        data-testid="surface"
        ref={(element) => dragGesture(element, () => options)}
      />
    ))
    const surface = getByTestId('surface')
    const capture = installPointerCapture(surface)

    dispatchPointer(surface, 'pointerdown', 9)
    dispatchPointer(surface, 'pointerup', 9)

    expect(capture.releasePointerCapture).toHaveBeenCalledOnce()
    expect(capture.releasePointerCapture).toHaveBeenCalledWith(9)
  })

  it('does not capture a threshold gesture until it becomes a drag (REQ-DRAG-001)', () => {
    const onStart = vi.fn()
    const options: DragGestureOptions = {
      activationDistance: 6,
      onStart,
    }
    const { getByTestId } = render(() => (
      <div
        data-testid="surface"
        ref={(element) => dragGesture(element, () => options)}
      />
    ))
    const surface = getByTestId('surface')
    const capture = installPointerCapture(surface)

    dispatchPointer(surface, 'pointerdown', 5, 10)
    dispatchPointer(surface, 'pointerup', 5, 10)
    expect(capture.setPointerCapture).not.toHaveBeenCalled()
    expect(onStart).not.toHaveBeenCalled()

    dispatchPointer(surface, 'pointerdown', 6, 10)
    dispatchPointer(surface, 'pointermove', 6, 20)
    expect(capture.setPointerCapture).toHaveBeenCalledWith(6)
    expect(onStart).toHaveBeenCalledOnce()
  })

  it('drops a stale pending press instead of activating from a hover (REQ-DRAG-001)', () => {
    // A sub-threshold press holds no capture, so releasing it outside the
    // element never delivers pointerup here. The stale pending state must
    // not turn a later buttons-free hover into a drag.
    const onStart = vi.fn()
    const options: DragGestureOptions = {
      activationDistance: 6,
      onStart,
    }
    const { getByTestId } = render(() => (
      <div
        data-testid="surface"
        ref={(element) => dragGesture(element, () => options)}
      />
    ))
    const surface = getByTestId('surface')
    const capture = installPointerCapture(surface)

    dispatchPointer(surface, 'pointerdown', 5, 10)
    // ...press exits the element and is released outside; no pointerup fires.
    dispatchPointer(surface, 'pointermove', 5, 60, 0) // hover back, no buttons
    expect(capture.setPointerCapture).not.toHaveBeenCalled()
    expect(onStart).not.toHaveBeenCalled()

    // The gesture is not wedged: the next real press drags normally.
    dispatchPointer(surface, 'pointerdown', 5, 10)
    dispatchPointer(surface, 'pointermove', 5, 20)
    expect(capture.setPointerCapture).toHaveBeenCalledWith(5)
    expect(onStart).toHaveBeenCalledOnce()
  })

  it('lets a fresh press supersede a stale pending press (REQ-DRAG-001)', () => {
    const onStart = vi.fn()
    const options: DragGestureOptions = {
      activationDistance: 6,
      onStart,
    }
    const { getByTestId } = render(() => (
      <div
        data-testid="surface"
        ref={(element) => dragGesture(element, () => options)}
      />
    ))
    const surface = getByTestId('surface')
    installPointerCapture(surface)

    dispatchPointer(surface, 'pointerdown', 5, 10)
    // ...released outside without any move reaching the element, then the
    // user presses again. The new press must restart tracking at its own
    // origin, not measure distance from the stale one.
    dispatchPointer(surface, 'pointerdown', 5, 30)
    dispatchPointer(surface, 'pointermove', 5, 33) // 3px from the new press
    expect(onStart).not.toHaveBeenCalled()

    dispatchPointer(surface, 'pointermove', 5, 37) // 7px from the new press
    expect(onStart).toHaveBeenCalledOnce()
    expect((onStart.mock.calls[0]?.[0] as PointerEvent).clientX).toBe(30)
  })

  it('focuses a slider when a drag activates despite preventDefault (REQ-DRAG-004)', () => {
    const [value, setValue] = createSignal(2)
    const options: DragGestureOptions = {
      slider: {
        getAriaLabel: () => 'Focus level',
        getValue: value,
        getMin: () => 0,
        getMax: () => 10,
        getStep: () => 1,
        getValueFromPointer: (event) => event.clientX / 10,
        onChange: setValue,
      },
    }
    const { getByRole } = render(() => (
      <div ref={(element) => dragGesture(element, () => options)}>
        {value()}
      </div>
    ))
    const slider = getByRole('slider', { name: 'Focus level' })
    installPointerCapture(slider)

    dispatchPointer(slider, 'pointerdown', 7, 20)
    // pointerdown.preventDefault() suppresses native focus, so the binding
    // must focus the slider itself to keep the click-then-arrow-keys contract.
    expect(document.activeElement).toBe(slider)
  })

  it('adjusts and clamps slider values from the keyboard (REQ-DRAG-004)', () => {
    const [value, setValue] = createSignal(5)
    const options: DragGestureOptions = {
      slider: {
        getAriaLabel: () => 'Keyboard level',
        getValue: value,
        getMin: () => 0,
        getMax: () => 10,
        getStep: () => 2,
        onChange: setValue,
      },
    }
    const { getByRole } = render(() => (
      <div ref={(element) => dragGesture(element, () => options)}>
        {value()}
      </div>
    ))
    const slider = getByRole('slider', { name: 'Keyboard level' })

    slider.dispatchEvent(
      new KeyboardEvent('keydown', { bubbles: true, key: 'ArrowRight' }),
    )
    expect(slider).toHaveAttribute('aria-valuenow', '7')

    slider.dispatchEvent(
      new KeyboardEvent('keydown', { bubbles: true, key: 'End' }),
    )
    expect(slider).toHaveAttribute('aria-valuenow', '10')

    slider.dispatchEvent(
      new KeyboardEvent('keydown', { bubbles: true, key: 'ArrowRight' }),
    )
    expect(slider).toHaveAttribute('aria-valuenow', '10')

    slider.dispatchEvent(
      new KeyboardEvent('keydown', { bubbles: true, key: 'Home' }),
    )
    expect(slider).toHaveAttribute('aria-valuenow', '0')
  })
})
