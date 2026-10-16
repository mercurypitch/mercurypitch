// ============================================================
// The glide rooms between two arches: the world stops, then rolls on
// ============================================================
//
// Ng slides' bridge and Lip roll's bay move the world under the playhead
// at one speed through each arch's sung part (bridge-scroll.ts,
// bay-scroll.ts). Between two arches the world covers the landing's width
// in the landing and the rest after it, the same way in both rooms. The
// owner asked for it on 15 Oct 2026: stop Merc, wait a second or so, then
// play the next note.
//
//   landing   the world slows from the arch's speed to a stand (its speed
//             a smoothstep down), while the singer lands on the root
//   still     it stands: the pause, the next root's tone where the level
//             plays one, and the start of the rest after it
//   go        it eases back up to the arch's speed and brings the next
//             arch's foot to the playhead as that arch starts
//
// The slowing covers v * landing / 2 of the width, so the go takes
// 2 * width / v - landing. A rest too short for a stand keeps the old
// crawl: it eases down, crawls, and eases back up.

/** At most this share of a crawl's time goes to each change of speed. */
const RAMP_SHARE = 0.16
/** The ramps leave the crawl at least this share of the width to cover. */
const CRAWL_FLOOR = 0.2

/** The integral of smoothstep from 0 to x, x in [0, 1]. */
export function easedDistance(x: number): number {
  const s = x <= 0 ? 0 : x >= 1 ? 1 : x
  return s * s * s - (s * s * s * s) / 2
}

/** From one arch's end to the next arch's start, s on the path's clock. */
export interface ArchGap {
  /** The arch's sung part ends: the gap starts. */
  readonly from: number
  /** The next arch starts: the gap ends. */
  readonly to: number
  /** World X at `from`. */
  readonly x0: number
  /** The arch's speed, W/s. */
  readonly v: number
  /**
   * The world stands from `still` to `go`, s; null when the rest is too
   * short for a stand and the world crawls instead.
   */
  readonly stand: { readonly still: number; readonly go: number } | null
  /** The crawl's ramps and speed (no stand only). */
  readonly ramp: number
  readonly crawl: number
}

/**
 * The gap after an arch that ends at `from` and lands until `landingEnd`,
 * before the next arch starts at `to`: `width` to cover at speed `v`.
 */
export function planArchGap(
  from: number,
  landingEnd: number,
  to: number,
  x0: number,
  width: number,
  v: number,
): ArchGap {
  const span = to - from
  const landing = landingEnd - from
  const go = (2 * width) / v - landing
  if (landing > 1e-6 && go > 1e-6 && landing + go < span - 1e-6) {
    return {
      from,
      to,
      x0,
      v,
      stand: { still: landingEnd, go: to - go },
      ramp: 0,
      crawl: 0,
    }
  }
  const ramp =
    Math.min(RAMP_SHARE, ((1 - CRAWL_FLOOR) * width) / (v * span)) * span
  const crawl = (width - ramp * v) / (span - ramp)
  return { from, to, x0, v, stand: null, ramp, crawl }
}

/** World X at `t` inside the gap (from <= t <= to). */
export function archGapAt(gap: ArchGap, t: number): number {
  const tau = Math.min(gap.to - gap.from, Math.max(0, t - gap.from))
  return gap.x0 + (gap.stand === null ? crawled(gap, tau) : stood(gap, tau))
}

/** Slows over the landing, stands, and eases back up for the next arch. */
function stood(gap: ArchGap, tau: number): number {
  const { v } = gap
  const stand = gap.stand as NonNullable<ArchGap['stand']>
  const landing = stand.still - gap.from
  if (tau <= landing)
    return v * tau - v * landing * easedDistance(tau / landing)
  const slowed = (v * landing) / 2
  const goFrom = stand.go - gap.from
  if (tau <= goFrom) return slowed
  const go = gap.to - stand.go
  return slowed + v * go * easedDistance((tau - goFrom) / go)
}

/** The old crawl: eases down from v, crawls, eases back up to v. */
function crawled(gap: ArchGap, tau: number): number {
  const { v, ramp: r, crawl: c } = gap
  const span = gap.to - gap.from
  if (tau <= r) return v * tau + (c - v) * r * easedDistance(tau / r)
  const p1 = (r * (v + c)) / 2
  if (tau <= span - r) return p1 + c * (tau - r)
  const sigma = tau - (span - r)
  const p2 = p1 + c * (span - 2 * r)
  return p2 + c * sigma + (v - c) * r * easedDistance(sigma / r)
}
