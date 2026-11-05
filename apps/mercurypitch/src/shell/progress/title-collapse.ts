// ============================================================
// The large title, scrolled under the small bar
// ============================================================
//
// The page's large title sits on the first row, under the status bar, with
// What counts and Share beside it (the mock-up's top). As the tab scrolls
// it slides up under the small bar's band, whose glass comes in with it, so
// the title is never drawn over the clock unscreened; once it has gone the
// small title and Share stand in the bar. Watched on the tab's scroller
// (`.main-content`), the one the rail folds on (NativeShell.tsx), a frame
// at a time.

/** The small bar's band under the status bar, as progress.css draws it. */
export const BAR_BAND = 52

export interface TitlePlace {
  /** How far the tab has scrolled. */
  scrollTop: number
  /** The large title's foot, on the screen now. */
  titleBottom: number
  /** The small bar's foot, on the screen: the status bar and the band. */
  barBottom: number
}

/**
 * How far the large title has gone, from 0 at rest to 1 once its foot is
 * above the status bar's: the share of the scroll it takes to get there.
 * Nothing measured (a bar of no height) is at rest.
 */
export function collapseProgress(place: TitlePlace): number {
  if (place.barBottom <= 0) return 0
  const statusBottom = place.barBottom - BAR_BAND
  const distance = place.titleBottom + place.scrollTop - statusBottom
  if (distance <= 0) return 1
  return Math.min(1, Math.max(0, place.scrollTop / distance))
}

/**
 * Report the title's progress on the tab's scroller until the returned
 * stop is called. Nothing to watch outside the app's tab (a test's
 * document), and the title stays at rest.
 */
export function watchTitle(
  root: HTMLElement,
  title: HTMLElement,
  bar: HTMLElement,
  onProgress: (progress: number) => void,
): () => void {
  const scroller = root.closest('.main-content')
  if (!(scroller instanceof HTMLElement)) return () => {}
  let frame = 0
  const measure = (): void => {
    frame = 0
    onProgress(
      collapseProgress({
        scrollTop: scroller.scrollTop,
        titleBottom: title.getBoundingClientRect().bottom,
        barBottom: bar.getBoundingClientRect().bottom,
      }),
    )
  }
  const onScroll = (): void => {
    if (frame === 0) frame = requestAnimationFrame(measure)
  }
  scroller.addEventListener('scroll', onScroll, { passive: true })
  measure()
  return () => {
    scroller.removeEventListener('scroll', onScroll)
    if (frame !== 0) cancelAnimationFrame(frame)
  }
}
