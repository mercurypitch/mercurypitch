// ── Jam lane zoom ────────────────────────────────────────────────────
// How far into a pitch lane a viewer is looking, and everything that
// scales with it.
//
// One scalar drives the whole lane: time (pixels per second), pitch (how
// few semitones the band may collapse to) and ink (pill heights, trail
// width). Keeping the arithmetic here rather than inside the draw loop is
// the same bet jam-lane-geometry made -- a number that only exists inside
// a requestAnimationFrame callback is a number nobody can assert on, and
// the lane has already shipped once with a window built back to front.
//
// The zoom itself is a per-viewer preference (see jam-view-prefs). It is
// never sent to the room: how close somebody wants to look at their own
// lane is not something the band has to agree on.

import type { JamSongNote } from '@/lib/jam/types'

/** Closest the lanes go: the whole width is one ruler-second per 60px. */
export const JAM_ZOOM_MIN = 1
/** Furthest in. Past this a lane shows a couple of words and no phrase. */
export const JAM_ZOOM_MAX = 4
/**
 * One notch, for the buttons and for a wheel detent.
 *
 * Multiplicative rather than additive so a notch feels the same at 1x and
 * at 3x -- four notches take 1 -> 2.44, eight reach the ceiling.
 */
export const JAM_ZOOM_STEP = 1.25

/** Below this a zoom is "off", and the readout says 1x rather than 1.02x. */
const ZOOM_EPSILON = 0.005

export function clampJamZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return JAM_ZOOM_MIN
  return Math.min(JAM_ZOOM_MAX, Math.max(JAM_ZOOM_MIN, zoom))
}

/** True for a value that may be restored from storage as a zoom. */
export function isJamZoom(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= JAM_ZOOM_MIN &&
    value <= JAM_ZOOM_MAX
  )
}

/** One notch in or out. `direction` is +1 to zoom in, -1 to zoom out. */
export function steppedJamZoom(zoom: number, direction: number): number {
  const base = clampJamZoom(zoom)
  return clampJamZoom(
    direction >= 0 ? base * JAM_ZOOM_STEP : base / JAM_ZOOM_STEP,
  )
}

/**
 * A wheel notch, in the direction the platform means it.
 *
 * `deltaY` is negative when the content should come closer on every
 * engine that matters, which is also what a trackpad pinch reports
 * through ctrl+wheel. A zero delta is a no-op rather than a zoom in:
 * horizontal-only scrolls arrive here too.
 */
export function zoomFromWheel(zoom: number, deltaY: number): number {
  if (!Number.isFinite(deltaY) || deltaY === 0) return clampJamZoom(zoom)
  return steppedJamZoom(zoom, deltaY < 0 ? 1 : -1)
}

/**
 * Continuous zoom from a two-finger spread.
 *
 * Measured against the distance when the gesture STARTED, not the last
 * frame: accumulating per-frame ratios drifts, and a pinch that returns
 * to where it began has to return the lane with it.
 */
export function zoomFromPinch(
  startZoom: number,
  startDistance: number,
  distance: number,
): number {
  if (!(startDistance > 0) || !(distance > 0)) return clampJamZoom(startZoom)
  return clampJamZoom(startZoom * (distance / startDistance))
}

/** The readout: `1x`, `1.6x`, `4x`. Never more than one decimal. */
export function formatJamZoom(zoom: number): string {
  const z = clampJamZoom(zoom)
  const rounded = Math.round(z * 10) / 10
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
  return `${text}×`
}

/** Whether the lane is showing anything other than its default scale. */
export function isJamZoomDefault(zoom: number): boolean {
  return Math.abs(clampJamZoom(zoom) - JAM_ZOOM_MIN) < ZOOM_EPSILON
}

// ── Pitch band ───────────────────────────────────────────────────────

