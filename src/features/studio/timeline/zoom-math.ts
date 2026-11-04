// ============================================================
// Studio zoom math — the zoom's stops and its floor, what a wheel or a pinch zooms by, and where the view scrolls so a moment stays put
// ============================================================
//
// Zoom is pixels per second of song. The buttons and the keys step between
// STUDIO_ZOOM_STOPS; Ctrl or Cmd with the wheel, a trackpad pinch and a
// two-finger pinch zoom freely between the floor and STUDIO_ZOOM_MAX. The
// floor is the first stop, or lower for a long song, so Fit can show all of
// it; on a phone it is the zoom that fits the whole song. Every zoom keeps
// one moment where it was on screen (studioAnchoredScroll): the pointer's, or
// the playhead's for a key or a button.
import { STUDIO_SAMPLE_RATE } from '@/lib/studio/model/types'

/** Zoom stops in pixels per second; Fit and a pinch may land between them. */
export const STUDIO_ZOOM_STOPS = [10, 15, 20, 30, 40, 60, 80, 120, 160, 200]
/** The zoom a song opens at (StudioWorkspace.tsx), read as 100 percent. */
export const STUDIO_ZOOM_HOME = 40
/** The closest zoom: 5 ms a pixel. */
export const STUDIO_ZOOM_MAX = STUDIO_ZOOM_STOPS[STUDIO_ZOOM_STOPS.length - 1]
/** How much one wheel notch zooms in, or out by its inverse. */
const NOTCH_ZOOM = 1.25
/** A trackpad pinch's wheel deltas, in pixels, per e-fold of zoom. */
const PINCH_PIXELS_PER_E = 100

/**
 * The zoom that fits `contentEndFrames` of song and a second of room in
 * `width` pixels of lane, less a margin: rounded down to a tenth, so a narrow
 * window is filled, never overfilled. A long song may go below the first stop.
 */
export function studioFitZoom(width: number, contentEndFrames: number): number {
  const seconds = Math.max(1, contentEndFrames / STUDIO_SAMPLE_RATE + 1)
  const fit = Math.floor(((width - 24) / seconds) * 10) / 10
  return Math.max(1, Math.min(STUDIO_ZOOM_MAX, fit))
}

/** The lowest zoom out: the first stop, or a long song's fit below it, never under 1. */
export function studioZoomFloor(fit: number): number {
  return Math.max(1, Math.min(STUDIO_ZOOM_STOPS[0], fit))
}

/**
 * A zoom to a hundredth of a pixel per second. A pinch multiplies many small
 * factors, which ends in float noise (53.24000000000001); nobody sees a
 * hundredth of a pixel a second.
 */
export function roundStudioZoom(value: number): number {
  return Math.round(value * 100) / 100
}

/** `value` held between `floor` and the closest zoom, to a hundredth. */
export function clampStudioZoom(value: number, floor: number): number {
  if (!Number.isFinite(value)) return floor
  return roundStudioZoom(Math.max(floor, Math.min(STUDIO_ZOOM_MAX, value)))
}

/**
 * The next stop in (1) or out (-1) from `current`, or null at either end.
 * Out never goes under `floor`: past the lowest stop above it, it lands on
 * the floor itself.
 */
export function studioZoomStep(
  current: number,
  direction: 1 | -1,
  floor: number,
): number | null {
  if (direction > 0)
    return STUDIO_ZOOM_STOPS.find((stop) => stop > current + 0.05) ?? null
  const below = [...STUDIO_ZOOM_STOPS]
    .reverse()
    .find((stop) => stop < current - 0.05 && stop >= floor)
  if (below !== undefined) return below
  return floor < current - 0.05 ? floor : null
}

/**
 * Whether a wheel event is a mouse wheel's notch rather than a trackpad's
 * stream of small deltas: counted in lines or pages, or a big step at once.
 */
export function isStudioWheelNotch(
  event: Pick<WheelEvent, 'deltaX' | 'deltaY' | 'deltaMode'>,
): boolean {
  return (
    event.deltaMode !== 0 ||
    Math.max(Math.abs(event.deltaX), Math.abs(event.deltaY)) >= 50
  )
}

/**
 * What one Ctrl or Cmd wheel event zooms by: a notch up zooms in a quarter
 * and a notch down back out; a trackpad pinch, which the browser sends as
 * Ctrl and the wheel, zooms by its own amount, so the lanes follow the
 * fingers.
 */
export function studioWheelZoomFactor(
  event: Pick<WheelEvent, 'deltaY' | 'deltaMode'>,
): number {
  if (event.deltaY === 0) return 1
  if (isStudioWheelNotch({ ...event, deltaX: 0 }))
    return event.deltaY < 0 ? NOTCH_ZOOM : 1 / NOTCH_ZOOM
  return Math.min(
    2,
    Math.max(0.5, Math.exp(-event.deltaY / PINCH_PIXELS_PER_E)),
  )
}

/**
 * Where the lanes scroll to, at `pixelsPerSecond`, so the moment `seconds`
 * into the song stands `x` pixels into the lanes: as near as the song's
 * start allows.
 */
export function studioAnchoredScroll(
  seconds: number,
  x: number,
  pixelsPerSecond: number,
): number {
  return Math.max(0, seconds * pixelsPerSecond - x)
}

/** The zoom as the control reads it: the opening zoom is 100 percent. */
export function studioZoomPercent(pixelsPerSecond: number): number {
  return Math.round((pixelsPerSecond / STUDIO_ZOOM_HOME) * 100)
}
