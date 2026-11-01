// ============================================================
// A scroller's edges: is there more to see past each one?
// ============================================================
//
// A body that scrolls on a short phone said nothing about it: on a 360 by
// 640 screen the reveal's Merc and his line sat under Continue, and on a
// 320 by 568 one Keep's Use email was under the screen's edge, with
// nothing to show there was more. This marks the scroller with
// `data-more-above` and `data-more-below` while there is content past that
// edge, so a stylesheet can fade it there. Measured at once, on scroll, and
// whenever the scroller or what is in it changes size.

/** Mark `scroller`'s edges until the returned stop is called. */
export function watchScrollEdges(scroller: HTMLElement): () => void {
  const mark = (): void => {
    const top = scroller.scrollTop
    const above = top > 1
    const below = top + scroller.clientHeight < scroller.scrollHeight - 1
    scroller.toggleAttribute('data-more-above', above)
    scroller.toggleAttribute('data-more-below', below)
  }
  mark()
  scroller.addEventListener('scroll', mark, { passive: true })
  let observer: ResizeObserver | null = null
  if (typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(mark)
    observer.observe(scroller)
    for (const child of scroller.children) observer.observe(child)
  }
  return () => {
    scroller.removeEventListener('scroll', mark)
    observer?.disconnect()
  }
}
