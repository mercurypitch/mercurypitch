// ============================================================
// The headline block, measured for the layout
// ============================================================
//
// RoomsAlley reads the block that holds the mark and the welcome once per
// measure: upright its bottom is the doors' ceiling, and on its side its
// right edge is the column the doors keep right of and the card takes.

/**
 * The headline block as the layout needs it, in the alley's own coordinates:
 * its bottom and right edges, its top padding (the safe top), its left
 * padding edge, and the mark's bottom (0 with no mark).
 */
export function readBlock(
  top: HTMLElement,
  mark: HTMLElement | undefined,
): { bottom: number; right: number; pad: number; left: number; mark: number } {
  const style = window.getComputedStyle(top)
  return {
    bottom: Math.ceil(top.offsetTop + top.offsetHeight),
    right: Math.ceil(top.offsetLeft + top.offsetWidth),
    pad: Math.ceil(Number.parseFloat(style.paddingTop) || 0),
    left: Math.round(
      top.offsetLeft + (Number.parseFloat(style.paddingLeft) || 0),
    ),
    mark:
      mark === undefined
        ? 0
        : Math.ceil(top.offsetTop + mark.offsetTop + mark.offsetHeight),
  }
}
