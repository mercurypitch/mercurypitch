// ============================================================
// List place — where Community's list was, and a row brought back into view
// ============================================================
//
// A pushed screen is drawn anew on Back (ShellScreens.tsx draws only the
// top one), its scroller at the top again. So Community keeps where its
// list was when a result was opened from it (community-store.ts), puts it
// back on Back, and then makes sure the row that opened the result stands
// whole between the bar and the dock. The dock lies over the foot of the
// scroller, and the scroller's own bottom padding is the room it leaves
// for it (shell.css, `.mp-pushed__body`), so that padding is the part of
// the scroller a row must stay clear of.

/** A box's top and bottom edges, on the screen. */
export interface Edges {
  top: number
  bottom: number
}

/**
 * How far to scroll so `row` stands whole in `view`: 0 when it does. A row
 * taller than the view shows its top.
 */
export function revealBy(row: Edges, view: Edges): number {
  if (row.top < view.top || row.bottom - row.top > view.bottom - view.top) {
    return row.top - view.top
  }
  return row.bottom > view.bottom ? row.bottom - view.bottom : 0
}

/** The scroller a shell screen is drawn in: its pushed screen's body. */
export function scrollerOf(element: Element | null): HTMLElement | null {
  return element?.closest<HTMLElement>('.mp-pushed__body') ?? null
}

/** Bring `row` into the part of `scroller` the dock leaves clear. */
export function revealRow(row: HTMLElement, scroller: HTMLElement): void {
  const box = scroller.getBoundingClientRect()
  const dock = Number.parseFloat(
    window.getComputedStyle(scroller).paddingBottom,
  )
  const by = revealBy(row.getBoundingClientRect(), {
    top: box.top,
    bottom: box.bottom - (Number.isFinite(dock) ? dock : 0),
  })
  if (by !== 0) scroller.scrollTop += by
}