/** Semitones a lane shows at 1x -- the zen ribbon's own floor. */
export const JAM_LANE_SPAN_WIDE = 10
/** ...and at 4x, where the point is to see a few cents of drift. */
export const JAM_LANE_SPAN_TIGHT = 6

/**
 * Seconds of song either side of the visible window that still count
 * towards the band.
 *
 * Without it the band is a cliff: a leap enters the window already at the
 * edge of the lane and the eased band spends half a second catching up,
 * which reads as the lane lurching just as the hard note arrives. Looking
 * a little further ahead lets the band start moving before the note does.
 */
export const JAM_BAND_LOOKAROUND_SEC = 1.5

/** How few semitones the band may collapse to at this zoom. */
export function jamLaneMinSpan(zoom: number): number {
  const t = (clampJamZoom(zoom) - JAM_ZOOM_MIN) / (JAM_ZOOM_MAX - JAM_ZOOM_MIN)
  return JAM_LANE_SPAN_WIDE + (JAM_LANE_SPAN_TIGHT - JAM_LANE_SPAN_WIDE) * t
}

/**
 * The pitches a lane's vertical band should cover.
 *
 * Notes first, because they are what the singer is aiming at; then this
 * singer's own voiced samples, because a trail drawn outside the lane is
 * a trail that says nothing. Feeding the WHOLE song in (which is what
 * shipped) gave a two-octave song three pixels a semitone, so a perfect
 * note and a whole-tone miss drew the same picture.
 */
export function laneBandMidis(input: {
  notes: readonly JamSongNote[]
  windowFrom: number
  windowTo: number
  sungMidis: readonly number[]
  lookAroundSec?: number
}): number[] {
  const pad = input.lookAroundSec ?? JAM_BAND_LOOKAROUND_SEC
  const from = input.windowFrom - pad
  const to = input.windowTo + pad
  const midis: number[] = []
  for (const note of input.notes) {
    if (note.endSec <= from || note.startSec >= to) continue
    midis.push(note.midi)
  }
  for (const midi of input.sungMidis) midis.push(midi)
  return midis
}

// ── Ink ──────────────────────────────────────────────────────────────

/**
 * Pill heights at 1x, in CSS pixels.
 *
 * Height carries the verdict as well as colour, so a singer who cannot
 * tell green from amber still sees which pills came out solid. These are
 * a third taller than the originals (9/6/4/6): the old ones were legible
 * on a desktop and a smudge on a phone.
 */
export const JAM_PILL_BASE = {
  perfect: 12,
  close: 9,
  miss: 6,
  neutral: 8,
} as const

export type JamPillKind = keyof typeof JAM_PILL_BASE

/** How much of a semitone's height a pill may take before neighbours merge. */
export const JAM_PILL_SEMITONE_CAP = 0.9

/** Ink grows with zoom, but not as fast as the timeline does. */
function inkScale(zoom: number): number {
  return 1 + (clampJamZoom(zoom) - JAM_ZOOM_MIN) * 0.35
}

/**
 * How tall to draw a pill.
 *
 * Capped against the band's own resolution rather than a constant: at
 * seven pixels a semitone a twelve-pixel pill covers its neighbours and
 * the lane stops being readable as pitch at all. The floor keeps a pill
 * visible in a lane squeezed by a twelve-person room.
 */
export function jamPillHeight(
  kind: JamPillKind,
  zoom: number,
  pxPerSemitone: number,
): number {
  const wanted = JAM_PILL_BASE[kind] * inkScale(zoom)
  if (!(pxPerSemitone > 0)) return wanted
  return Math.max(2, Math.min(wanted, pxPerSemitone * JAM_PILL_SEMITONE_CAP))
}

/** Live trail width, in CSS pixels. */
export function jamTrailWidth(zoom: number): number {
  return 2 + (clampJamZoom(zoom) - JAM_ZOOM_MIN) * 0.5
}

/** A pill this tall has room for a note name beside it. */
export const JAM_NOTE_LABEL_MIN_PILL = 12
