// Journey pointer gestures — distinguish selection taps from drags and cancelled touch.

export interface JourneyPointerSample {
  pointerId: number
  clientX: number
  clientY: number
}

export type JourneyPointerMove =
  | { kind: 'drag'; dx: number; dy: number }
  | { kind: 'pinch'; scale: number }

export interface JourneyPointerTracker {
  down(sample: JourneyPointerSample): void
  move(sample: JourneyPointerSample): JourneyPointerMove | undefined
  up(
    sample: JourneyPointerSample,
  ): { kind: 'tap'; clientX: number; clientY: number } | undefined
  cancel(pointerId: number): void
  reset(): void
}

/** Multiple pointers suppress the whole gesture so a pinch can never select. */
export function createJourneyPointerTracker(
  movementThresholdPixels = 7,
): JourneyPointerTracker {
  const pointers = new Map<number, JourneyPointerSample>()
  let primary:
    | {
        id: number
        startX: number
        startY: number
        previousX: number
        previousY: number
        dragging: boolean
      }
    | undefined
  let suppressed = false
  let previousPinchDistance: number | undefined

  function pinchDistance(): number | undefined {
    if (pointers.size < 2) return undefined
    const [first, second] = [...pointers.values()]
    if (first === undefined || second === undefined) return undefined
    return Math.hypot(
      second.clientX - first.clientX,
      second.clientY - first.clientY,
    )
  }

  function clearIfIdle(): void {
    if (pointers.size === 0) {
      primary = undefined
      suppressed = false
      previousPinchDistance = undefined
    }
  }

  return {
    down(sample) {
      pointers.set(sample.pointerId, sample)
      if (primary !== undefined || pointers.size > 1) {
        suppressed = true
        previousPinchDistance = pinchDistance()
        return
      }
      primary = {
        id: sample.pointerId,
        startX: sample.clientX,
        startY: sample.clientY,
        previousX: sample.clientX,
        previousY: sample.clientY,
        dragging: false,
      }
    },
    move(sample) {
      if (!pointers.has(sample.pointerId)) return undefined
      pointers.set(sample.pointerId, sample)
      if (pointers.size >= 2) {
        suppressed = true
        const currentDistance = pinchDistance()
        const priorDistance = previousPinchDistance
        previousPinchDistance = currentDistance
        if (
          currentDistance === undefined ||
          priorDistance === undefined ||
          currentDistance <= 0 ||
          priorDistance <= 0
        )
          return undefined
        const scale = currentDistance / priorDistance
        return Number.isFinite(scale) && scale !== 1
          ? { kind: 'pinch', scale }
          : undefined
      }
      if (suppressed || primary?.id !== sample.pointerId) return undefined
      const dx = sample.clientX - primary.previousX
      const dy = sample.clientY - primary.previousY
      primary.previousX = sample.clientX
      primary.previousY = sample.clientY
      if (!primary.dragging) {
        const travelled = Math.hypot(
          sample.clientX - primary.startX,
          sample.clientY - primary.startY,
        )
        if (travelled < movementThresholdPixels) return undefined
        primary.dragging = true
        return {
          kind: 'drag',
          dx: sample.clientX - primary.startX,
          dy: sample.clientY - primary.startY,
        }
      }
      return { kind: 'drag', dx, dy }
    },
    up(sample) {
      const tapped =
        !suppressed &&
        primary?.id === sample.pointerId &&
        !primary.dragging &&
        Math.hypot(
          sample.clientX - primary.startX,
          sample.clientY - primary.startY,
        ) < movementThresholdPixels
      pointers.delete(sample.pointerId)
      previousPinchDistance = pinchDistance()
      clearIfIdle()
      return tapped
        ? { kind: 'tap', clientX: sample.clientX, clientY: sample.clientY }
        : undefined
    },
    cancel(pointerId) {
      suppressed = true
      pointers.delete(pointerId)
      previousPinchDistance = pinchDistance()
      clearIfIdle()
    },
    reset() {
      pointers.clear()
      primary = undefined
      suppressed = false
      previousPinchDistance = undefined
    },
  }
}

/** Convert browser wheel units into one bounded inspection-zoom delta. */
export function journeyWheelZoomDelta(
  deltaY: number,
  deltaMode: number,
  viewportHeight: number,
): number {
  if (!Number.isFinite(deltaY)) return 0
  const pixels =
    deltaMode === 1
      ? deltaY * 16
      : deltaMode === 2
        ? deltaY * Math.max(1, viewportHeight)
        : deltaY
  return -Math.max(-240, Math.min(240, pixels)) / 700
}
