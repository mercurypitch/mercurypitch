// ============================================================
// Studio lane navigation — the wheel, a trackpad and two fingers over the lanes scroll and zoom the arrangement, as in a DAW
// ============================================================
//
// Over the lanes and the ruler (the timeline's scroll viewport) the browser
// already scrolls: the wheel moves the lanes up and down, Shift with the
// wheel and a trackpad's sideways swipe move through the song, and one
// finger pans both ways. This adds what the browser cannot do for it:
//
// - Ctrl or Cmd with the wheel, and a trackpad pinch (which the browser
//   sends as Ctrl and the wheel), zoom the timeline about the pointer.
//   Left to the browser, they zoomed the whole page. Safari sends a
//   trackpad pinch as gesture events instead (studioGestureZoom), and only
//   a browser that has them listens for them.
// - A plain wheel over lanes that all fit, with nowhere to go up or down,
//   moves through the song instead. A song of a few lanes fits a desktop
//   window, and there a wheel turned over the lanes did nothing at all.
// - Two fingers zoom the timeline about the point between them and pan it.
//   The page itself never zooms over the lanes: the viewport allows only
//   panning (touch-action in StudioTimeline.module.css), and one finger
//   stays the browser's own pan, so it keeps its momentum.
//
// A clip drag, a trim, a fade and the ruler's gestures own their pointer;
// each lets go when a second finger lands (useStudioPointer.ts,
// ruler-gesture.ts), so a pinch never moves a clip or draws a range.
import { isStudioWheelNotch, studioWheelZoomFactor } from './zoom-math'

/** What a wheel event over the lanes does. */
export type StudioWheelIntent = 'zoom' | 'sideways' | 'native'

type WheelInput = Pick<
  WheelEvent,
  'ctrlKey' | 'metaKey' | 'shiftKey' | 'deltaX' | 'deltaY' | 'deltaMode'
>

/** Whether the lanes can scroll each way. */
export interface StudioLaneRoom {
  vertical: boolean
  horizontal: boolean
}

/** Pixels a line of wheel scrolling moves: three lines are about a notch. */
const LINE_PIXELS = 33

export function studioWheelIntent(
  event: WheelInput,
  room: StudioLaneRoom,
): StudioWheelIntent {
  if (event.ctrlKey || event.metaKey) return 'zoom'
  if (event.shiftKey || room.vertical || !room.horizontal) return 'native'
  return Math.abs(event.deltaY) > Math.abs(event.deltaX) ? 'sideways' : 'native'
}

/** A wheel event's vertical turn in pixels, whatever unit it counts in. */
export function studioWheelPixels(
  event: Pick<WheelEvent, 'deltaY' | 'deltaMode'>,
  pagePixels: number,
): number {
  if (event.deltaMode === 1) return event.deltaY * LINE_PIXELS
  if (event.deltaMode === 2) return event.deltaY * pagePixels
  return event.deltaY
}

/**
 * What one of Safari's gesture events zooms by. Safari sends a trackpad
 * pinch as gesturestart, gesturechange and gestureend, each with the scale
 * since the pinch began, instead of Ctrl and the wheel: a step is that scale
 * against the one before, never more than double or half at once.
 */
export function studioGestureZoom(previous: number, scale: number): number {
  if (!(previous > 0) || !(scale > 0) || !Number.isFinite(scale)) return 1
  return Math.min(2, Math.max(0.5, scale / previous))
}

/** Safari's GestureEvent, as far as a pinch reads it. */
type GestureInput = Event & { scale?: number; clientX?: number }

/** Two fingers as a pinch reads them: how far apart, and the point between. */
export interface StudioPinchPoint {
  distance: number
  x: number
  y: number
}

/**
 * What a pinch does from one frame of two fingers to the next: zoom by how
 * far they spread, about the point between them, and scroll (`panX`,
 * `panY`, added to the lanes' scroll) so the lanes follow that point.
 */
export function studioPinchStep(
  before: StudioPinchPoint,
  now: StudioPinchPoint,
): { factor: number; anchorX: number; panX: number; panY: number } {
  return {
    factor: before.distance > 0 ? now.distance / before.distance : 1,
    anchorX: now.x,
    panX: before.x - now.x,
    panY: before.y - now.y,
  }
}

function pinchPoint(touches: TouchList): StudioPinchPoint {
  const [a, b] = [touches[0], touches[1]]
  return {
    distance: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY),
    x: (a.clientX + b.clientX) / 2,
    y: (a.clientY + b.clientY) / 2,
  }
}

