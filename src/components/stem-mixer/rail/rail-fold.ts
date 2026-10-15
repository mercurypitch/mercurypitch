// How the playback rail folds as it narrows, in one place.
// ============================================================
//
// The rail measures its own width (MixerRail's ResizeObserver), and
// StemMixerTransport folds the speed chip into More below these widths, by
// this rule: More then lists the
// speeds as radio rows, shows a dot while the speed is not 1x, and says the
// speed in its name. The chip and the rows are one decision, made here, so
// the chip is never hidden without its rows in More, or shown beside them.
//
// The timeline's second line is CSS alone (MixerRail.module.css), since no
// script needs to know about it: under 650 px of rail on a mouse, and under
// 1000 px on a coarse pointer, where the controls are 44 px.

/** Below this many px of rail, on a mouse, Speed folds into More. */
export const SPEED_FOLD_PX = 860
/** On a coarse pointer the controls line keeps Speed down to this width. */
export const SPEED_FOLD_COARSE_PX = 640

/**
 * Below this many px of rail, on a mouse, the timeline takes its own line
 * under the controls. MixerRail.module.css holds the rule; this number is
 * its twin for the tests (fold-thresholds.contract.test.ts keeps them equal).
 */
export const TIMELINE_OWN_LINE_PX = 650
/** On a coarse pointer, where the controls are 44 px. */
export const TIMELINE_OWN_LINE_COARSE_PX = 1000

/** True when Speed belongs in More at this rail width. */
export function speedFolds(railWidthPx: number, coarse: boolean): boolean {
  // Not measured yet (jsdom, or before the first layout): keep the chip.
  if (!(railWidthPx > 0)) return false
  return railWidthPx < (coarse ? SPEED_FOLD_COARSE_PX : SPEED_FOLD_PX)
}
