// ============================================================
// The bridge's scroll: where the camera is at each moment of a run
// ============================================================
//
// Time is the distance along the bridge (DESIGN-ng-slides.md 1): the
// playhead stays at PLAYHEAD_X of the screen and the bridge moves under
// it. The camera is the world X under the playhead, in W units; arch k's
// apex is at k * PERIOD_W (ng-geometry: X_k).
//
//   slide k     up, top and down: the camera moves at one constant speed,
//               the arch's span over the slide's time, so x is linear in
//               time wherever the voice is judged (N0 option B)
//   landing     the landing and the breath after it cover the landing's
//   + breath    stone (LANDING_W, the storyboard's width) in their time:
//               the scroll eases down from the slide speed, crawls, and
//               eases back up to it before the next slide starts
//   count-in    from the intro (screen 1: the first apex at INTRO_APEX_X)
//               at rest, to the first arch's foot at the slide speed. The
//               intro has the playhead a little inside the first ramp, so
//               the bridge rolls back a short way before it comes in
//   end         after the last slide, the scroll comes to rest over its
//               landing
//
// Pure arithmetic on the glide path's own times (src/lib/glide), so the
// arch under the playhead is always the arch the engine judges.

import type { GlidePath } from '@/lib/glide/glide-path'
import { ARCH, INTRO_APEX_X, LANDING_W, PERIOD_W, PLAYHEAD_X, } from './bridge-geometry'

/** Arch k's apex, world X (W): the first arch's apex is 0. */
export function apexX(k: number): number {
  return k * PERIOD_W
}

/** The camera on the intro: screen 1's first apex at INTRO_APEX_X. */
export const INTRO_CAMERA = PLAYHEAD_X - INTRO_APEX_X

/** At most this share of a landing and breath goes to each change of speed. */
const RAMP_SHARE = 0.16
/** The ramps leave the crawl at least this share of the landing to cover. */
const CRAWL_FLOOR = 0.2

/** The integral of smoothstep from 0 to x, x in [0, 1]. */
function eased(x: number): number {
  const s = x <= 0 ? 0 : x >= 1 ? 1 : x
  return s * s * s - (s * s * s * s) / 2
}

export interface BridgeScroll {
  /** The camera at time `t` on the path's clock (s; the count-in is t < 0). */
  at: (t: number) => number
  /** The camera's speed during every slide, W/s. */
  readonly slideSpeed: number
  /** The camera's lowest and highest X over the run. */
  readonly min: number
  readonly max: number
  /** The count-in, s: the run starts at t = -countIn. */
  readonly countIn: number
}

interface Gap {
  readonly from: number
  readonly to: number
  readonly x0: number
  readonly ramp: number
  readonly crawl: number
}

/** A landing and breath: from one arch's end to the next arch's start. */
function gapOf(from: number, to: number, x0: number, v: number): Gap {
  const span = to - from
  const ramp =
    Math.min(RAMP_SHARE, ((1 - CRAWL_FLOOR) * LANDING_W) / (v * span)) * span
  const crawl = (LANDING_W - ramp * v) / (span - ramp)
  return { from, to, x0, ramp, crawl }
}

/** Distance into a gap after `tau` seconds of it. */
function inGap(gap: Gap, v: number, tau: number): number {
  const { ramp: r, crawl: c } = gap
  const span = gap.to - gap.from
  if (tau <= r) return v * tau + (c - v) * r * eased(tau / r)
  const p1 = (r * (v + c)) / 2
  if (tau <= span - r) return p1 + c * (tau - r)
  const sigma = tau - (span - r)
  const p2 = p1 + c * (span - 2 * r)
  return p2 + c * sigma + (v - c) * r * eased(sigma / r)
}

/** The count-in: a cubic from rest at the intro to the foot at speed v. */
function countInAt(s: number, from: number, to: number, slope: number): number {
  const s2 = s * s
  const s3 = s2 * s
  return (
    from * (2 * s3 - 3 * s2 + 1) + to * (3 * s2 - 2 * s3) + slope * (s3 - s2)
  )
}

export function createBridgeScroll(
  path: GlidePath,
  countInSec: number,
): BridgeScroll {
  const arches = path.arches
  const first = arches[0]
  const sung = first.end - first.start
  const v = (2 * ARCH.a) / sung
  const gaps: Gap[] = []
  for (let k = 0; k + 1 < arches.length; k++) {
    gaps.push(gapOf(arches[k].end, arches[k + 1].start, apexX(k) + ARCH.a, v))
  }
  const last = arches[arches.length - 1]
  const settle = Math.max(1e-3, last.landingEnd - last.end)
  const finalX = apexX(arches.length - 1) + ARCH.a
  const restX = finalX + (v * settle) / 2
  const footX = apexX(0) - ARCH.a

  const at = (t: number): number => {
    if (t <= -countInSec) return INTRO_CAMERA
    if (t < first.start) {
      const s = (t + countInSec) / (countInSec + first.start)
      return countInAt(s, INTRO_CAMERA, footX, v * (countInSec + first.start))
    }
    for (let k = 0; k < arches.length; k++) {
      const arch = arches[k]
      if (t <= arch.end) {
        return apexX(k) - ARCH.a + v * Math.max(0, t - arch.start)
      }
      const gap = gaps[k] as Gap | undefined
      if (gap !== undefined && t < gap.to) {
        return gap.x0 + inGap(gap, v, t - gap.from)
      }
    }
    const tau = Math.min(settle, t - last.end)
    return finalX + v * (tau - settle * eased(tau / settle))
  }

  // The count-in's dip below the foot: its lowest point, sampled.
  let min = Math.min(INTRO_CAMERA, footX)
  for (let i = 1; i < 64; i++) {
    min = Math.min(min, at(-countInSec + (i / 64) * (countInSec + first.start)))
  }
  return { at, slideSpeed: v, min, max: restX, countIn: countInSec }
}
