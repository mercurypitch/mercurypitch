import type { Accessor } from 'solid-js'
import { createEffect, onCleanup } from 'solid-js'
import './drag-gesture.css'

export type DragGestureEndReason =
  | 'pointerup'
  | 'pointercancel'
  | 'lostpointercapture'

export interface DragSliderOptions {
  getAriaLabel: () => string
  getValue: () => number
  getMin: () => number
  getMax: () => number
  getStep: () => number
  onChange: (value: number) => void
  getPageStep?: () => number
  getValueText?: () => string | undefined
  getValueFromPointer?: (event: PointerEvent) => number
  onPointerValue?: (value: number) => void
  isDisabled?: () => boolean
  orientation?: 'horizontal' | 'vertical'
}

export interface DragGestureOptions {
  canStart?: (event: PointerEvent) => boolean
  onStart?: (event: PointerEvent) => void
  onMove?: (event: PointerEvent) => void
  onEnd?: (event: PointerEvent, reason: DragGestureEndReason) => void
  /**
   * Delays capture until the pointer travels this many pixels. Useful when a
   * surface contains clickable children and only movement should become drag.
   */
  activationDistance?: number
  /**
   * Defaults to `none`, which is required for custom touch drags. Use `pan-x`
   * or `pan-y` only when the surface intentionally keeps native panning.
   */
  touchAction?: string | null
  preventDefault?: boolean
  stopPropagation?: boolean
  slider?: DragSliderOptions
}

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value))

/**
 * Shared pointer-drag lifecycle for Solid elements.
 *
 * The binding owns pointer capture, guarded release, pointer cancellation,
 * lost-capture recovery, and touch-action. Slider consumers can also opt into
 * the shared keyboard and ARIA contract without changing their visual skin.
 */
