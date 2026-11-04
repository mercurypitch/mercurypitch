// ============================================================
// The tab's one scroller (EarRoomShell's stage) holds the bench and the
// Ear Report in turn, and keeps its offset as one replaces the other: the
// report opened wherever the bench had been scrolled to, and the bench
// came back wherever the report was left. So the report opens at its own
// top, and the bench comes back where it was when it opened the report.
// The bench unmounts while the report is up, so its offset is kept here.
// ============================================================

let benchTop: number | null = null

/** The nearest ancestor of `el` that scrolls. */
export function scrollerOf(el: Element | undefined): HTMLElement | null {
  for (let at = el?.parentElement ?? null; at !== null; at = at.parentElement) {
    const { overflowY } = window.getComputedStyle(at)
    if (overflowY === 'auto' || overflowY === 'scroll') return at
  }
  return null
}

/** The bench is opening the report: keep where it stands. */
export function leaveBench(bench: Element | undefined): void {
  benchTop = scrollerOf(bench)?.scrollTop ?? null
}

/** The report is up: at its own top. */
export function openAtTop(report: Element | undefined): void {
  const scroller = scrollerOf(report)
  if (scroller !== null) scroller.scrollTop = 0
}

/** The bench is back: where it was when it opened the report, once. */
export function returnToBench(bench: Element | undefined): void {
  const top = benchTop
  benchTop = null
  if (top === null) return
  const scroller = scrollerOf(bench)
  if (scroller !== null) scroller.scrollTop = top
}
