// ── Jam lyric scale ──────────────────────────────────────────────────
// How big one viewer wants the words in a song room, and the arithmetic
// of changing it.
//
// A sibling of jam-lane-zoom rather than a second caller of it, because
// the two scalars are different kinds of number. The lane zoom RESTS on
// its floor: 1x is the default and the minimum, so "reset" and "all the
// way out" are the same place, and a multiplicative notch can never
// strand it. Lyric size rests in the MIDDLE of its range -- some people
// want the words smaller than shipped, most who touch it want them
// bigger -- and a multiplicative notch does not survive that. Four
// presses up to the ceiling and four back down lands on 102%, the readout
// says so, and the only way to 100% is a reset the viewer should not have
// needed. So the buttons walk a ladder of fixed stops instead, the way a
// browser's own zoom does, and any value -- a pinch leaves one anywhere --
// steps to the next stop in the direction asked.
//
// Like the lane zoom this is a per-viewer preference (see jam-view-prefs)
// and never crosses the wire: how large somebody needs the words is about
// their eyes and their screen, not about the band.

/** Smallest the words go. Under this a phone column is fine print. */
export const JAM_LYRICS_SCALE_MIN = 0.8
/** Largest. Past this a phone fits two words a row and no phrase. */
export const JAM_LYRICS_SCALE_MAX = 2
/** The size the room ships with, and where reset lands. */
export const JAM_LYRICS_SCALE_DEFAULT = 1

/**
 * Where the buttons stop.
 *
 * The familiar text-zoom ladder: tenths near 100%, where a small change is
 * the whole request ("just a bit bigger"), and quarters beyond it, where
 * anybody still pressing wants to get somewhere. Five presses reach the
 * ceiling from the default and two reach the floor -- the same handful
 * the lane zoom takes to cross its own range.
 */
export const JAM_LYRICS_SCALE_STOPS: readonly number[] = [
  0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2,
]

/** Two scales closer than this are the same size to anybody looking. */
const SCALE_EPSILON = 0.005

export function clampJamLyricsScale(scale: number): number {
  // The default, not the floor: a NaN from a degenerate gesture should
  // cost the viewer nothing, and the floor is a visible change.
  if (!Number.isFinite(scale)) return JAM_LYRICS_SCALE_DEFAULT
  return Math.min(JAM_LYRICS_SCALE_MAX, Math.max(JAM_LYRICS_SCALE_MIN, scale))
}

/** True for a value that may be restored from storage as a lyric scale. */
export function isJamLyricsScale(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= JAM_LYRICS_SCALE_MIN &&
    value <= JAM_LYRICS_SCALE_MAX
  )
}

/**
 * The next stop in a direction. `direction` is +1 for larger, -1 for
 * smaller.
 *
 * "Next" is measured from wherever the scale actually is, so a value a
 * pinch left between two stops goes to the nearer one in the direction
 * asked rather than skipping it. The epsilon is what stops a value that
 * IS a stop, give or take a float, from counting as below itself and
 * making the first press do nothing.
 */
export function steppedJamLyricsScale(
  scale: number,
  direction: number,
): number {
  const from = clampJamLyricsScale(scale)
  if (direction >= 0) {
    const up = JAM_LYRICS_SCALE_STOPS.find(
      (stop) => stop > from + SCALE_EPSILON,
    )
    return up ?? JAM_LYRICS_SCALE_MAX
  }
  const below = JAM_LYRICS_SCALE_STOPS.filter(
    (stop) => stop < from - SCALE_EPSILON,
  )
  return below[below.length - 1] ?? JAM_LYRICS_SCALE_MIN
}

/** Pixels of wheel travel that make one full-strength notch. */
const WHEEL_NOTCH_PX = 100
/** How much one full notch changes the size: about a tenth. */
const WHEEL_NOTCH_GAIN = 0.1
/** What one line, and one page, of wheel travel is worth in pixels. */
const WHEEL_LINE_PX = WHEEL_NOTCH_PX / 3
const WHEEL_PAGE_PX = WHEEL_NOTCH_PX

/**
 * A modified wheel, in proportion to how far it turned.
 *
 * Deliberately not a stop per event, which is what the lane zoom does.
 * A mouse sends one event a detent and either rule suits it; a trackpad
 * pinch arrives as ctrl+wheel too, sixty small events a second, and a
 * stop per event runs the whole ladder before the fingers have moved a
 * centimetre. Scaling by the delta gives the mouse its tenth a notch and
 * the trackpad a size that follows the fingers.
 *
 * Exponential so that out and back is the identity, and capped at one
 * notch an event so a free-spinning wheel cannot cross the range in a
 * single report. `deltaMode` is the WheelEvent's own: Firefox reports a
 * mouse wheel in lines, and three lines taken for three pixels is a
 * control that looks dead.
 */
export function lyricsScaleFromWheel(
  scale: number,
  deltaY: number,
  deltaMode = 0,
): number {
  const from = clampJamLyricsScale(scale)
  if (!Number.isFinite(deltaY) || deltaY === 0) return from
  const unit =
    deltaMode === 1 ? WHEEL_LINE_PX : deltaMode === 2 ? WHEEL_PAGE_PX : 1
  const travel = Math.max(
    -WHEEL_NOTCH_PX,
    Math.min(WHEEL_NOTCH_PX, deltaY * unit),
  )
  // Negative deltaY is "towards me" on every engine that matters, which
  // is also what a trackpad spread reports: bigger.
  return clampJamLyricsScale(
    from * Math.exp((-travel / WHEEL_NOTCH_PX) * WHEEL_NOTCH_GAIN),
  )
}

/**
 * How much of a finger spread reaches the words.
 *
 * Under 1 on purpose. The lanes take the raw ratio because their range is
 * 4x wide; this one is 2.5x, and at the raw ratio an ordinary spread
 * slams into the ceiling while "a little bigger" is a twitch nobody can
 * hold. A power rather than a linear damping so that pinching in is as
 * strong as spreading out: halving the distance undoes doubling it.
 */
const PINCH_RESPONSE = 0.7

/**
 * Continuous size from a two-finger spread.
 *
 * Measured against the distance when the gesture STARTED, not the last
 * frame, for the reason the lane zoom gives: accumulated per-frame ratios
 * drift, and a pinch that returns to where it began has to return the
 * words with it.
 */
export function lyricsScaleFromPinch(
  startScale: number,
  startDistance: number,
  distance: number,
): number {
  if (!(startDistance > 0) || !(distance > 0)) {
    return clampJamLyricsScale(startScale)
  }
  return clampJamLyricsScale(
    clampJamLyricsScale(startScale) *
      Math.pow(distance / startDistance, PINCH_RESPONSE),
  )
}

/** The readout: `80%`, `125%`, `200%`. A whole percent, never a decimal. */
export function formatJamLyricsScale(scale: number): string {
  return `${Math.round(clampJamLyricsScale(scale) * 100)}%`
}

/** Whether the words are at the size the room ships with. */
export function isJamLyricsScaleDefault(scale: number): boolean {
  return (
    Math.abs(clampJamLyricsScale(scale) - JAM_LYRICS_SCALE_DEFAULT) <
    SCALE_EPSILON
  )
}
