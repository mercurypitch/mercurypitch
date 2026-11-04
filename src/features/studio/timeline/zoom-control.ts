// ============================================================
// Studio zoom control — every zoom of the timeline in one place: a step about the playhead, a factor about the pointer, or the whole song
// ============================================================
//
// The buttons and the keys step between stops about the playhead: it stays
// where it stood on screen, or comes to the middle of the lanes when it was
// out of sight. The wheel and a pinch zoom by a factor about the pointer,
// at most once a frame, however many events arrive in it. Fit shows the
// whole song. The timeline lays itself out again for the new zoom, and the
// scroll that keeps the moment in place is set in a microtask after that,
// so both land before the next paint.
import { STUDIO_SAMPLE_RATE } from '@/lib/studio/model/types'
import { clampStudioZoom, studioAnchoredScroll, studioZoomPercent, studioZoomStep, } from './zoom-math'

/** What the zoom reads and moves of the timeline's scroll viewport. */
interface ZoomViewport {
  scrollLeft: number
  getBoundingClientRect(): { left: number }
}

/** Where a zoom is about: a pointer's clientX, or the playhead. */
export type StudioZoomAnchor = number | 'playhead'

export function createStudioZoom(options: {
  viewport(): ZoomViewport | undefined
  /** The lane headers' width: the lanes start this far into the viewport. */
  headerWidth(): number
  /** How wide the lanes show. */
  contentWidth(): number
  /** The zoom the timeline draws now, in pixels per second. */
  scale(): number
  /** The lowest zoom out (zoom-math.ts studioZoomFloor, or a phone's fit). */
  floor(): number
  playheadFrame(): number
  /** Draws the timeline at a new zoom. */
  apply(pixelsPerSecond: number): void
  /** Shows the whole song. */
  fit(): void
}) {
  let pending: { factor: number; clientX: number } | null = null

  /** The moment to keep in place, and how far into the lanes it stands. */
  function anchorOf(
    viewport: ZoomViewport,
    at: StudioZoomAnchor,
  ): { seconds: number; x: number } {
    const scale = options.scale()
    const width = options.contentWidth()
    if (at === 'playhead') {
      const seconds = options.playheadFrame() / STUDIO_SAMPLE_RATE
      const x = seconds * scale - viewport.scrollLeft
      return { seconds, x: x >= 0 && x <= width ? x : width / 2 }
    }
    const left = viewport.getBoundingClientRect().left + options.headerWidth()
    const x = Math.max(0, Math.min(width, at - left))
    return { seconds: (viewport.scrollLeft + x) / scale, x }
  }

  function zoomTo(next: number, at: StudioZoomAnchor): void {
    const viewport = options.viewport()
    if (!viewport) return
    const target = clampStudioZoom(next, options.floor())
    if (Math.abs(target - options.scale()) < 0.01) return
    const anchor = anchorOf(viewport, at)
    options.apply(target)
    queueMicrotask(() => {
      viewport.scrollLeft = studioAnchoredScroll(
        anchor.seconds,
        anchor.x,
        options.scale(),
      )
    })
  }

  function flush(): void {
    const next = pending
    pending = null
    if (next) zoomTo(options.scale() * next.factor, next.clientX)
  }

  return {
    zoomTo,
    /** One stop in (1) or out (-1), about the playhead. */
    step(direction: 1 | -1): void {
      const next = studioZoomStep(options.scale(), direction, options.floor())
      if (next !== null) zoomTo(next, 'playhead')
    },
    canStep: (direction: 1 | -1) =>
      studioZoomStep(options.scale(), direction, options.floor()) !== null,
    /** Zooms by `factor` about `clientX`, together with the rest of this frame's. */
    zoomBy(factor: number, clientX: number): void {
      if (pending === null) requestAnimationFrame(flush)
      pending = { factor: (pending?.factor ?? 1) * factor, clientX }
    },
    fit: () => options.fit(),
    /** The zoom as the control reads it, in percent of the opening zoom. */
    percent: () => studioZoomPercent(options.scale()),
  }
}

export type StudioZoomControl = ReturnType<typeof createStudioZoom>
