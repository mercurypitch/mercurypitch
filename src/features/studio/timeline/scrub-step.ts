// ============================================================
// Studio scrub step — how far one notch of a scrub moves the playhead, for the controls outside the timeline that scrub it
// ============================================================
//
// The transport's clock scrubs the playhead with the wheel, a sideways drag
// and the arrow keys (clock-scrub.ts). A step goes to the next line of the
// grid the timeline draws while Snap is on, or a second with Snap off; Shift
// goes finer: the grid ten times closer, or a tenth of a second. The grid
// depends on the timeline's zoom and its ruler, and Snap is the timeline's
// own switch, so the timeline publishes them here (StudioTimeline.tsx) and
// the clock reads them, instead of every component between the two passing
// them along. One Studio is open at a time.
import { createSignal } from 'solid-js'
import { STUDIO_SAMPLE_RATE } from '@/lib/studio/model/types'
import { studioGridInterval } from './timeline-snap'

/** The grid a scrub steps along, as the timeline draws it. */
export interface StudioScrubGrid {
  /** Snap is on: a step goes to the next grid line. */
  readonly snap: boolean
  /** The timeline's zoom, which spaces its grid. */
  readonly pixelsPerSecond: number
  /** The tempo of the beat grid, while the ruler counts beats. */
  readonly tempoBpm?: number
}

const [grid, setGrid] = createSignal<StudioScrubGrid | null>(null)

/** The open timeline's grid, or null when no timeline is open. */
export const studioScrubGrid = grid

/** The timeline's report of its grid, each time it changes, and null as it goes. */
export function publishStudioScrubGrid(next: StudioScrubGrid | null): void {
  setGrid(next)
}

/**
 * Where one step of a scrub moves the playhead from `frame`: to the next
 * grid line in `direction` while Snap is on, else a second (`fine`: the grid
 * ten times closer, or a tenth of a second). Never before the song's start.
 */
export function studioScrubFrame(
  frame: number,
  direction: 1 | -1,
  grid: StudioScrubGrid | null,
  fine: boolean,
): number {
  if (grid === null || !grid.snap) {
    const step = (fine ? 0.1 : 1) * STUDIO_SAMPLE_RATE
    return Math.max(0, Math.round(frame + direction * step))
  }
  const interval = studioGridInterval(
    fine ? grid.pixelsPerSecond * 10 : grid.pixelsPerSecond,
    grid.tempoBpm,
  )
  // A playhead within half a frame of a line stands on it: a beat's lines
  // fall between whole frames.
  const at = frame / interval
  const tolerance = 0.5 / interval
  const line =
    direction > 0
      ? Math.floor(at + tolerance) + 1
      : Math.ceil(at - tolerance) - 1
  return Math.max(0, Math.round(line * interval))
}