/**
 * Listens on the timeline's viewport for wheel and two-finger input;
 * `zoomBy` zooms by a factor about a point on screen. Returns the detach.
 */
export function attachStudioLaneNavigation(
  viewport: HTMLElement,
  options: { zoomBy(factor: number, clientX: number): void },
): () => void {
  let pinch: StudioPinchPoint | null = null
  // Safari's pinch: the scale it reached so far, while one is under way.
  let gestureScale: number | null = null
  let pointerX: number | null = null

  const onWheel = (event: WheelEvent) => {
    pointerX = event.clientX
    const intent = studioWheelIntent(event, {
      vertical: viewport.scrollHeight > viewport.clientHeight + 1,
      horizontal: viewport.scrollWidth > viewport.clientWidth + 1,
    })
    if (intent === 'native') return
    if (event.cancelable) event.preventDefault()
    if (intent === 'zoom') {
      // A pinch Safari already sends as gesture events zooms once.
      if (gestureScale === null)
        options.zoomBy(studioWheelZoomFactor(event), event.clientX)
    } else {
      const pixels = studioWheelPixels(event, viewport.clientWidth)
      // A notch moves as far as a notch scrolls down; a trackpad its own way.
      viewport.scrollLeft += isStudioWheelNotch(event)
        ? Math.sign(pixels) * Math.max(Math.abs(pixels), 100)
        : pixels
    }
  }
  const onTouchStart = (event: TouchEvent) => {
    pinch = event.touches.length === 2 ? pinchPoint(event.touches) : null
  }
  const onTouchMove = (event: TouchEvent) => {
    if (pinch === null || event.touches.length !== 2) return
    const now = pinchPoint(event.touches)
    const step = studioPinchStep(pinch, now)
    pinch = now
    // Once the browser is panning, a move cannot be stopped: it pans and
    // the pinch only zooms.
    if (event.cancelable) {
      event.preventDefault()
      viewport.scrollLeft += step.panX
      viewport.scrollTop += step.panY
    }
    if (step.factor !== 1) options.zoomBy(step.factor, step.anchorX)
  }
  const onTouchEnd = (event: TouchEvent) => {
    pinch = event.touches.length === 2 ? pinchPoint(event.touches) : null
  }
  const gestureX = (event: GestureInput): number => {
    if (typeof event.clientX === 'number' && Number.isFinite(event.clientX))
      return event.clientX
    if (pointerX !== null) return pointerX
    const box = viewport.getBoundingClientRect()
    return box.left + box.width / 2
  }
  const onGestureStart = (event: Event) => {
    event.preventDefault()
    gestureScale = (event as GestureInput).scale ?? 1
  }
  const onGestureChange = (event: Event) => {
    event.preventDefault()
    const scale = (event as GestureInput).scale ?? 1
    const factor = studioGestureZoom(gestureScale ?? 1, scale)
    gestureScale = scale
    // On an iPad the fingers' touches carry the pinch already (onTouchMove).
    if (pinch === null && factor !== 1)
      options.zoomBy(factor, gestureX(event as GestureInput))
  }
  const onGestureEnd = (event: Event) => {
    event.preventDefault()
    gestureScale = null
  }
  const onPointerMove = (event: PointerEvent) => {
    pointerX = event.clientX
  }
  const gestures =
    typeof (globalThis as { GestureEvent?: unknown }).GestureEvent !==
    'undefined'

  viewport.addEventListener('wheel', onWheel, { passive: false })
  viewport.addEventListener('touchstart', onTouchStart, { passive: true })
  viewport.addEventListener('touchmove', onTouchMove, { passive: false })
  viewport.addEventListener('touchend', onTouchEnd, { passive: true })
  viewport.addEventListener('touchcancel', onTouchEnd, { passive: true })
  if (gestures) {
    viewport.addEventListener('gesturestart', onGestureStart)
    viewport.addEventListener('gesturechange', onGestureChange)
    viewport.addEventListener('gestureend', onGestureEnd)
    viewport.addEventListener('pointermove', onPointerMove, { passive: true })
  }
  return () => {
    viewport.removeEventListener('wheel', onWheel)
    viewport.removeEventListener('touchstart', onTouchStart)
    viewport.removeEventListener('touchmove', onTouchMove)
    viewport.removeEventListener('touchend', onTouchEnd)
    viewport.removeEventListener('touchcancel', onTouchEnd)
    viewport.removeEventListener('gesturestart', onGestureStart)
    viewport.removeEventListener('gesturechange', onGestureChange)
    viewport.removeEventListener('gestureend', onGestureEnd)
    viewport.removeEventListener('pointermove', onPointerMove)
  }
}
