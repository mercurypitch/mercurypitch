// ============================================================
// Ring of rooms — the kit's spiral seen from above, mounted as the ring the rooms are drawn on
// ============================================================
//
// Lesson 12's ring of rooms, moved into the kit so a later lesson draws its
// chords on the same ring (Lesson 27's WEB-SPEC, What the kit and the app
// still need, item 4); its drawing is ring-rooms-draw.ts. It is the kit's
// spiral, taken further without forking it: seen from above from its first
// frame, so one turn is a ring of twelve and C4 to B4 sit on it, held
// still, its slider kept on that turn, its five black keys lit at mount so
// each carries its sharp (`mountRing`). A page whose chips play its chords
// mounts it inert, a picture with no slider, its beads drawn and never
// tapped (Lesson 27).

import type { SoundOwner } from './now-playing'
import { RING } from './ring-rooms-draw'
import type { Spiral, SpiralFrame } from './spiral'
import { mountSpiral } from './spiral'

/** The notes the slider reaches: the lit turn, C4 to B4. */
export const RING_RANGE: readonly [number, number] = [60, 71]
/** The lit turn's five black keys, C♯4 to A♯4, lit so each carries its name. */
export const RING_BLACK: readonly number[] = [61, 63, 66, 68, 70]

export interface RingOptions {
  /** When it draws: on screen and on its step (a deck's `toyActive`). */
  readonly active: () => boolean
  /** The page's one-sound owner, for a tapped bead. */
  readonly owner?: SoundOwner
  /** Draws the page's rooms and marks over each frame. */
  readonly overlay: (frame: SpiralFrame) => void
  /** Whether the overlay has a frame to draw (frame-loop.ts). */
  readonly overlayWants: () => boolean
  /** A picture: its beads drawn, never tapped (Lesson 27's ring, whose chips play); default false. */
  readonly inert?: boolean
}

/**
 * Mounts the kit's spiral in `viz` as the ring of rooms: seen from above
 * from its first frame, held still, its slider kept on C4 to B4, its beads
 * carrying their letters, and its five black keys lit so each carries its
 * sharp. An inert ring is a picture, whose page plays its chords from
 * buttons beside it.
 */
export function mountRing(viz: HTMLElement, opts: RingOptions): Spiral {
  const spiral = mountSpiral(viz, {
    active: opts.active,
    ring: RING,
    view: 'top',
    range: () => RING_RANGE,
    owner: opts.owner,
    overlay: opts.overlay,
    overlayWants: opts.overlayWants,
    inert: opts.inert,
  })
  spiral.setTurning(false)
  spiral.setLabels('letter')
  RING_BLACK.forEach((m) => spiral.light(m))
  return spiral
}
