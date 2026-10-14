// ============================================================
// The bay's scroll: where the camera is, and how close, at each moment
// ============================================================
//
// Time is the distance along the bay (DESIGN-lip-roll.md 1): the playhead
// stays at PLAYHEAD_X of the screen and the waves move under it. The
// camera is the world X under the playhead, in W units of wave B; wave
// k's crest is at k * PERIOD_W.
//
//   wave k      up, top and down: the camera moves at one constant speed,
//               the wave's span over its time, so x is linear in time
//               wherever the voice is judged (L0 5.2)
//   landing     the landing and the breath after it cover the landing
//   + breath    (LANDING_W) in their time: the scroll eases down from the
//               wave speed, crawls, and eases back up before the next wave
//   count-in    from the intro at rest to the first wave's foot at the
//               wave speed. The intro shows screen 1: the first crest at
//               INTRO.crestX, the world squeezed to wave A's size; the
//               count-in zooms in to wave B's (`zoom`, 0 to 1, eased, flat
//               at both ends) while it rolls the bay back a little and in
//   end         after the last wave, the scroll comes to rest over its
//               landing
//
// Ng slides' bridge-scroll.ts with the bay's period and the zoom. Pure
// arithmetic on the glide path's own times (src/lib/glide), so the wave
// under the playhead is always the wave the engine judges.

import type { GlidePath } from '@/lib/glide/glide-path'
import { INTRO, LANDING_W, PERIOD_W, PLAYHEAD_X, WAVE } from './bay-geometry'

/** Wave k's crest, world X (W): the first wave's crest is 0. */
export function crestX(k: number): number {
  return k * PERIOD_W
}

/** The camera on the intro: screen 1's first crest at INTRO.crestX. */
export const INTRO_CAMERA = -(INTRO.crestX - PLAYHEAD_X) / INTRO.sx

/** At most this share of a landing and breath goes to each change of speed. */
const RAMP_SHARE = 0.16
/** The ramps leave the crawl at least this share of the landing to cover. */
const CRAWL_FLOOR = 0.2

/** The integral of smoothstep from 0 to x, x in [0, 1]. */
function eased(x: number): number {
  const s = x <= 0 ? 0 : x >= 1 ? 1 : x
  return s * s * s - (s * s * s * s) / 2
}

const smoothstep = (x: number): number => {
  const s = x <= 0 ? 0 : x >= 1 ? 1 : x
  return s * s * (3 - 2 * s)
}

export interface BayScroll {
  /** The camera at time `t` on the path's clock (s; the count-in is t < 0). */
  at: (t: number) => number
  /** The zoom at `t`: 0 at the intro's (wave A), 1 from the first wave on. */
  zoom: (t: number) => number
  /** The camera's speed during every wave, W/s. */
  readonly waveSpeed: number
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

/** A landing and breath: from one wave's end to the next wave's start. */
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

export function createBayScroll(
  path: GlidePath,
  countInSec: number,
): BayScroll {
  const waves = path.arches
  const first = waves[0]
  const sung = first.end - first.start
  const v = (2 * WAVE.a) / sung
  const gaps: Gap[] = []
  for (let k = 0; k + 1 < waves.length; k++) {
    gaps.push(gapOf(waves[k].end, waves[k + 1].start, crestX(k) + WAVE.a, v))
  }
  const last = waves[waves.length - 1]
  const settle = Math.max(1e-3, last.landingEnd - last.end)
  const finalX = crestX(waves.length - 1) + WAVE.a
  const restX = finalX + (v * settle) / 2
  const footX = crestX(0) - WAVE.a
  const lead = countInSec + first.start

  const at = (t: number): number => {
    if (t <= -countInSec) return INTRO_CAMERA
    if (t < first.start) {
      const s = (t + countInSec) / lead
      return countInAt(s, INTRO_CAMERA, footX, v * lead)
    }
    for (let k = 0; k < waves.length; k++) {
      const wave = waves[k]
      if (t <= wave.end) {
        return crestX(k) - WAVE.a + v * Math.max(0, t - wave.start)
      }
      const gap = gaps[k] as Gap | undefined
      if (gap !== undefined && t < gap.to) {
        return gap.x0 + inGap(gap, v, t - gap.from)
      }
    }
    const tau = Math.min(settle, t - last.end)
    return finalX + v * (tau - settle * eased(tau / settle))
  }

  const zoom = (t: number): number =>
    lead <= 0 ? 1 : smoothstep((t + countInSec) / lead)

  // The count-in's dip below the foot: its lowest point, sampled.
  let min = Math.min(INTRO_CAMERA, footX)
  for (let i = 1; i < 64; i++) {
    min = Math.min(min, at(-countInSec + (i / 64) * lead))
  }
  return { at, zoom, waveSpeed: v, min, max: restX, countIn: countInSec }
}
