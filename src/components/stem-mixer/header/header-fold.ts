// How the mixer header folds as it narrows, in one place.
// ============================================================
//
// The header measures its own width (a ResizeObserver in MixerHeader). Below
// these widths Stage, Layout, the sidebar toggle and Tour fold into one View
// menu, and Karaoke Night drops its words for its icon. The buttons that stay
// lose their words first, by CSS alone, under 1000 px of header (and always
// on a touch screen, where they are 44 px squares).

/** Below this many px of header, on a mouse, the view controls fold. */
export const HEADER_FOLD_PX = 600
/** A finger's 44 px controls fold them sooner. */
export const HEADER_FOLD_COARSE_PX = 1000

/** True when the view controls belong in the View menu at this width. */
export function headerFolds(headerWidthPx: number, coarse: boolean): boolean {
  // Not measured yet (jsdom, or before the first layout): nothing folds.
  if (!(headerWidthPx > 0)) return false
  return headerWidthPx < (coarse ? HEADER_FOLD_COARSE_PX : HEADER_FOLD_PX)
}
