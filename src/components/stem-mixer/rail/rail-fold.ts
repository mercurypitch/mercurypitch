// How the playback rail folds as it narrows, in one place.
// ============================================================
//
// The rail measures its own width (MixerRail's ResizeObserver), and
// StemMixerTransport folds controls into More below these widths, by these
// rules, one control at a time:
//
//   Speed               More lists the speeds as radio rows, shows a dot
//                       while the speed is not 1x, and says it in its name.
//   Key                 More gets a Key row that opens the same stepper,
//                       and says a moved key the same way.
//   Play from the start the last to go: More's first row.
//
// A chip and its rows are one decision, made here, so a control is never
// hidden without its row in More, or shown beside it.
//
// The widths are what the controls take, measured in Chromium in October
// 2026 with Speed already in More: the two ends of the controls line, the
// grid's two gaps (12 px) and its padding (8 px a side). On a coarse
// pointer the controls are 44 px: the left end takes 402 px, the key chip
// and More 132, More alone 44. On a mouse they take 264, 102 and 28.
//
// The timeline's second line is CSS alone (MixerRail.module.css), since no
// script needs to know about it: under 650 px of rail on a mouse, and under
// 1000 px on a coarse pointer, where the controls are 44 px.

/** Below this many px of rail, on a mouse, Speed folds into More. */
export const SPEED_FOLD_PX = 860
/** On a coarse pointer the controls line keeps Speed down to this width. */
export const SPEED_FOLD_COARSE_PX = 640

/** Below this many px of rail, on a mouse, Key folds into More: 264 + 102 + 40. */
export const KEY_FOLD_PX = 406
/** On a coarse pointer: 402 + 132 + 40. */
export const KEY_FOLD_COARSE_PX = 574

/** Below this, on a mouse, Play from the start goes too: 264 + 28 + 40. */
export const RESTART_FOLD_PX = 332
/** On a coarse pointer: 402 + 44 + 40. */
export const RESTART_FOLD_COARSE_PX = 486

/**
 * Below this many px of rail, on a mouse, the timeline takes its own line
 * under the controls. MixerRail.module.css holds the rule; this number is
 * its twin for the tests (fold-thresholds.contract.test.ts keeps them equal).
 */
export const TIMELINE_OWN_LINE_PX = 650
/** On a coarse pointer, where the controls are 44 px. */
export const TIMELINE_OWN_LINE_COARSE_PX = 1000

function foldsBelow(railWidthPx: number, px: number): boolean {
  // Not measured yet (jsdom, or before the first layout): keep the control.
  if (!(railWidthPx > 0)) return false
  return railWidthPx < px
}

/** True when Speed belongs in More at this rail width. */
export function speedFolds(railWidthPx: number, coarse: boolean): boolean {
  return foldsBelow(railWidthPx, coarse ? SPEED_FOLD_COARSE_PX : SPEED_FOLD_PX)
}

/** True when Key belongs in More at this rail width. */
export function keyFolds(railWidthPx: number, coarse: boolean): boolean {
  return foldsBelow(railWidthPx, coarse ? KEY_FOLD_COARSE_PX : KEY_FOLD_PX)
}

/** True when Play from the start belongs in More at this rail width. */
export function restartFolds(railWidthPx: number, coarse: boolean): boolean {
  return foldsBelow(
    railWidthPx,
    coarse ? RESTART_FOLD_COARSE_PX : RESTART_FOLD_PX,
  )
}
