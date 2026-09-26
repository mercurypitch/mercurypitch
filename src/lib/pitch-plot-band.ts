// ============================================================
// pitch-plot-band — how much of a pitch canvas the view gets
// ============================================================
//
// PitchCanvas maps its fitted view (the lowest note to the highest, with two
// semitones of air) onto its height less two bands: 34 px above, for the
// stage's status chip and accuracy readout, and 78 px under, for its control
// bar and bar counter.
//
// Over a room (the Sing room's canvas, drawn over a photograph) neither
// overlay is on the canvas: the room's HUD sits above it and the tab bar
// under it. Upright the bands are only air there, and part of the picture
// the owner knows, so they stay. On its side the canvas is 117 px tall
// (844x390) and the bands took 112 px of it: every pitch landed in the same
// five pixels and the line was one flat row (device round 5).
//
// So over a room the bands give way on a short canvas. They keep the stage's
// sizes from FULL_BANDS_FROM up, where they are a third of the canvas at most
// and which every phone upright clears. They are down to the least a row
// label and the line's head need at LEAST_BANDS_AT and under, which is every
// phone on its side. Between the two they ease in step with the height.

export interface PlotBand {
  /** Kept clear above the view, in CSS px. */
  readonly top: number
  /** Kept clear under the view, in CSS px. */
  readonly bottom: number
  /** A room canvas short enough for its bands to give way. */
  readonly short: boolean
}

/** The stage's bands, for the overlays that sit on its canvas. */
export const STAGE_BAND: PlotBand = { top: 34, bottom: 78, short: false }

/**
 * The least a room canvas keeps: above, the top row's 10 px label, which
 * sits over its line; under, the core of the line's head (5 px radius).
 */
export const LEAST_BAND: PlotBand = { top: 14, bottom: 6, short: true }

/** From here up a room canvas keeps the stage's bands: a third of it at most. */
export const FULL_BANDS_FROM = 3 * (STAGE_BAND.top + STAGE_BAND.bottom)

/** From here down, the least bands. */
export const LEAST_BANDS_AT = FULL_BANDS_FROM / 2

/** Row labels are 10 px text; closer than this, one sits on the next. */
export const MIN_LABEL_GAP = 12

/** The bands for a canvas `height` px tall, over a room or on the stage. */
export function plotBand(height: number, overRoom: boolean): PlotBand {
  if (!overRoom || !Number.isFinite(height) || height >= FULL_BANDS_FROM) {
    return STAGE_BAND
  }
  if (height <= LEAST_BANDS_AT) return LEAST_BAND
  const t = (height - LEAST_BANDS_AT) / (FULL_BANDS_FROM - LEAST_BANDS_AT)
  return {
    top: LEAST_BAND.top + t * (STAGE_BAND.top - LEAST_BAND.top),
    bottom: LEAST_BAND.bottom + t * (STAGE_BAND.bottom - LEAST_BAND.bottom),
    short: true,
  }
}

/**
 * Which rows get a label, for rows at `ys` in the order the canvas walks
 * them. Where the bands held, the stage's rule: every row, or every other
 * one past thirty (a large import). On a short room canvas a row is labelled
 * only when it stands MIN_LABEL_GAP clear of the last one labelled. The lines
 * are never thinned.
 */
export function labelledRows(ys: readonly number[], band: PlotBand): boolean[] {
  if (!band.short) {
    const step = ys.length > 30 ? 2 : 1
    return ys.map((_, i) => i % step === 0)
  }
  let last: number | null = null
  return ys.map((y) => {
    if (last !== null && Math.abs(y - last) < MIN_LABEL_GAP) return false
    last = y
    return true
  })
}