export function dragGesture(
  element: HTMLElement,
  optionsAccessor: Accessor<DragGestureOptions>,
): void {
  let activePointerId: number | null = null
  let pendingPointerId: number | null = null
  let pendingStartEvent: PointerEvent | null = null
  const initialTouchAction = element.style.touchAction

  const sliderIsDisabled = (slider: DragSliderOptions): boolean =>
    slider.isDisabled?.() ?? false

  const commitSliderValue = (
    slider: DragSliderOptions,
    value: number,
  ): void => {
    if (sliderIsDisabled(slider)) return
    slider.onChange(clamp(value, slider.getMin(), slider.getMax()))
  }

  createEffect(() => {
    const options = optionsAccessor()
    element.style.touchAction =
      options.touchAction === null
        ? initialTouchAction
        : (options.touchAction ?? 'none')

    const slider = options.slider
    if (slider === undefined) return

    const disabled = sliderIsDisabled(slider)
    element.dataset.dragSlider = ''
    element.setAttribute('role', 'slider')
    element.setAttribute('aria-label', slider.getAriaLabel())
    element.setAttribute('aria-valuemin', String(slider.getMin()))
    element.setAttribute('aria-valuemax', String(slider.getMax()))
    element.setAttribute('aria-valuenow', String(slider.getValue()))
    element.setAttribute('aria-orientation', slider.orientation ?? 'horizontal')
    element.setAttribute('aria-disabled', String(disabled))
    element.tabIndex = disabled ? -1 : 0

    const valueText = slider.getValueText?.()
    if (valueText === undefined) element.removeAttribute('aria-valuetext')
    else element.setAttribute('aria-valuetext', valueText)
  })

  const activatePointer = (
    startEvent: PointerEvent,
    activationEvent: PointerEvent,
  ): void => {
    const options = optionsAccessor()
    if (options.preventDefault !== false) activationEvent.preventDefault()
    if (options.stopPropagation === true) activationEvent.stopPropagation()

    try {
      element.setPointerCapture(activationEvent.pointerId)
    } catch {
      return
    }

    activePointerId = activationEvent.pointerId
    options.onStart?.(startEvent)
  }

  const onPointerDown = (event: PointerEvent): void => {
    if (activePointerId !== null || pendingPointerId !== null) return

    const options = optionsAccessor()
    if (options.slider !== undefined && sliderIsDisabled(options.slider)) return
    if (options.canStart?.(event) === false) return

    if ((options.activationDistance ?? 0) > 0) {
      pendingPointerId = event.pointerId
      pendingStartEvent = event
      return
    }

    activatePointer(event, event)
  }

  const onPointerMove = (event: PointerEvent): void => {
    if (pendingPointerId === event.pointerId && pendingStartEvent !== null) {
      const distance = Math.hypot(
        event.clientX - pendingStartEvent.clientX,
        event.clientY - pendingStartEvent.clientY,
      )
      if (distance < (optionsAccessor().activationDistance ?? 0)) return

      const startEvent = pendingStartEvent
      pendingPointerId = null
      pendingStartEvent = null
      activatePointer(startEvent, event)
    }

    if (activePointerId !== event.pointerId) return

    const options = optionsAccessor()
    options.onMove?.(event)

    const slider = options.slider
    if (slider?.getValueFromPointer === undefined) return
    const value = clamp(
      slider.getValueFromPointer(event),
      slider.getMin(),
      slider.getMax(),
    )
    const publishPointerValue = slider.onPointerValue ?? slider.onChange
    publishPointerValue(value)
  }

  const finishPointer = (
    event: PointerEvent,
    reason: DragGestureEndReason,
  ): void => {
    if (pendingPointerId === event.pointerId) {
      pendingPointerId = null
      pendingStartEvent = null
      return
    }
    if (activePointerId !== event.pointerId) return
    activePointerId = null

    if (
      reason !== 'lostpointercapture' &&
      element.hasPointerCapture?.(event.pointerId)
    ) {
      element.releasePointerCapture(event.pointerId)
    }

    optionsAccessor().onEnd?.(event, reason)
  }

  const onPointerUp = (event: PointerEvent): void =>
    finishPointer(event, 'pointerup')
  const onPointerCancel = (event: PointerEvent): void =>
    finishPointer(event, 'pointercancel')
  const onLostPointerCapture = (event: PointerEvent): void =>
    finishPointer(event, 'lostpointercapture')

  const onKeyDown = (event: KeyboardEvent): void => {
    const slider = optionsAccessor().slider
    if (slider === undefined || sliderIsDisabled(slider)) return

    const step = Math.max(Number.EPSILON, slider.getStep())
    const pageStep = slider.getPageStep?.() ?? step * 10
    const current = slider.getValue()
    let next: number | undefined

    switch (event.key) {
      case 'ArrowLeft':
      case 'ArrowDown':
        next = current - step
        break
      case 'ArrowRight':
      case 'ArrowUp':
        next = current + step
        break
      case 'PageDown':
        next = current - pageStep
        break
      case 'PageUp':
        next = current + pageStep
        break
      case 'Home':
        next = slider.getMin()
        break
      case 'End':
        next = slider.getMax()
        break
      default:
        return
    }

    event.preventDefault()
    commitSliderValue(slider, next)
  }

  element.addEventListener('pointerdown', onPointerDown)
  element.addEventListener('pointermove', onPointerMove)
  element.addEventListener('pointerup', onPointerUp)
  element.addEventListener('pointercancel', onPointerCancel)
  element.addEventListener('lostpointercapture', onLostPointerCapture)
  element.addEventListener('keydown', onKeyDown)

  onCleanup(() => {
    pendingPointerId = null
    pendingStartEvent = null
    const pointerId = activePointerId
    activePointerId = null
    if (pointerId !== null && element.hasPointerCapture?.(pointerId)) {
      element.releasePointerCapture(pointerId)
    }

    element.removeEventListener('pointerdown', onPointerDown)
    element.removeEventListener('pointermove', onPointerMove)
    element.removeEventListener('pointerup', onPointerUp)
    element.removeEventListener('pointercancel', onPointerCancel)
    element.removeEventListener('lostpointercapture', onLostPointerCapture)
    element.removeEventListener('keydown', onKeyDown)
  })
}
