// ============================================================
// The glide rooms' reveal: which strips of each arch are lit
// ============================================================
//
// The glide rooms (Ng slides' bridge, Lip roll's bay) draw an arch's lit
// picture over its unlit one through a mask of vertical strips, one strip
// per moment the voice was on the path, and light never drains. The
// strips are the engine's own coverage: each captured frame credits the
// arch the time between it and the frame before while the voice follows
// the path (glide-engine.ts creditArches, at most MAX_CREDIT_SEC a frame),
// and this credits the same stretch of the same arch as a strip. Inside a
// slide x is linear in time (bridge-scroll.ts), so the share of an arch's
// width that is lit is its coverage, exactly: what the singer sees lit is
// what the result counts.
//
// A strip is a range of u, the arch's own coordinate: -1 at its left foot,
// 0 at the apex, 1 at its right foot (u = (X - X_k) / a).
// The room paints new strips once a screen frame (`drain`), and the result
// paints every arch's strips once (`litOf`).

import type { GlidePath } from '@/lib/glide/glide-path'

/** The engine's cap on one frame's credit, s (glide-engine.ts). */
export const MAX_CREDIT_SEC = 0.1

/** A lit stretch of one arch, in its u. */
export interface LitStrip {
  readonly arch: number
  readonly from: number
  readonly to: number
}

export interface GlideReveal {
  /**
   * One frame heard: the time before it and its own (path clock), and
   * whether the engine found the voice following the path on it.
   */
  credit: (previous: number, t: number, following: boolean) => void
  /** The strips credited since the last drain, merged, oldest first. */
  drain: () => LitStrip[]
  /** Arch k's lit ranges, merged, left to right. */
  litOf: (arch: number) => readonly (readonly [number, number])[]
  /** Arch k's lit share of its width, 0..1: its coverage. */
  share: (arch: number) => number
}

/** Insert [from, to] into sorted, disjoint ranges, merging what touches. */
function insert(
  ranges: Array<[number, number]>,
  from: number,
  to: number,
): void {
  let lo = from
  let hi = to
  let i = 0
  while (i < ranges.length && ranges[i][1] < lo) i++
  let j = i
  while (j < ranges.length && ranges[j][0] <= hi) {
    lo = Math.min(lo, ranges[j][0])
    hi = Math.max(hi, ranges[j][1])
    j++
  }
  ranges.splice(i, j - i, [lo, hi])
}

export function createGlideReveal(path: GlidePath): GlideReveal {
  const lit: Array<Array<[number, number]>> = path.arches.map(() => [])
  let pending: LitStrip[] = []

  const uOf = (arch: number, t: number): number => {
    const a = path.arches[arch]
    return -1 + (2 * (t - a.start)) / (a.end - a.start)
  }

  return {
    credit: (previous, t, following) => {
      if (!following || t <= previous) return
      for (const arch of path.arches) {
        const from = Math.max(previous, arch.start)
        const to = Math.min(t, arch.end)
        if (to <= from) continue
        // The engine credits at most MAX_CREDIT_SEC a frame: the latest
        // stretch of it, so the lit width is exactly the credited time.
        const start = Math.max(from, to - MAX_CREDIT_SEC)
        const u0 = uOf(arch.index, start)
        const u1 = uOf(arch.index, to)
        insert(lit[arch.index], u0, u1)
        const last = pending.at(-1)
        if (last !== undefined && last.arch === arch.index && last.to >= u0) {
          pending[pending.length - 1] = {
            arch: arch.index,
            from: Math.min(last.from, u0),
            to: Math.max(last.to, u1),
          }
        } else {
          pending.push({ arch: arch.index, from: u0, to: u1 })
        }
      }
    },
    drain: () => {
      const out = pending
      pending = []
      return out
    },
    litOf: (arch) => lit[arch] ?? [],
    share: (arch) => {
      let sum = 0
      for (const [from, to] of lit[arch] ?? []) sum += to - from
      return Math.min(1, sum / 2)
    },
  }
}

/** A whole arch's ranges from its coverage alone: lit from its left foot. */
export function litFromLeft(coverage: number): [number, number][] {
  const share = Math.max(0, Math.min(1, coverage))
  return share <= 0 ? [] : [[-1, -1 + 2 * share]]
}
