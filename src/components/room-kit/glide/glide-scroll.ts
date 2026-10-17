// ============================================================
// A glide run's scroll: where the camera is at each moment of a run
// ============================================================
//
// Time is the distance along the room (DESIGN-ng-slides.md 1,
// DESIGN-lip-roll.md 1): the playhead stays put on the screen and the
// arches move under it. The camera is the world X under the playhead, in
// the room's W units; arch k's middle (an apex, a crest) is at k * period.
//
//   arch k      up, top and down: the camera moves at one constant speed,
//               the arch's span over its time, so x is linear in time
//               wherever the voice is judged
//   landing     the landing and the rest after it cover the landing
//   + rest      (`landingW`) in their time: the scroll slows to a stand
//               over the landing, stands through the pause and the next
//               root's tone, and eases back up to the arch speed before
//               the next arch starts (room-kit glide-gap.ts)
//   count-in    from the intro at rest to the first arch's foot at the
//               arch speed, on a cubic; the intro may have the playhead a
//               little inside the first arch, so the room rolls back a
//               short way before it comes in
//   end         after the last arch, the scroll comes to rest over its
//               landing
//
// Pure arithmetic on the glide path's own times (src/lib/glide), so the
// arch under the playhead is always the arch the engine judges. A room
// brings its geometry (GlideScrollGeometry) and adds what is its own: Lip
// roll's zoom and its demo's hold (bay-scroll.ts), Ng slides' names
// (bridge-scroll.ts).

import type { ArchGap } from '@/components/room-kit/glide-gap'
import { archGapAt, easedDistance as eased, planArchGap, } from '@/components/room-kit/glide-gap'
import type { GlidePath } from '@/lib/glide/glide-path'
import type { GlideScroll } from './glide-take'

/** The room's world, as its scroll reads it, W. */
export interface GlideScrollGeometry {
  /** An arch's half-span: its feet are this far either side of its middle. */
  readonly a: number
  /** From one arch's middle to the next's. */
  readonly period: number
  /** The landing between two arches (the storyboard's width). */
  readonly landingW: number
  /** The camera on the intro, world X. */
  readonly introCamera: number
}

/** A run's scroll, before a room adds its own. */
export interface GlideRunScroll extends GlideScroll {
  /** The camera's speed during every arch, W/s. */
  readonly speed: number
  /** The camera's lowest and highest X over the run. */
  readonly min: number
  readonly max: number
  /** The count-in, s: the run starts at t = -countIn. */
  readonly countIn: number
  /** From the run's start to the first arch's foot, s. */
  readonly lead: number
}

/** The count-in: a cubic from rest at the intro to the foot at speed v. */
function countInAt(s: number, from: number, to: number, slope: number): number {
  const s2 = s * s
  const s3 = s2 * s
  return (
    from * (2 * s3 - 3 * s2 + 1) + to * (3 * s2 - 2 * s3) + slope * (s3 - s2)
  )
}

export function createGlideScroll(
  path: GlidePath,
  countInSec: number,
  geometry: GlideScrollGeometry,
): GlideRunScroll {
  const { a, landingW, introCamera } = geometry
  const middle = (k: number): number => k * geometry.period
  const arches = path.arches
  const first = arches[0]
  const sung = first.end - first.start
  const v = (2 * a) / sung
  const gaps: ArchGap[] = []
  for (let k = 0; k + 1 < arches.length; k++) {
    const arch = arches[k]
    gaps.push(
      planArchGap(
        arch.end,
        arch.landingEnd,
        arches[k + 1].start,
        middle(k) + a,
        landingW,
        v,
      ),
    )
  }
  const last = arches[arches.length - 1]
  const settle = Math.max(1e-3, last.landingEnd - last.end)
  const finalX = middle(arches.length - 1) + a
  const restX = finalX + (v * settle) / 2
  const footX = middle(0) - a
  const lead = countInSec + first.start

  const at = (t: number): number => {
    if (t <= -countInSec) return introCamera
    if (t < first.start) {
      const s = (t + countInSec) / lead
      return countInAt(s, introCamera, footX, v * lead)
    }
    for (let k = 0; k < arches.length; k++) {
      const arch = arches[k]
      if (t <= arch.end) {
        return middle(k) - a + v * Math.max(0, t - arch.start)
      }
      const gap = gaps[k] as ArchGap | undefined
      if (gap !== undefined && t < gap.to) return archGapAt(gap, t)
    }
    const tau = Math.min(settle, t - last.end)
    return finalX + v * (tau - settle * eased(tau / settle))
  }

  // The count-in's dip below the foot: its lowest point, sampled.
  let min = Math.min(introCamera, footX)
  for (let i = 1; i < 64; i++) {
    min = Math.min(min, at(-countInSec + (i / 64) * lead))
  }
  return {
    at,
    camera: at,
    speed: v,
    min,
    max: restX,
    countIn: countInSec,
    lead,
  }
}
