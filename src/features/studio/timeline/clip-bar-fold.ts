// The floating clip bar's fold. Its commands' names show while the whole bar
// fits beside zoom, at the other end of the timeline's foot; past that it folds
// to icons (StudioTimeline.module.css), each command keeping its name for
// assistive tech, and its title. The bar is measured with its names in and
// folded in the same frame, so nothing flickers, and a folded bar never
// unfolds on its icons' width alone.

/** The room kept between the bar's end and zoom. */
export const CLIP_BAR_ZOOM_GAP = 16

/** Folds or unfolds the bar for the room beside zoom. With nothing laid out, or no zoom beside it, the bar is left be. */
export function fitClipBar(bar: HTMLElement): void {
  const zoom = bar.parentElement?.querySelector<HTMLElement>(
    ':scope > [data-studio-zoom]',
  )
  if (!zoom || zoom.offsetWidth === 0) return
  bar.removeAttribute('data-folded')
  const end = bar.offsetLeft + bar.offsetWidth + CLIP_BAR_ZOOM_GAP
  if (end > zoom.offsetLeft) bar.setAttribute('data-folded', '')
}

/** Fits the bar again whenever the timeline's foot changes width: a window, or a side panel. */
export function watchClipBarRoom(bar: HTMLElement): () => void {
  const foot = bar.parentElement
  if (!foot || typeof ResizeObserver === 'undefined') return () => {}
  const observer = new ResizeObserver(() => fitClipBar(bar))
  observer.observe(foot)
  return () => observer.disconnect()
}
