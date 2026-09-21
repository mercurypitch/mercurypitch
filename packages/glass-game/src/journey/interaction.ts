// Journey pointer gestures — distinguish selection taps from drags and cancelled touch.

export interface JourneyPointerSample {
  pointerId: number
  clientX: number
  clientY: number
}

export type JourneyPointerMove = { kind: 'drag'; dx: number; dy: number }

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
  const pointers = new Set<number>()
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

  function clearIfIdle(): void {
    if (pointers.size === 0) {
      primary = undefined
      suppressed = false
    }
  }

  return {
    down(sample) {
      pointers.add(sample.pointerId)
      if (primary !== undefined || pointers.size > 1) {
        suppressed = true
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
      clearIfIdle()
      return tapped
        ? { kind: 'tap', clientX: sample.clientX, clientY: sample.clientY }
        : undefined
    },
    cancel(pointerId) {
      if (primary?.id === pointerId) suppressed = true
      pointers.delete(pointerId)
      clearIfIdle()
    },
    reset() {
      pointers.clear()
      primary = undefined
      suppressed = false
    },
  }
}
