// ============================================================
// Snap to Features — Magnetic snapping to annotation/beat boundaries
// ============================================================

import type { OnsetResult } from '@/types'

/** Time-positioned feature used for snapping. */
export interface SnapPoint {
  time: number
  label?: string
  priority: number // higher = stronger magnet
}

/** Merge source types for snap-to convenience. */
export interface SnapSources {
  /** Annotations with time (id + time + optional label). */
  annotations?: Array<{
    id: string
    time: number
    label?: string
    endTime?: number
  }>
  /** Beat/onset results from onset detector. */
  onsets?: OnsetResult[]
  /** Additional custom snap points. */
  custom?: SnapPoint[]
}

/**
 * Build a snap-point list from annotation, onset, and custom sources.
 */
export function buildSnapPoints(sources: SnapSources): SnapPoint[] {
  const points: SnapPoint[] = []

  for (const a of sources.annotations ?? []) {
    points.push({ time: a.time, label: a.label, priority: 3 })
    if (a.endTime !== undefined) {
      points.push({
        time: a.endTime,
        label: `${a.label ?? ''} end`,
        priority: 3,
      })
    }
  }

  for (const o of sources.onsets ?? []) {
    const label = o.isBeat ? `Beat ${o.beatPosition ?? '?'}` : 'Onset'
    points.push({
      time: o.time,
      label,
      priority: o.isBeat ? 2 : 1,
    })
  }

  for (const c of sources.custom ?? []) {
    points.push(c)
  }

  return points.sort((a, b) => a.time - b.time)
}

/**
 * Find the nearest snap point within `threshold` seconds of the target time.
 * Returns the snapped time, or the original time if nothing is close enough.
 */
export function snapToNearest(
  targetTime: number,
  snapPoints: SnapPoint[],
  threshold: number = 0.05, // 50ms default
): { time: number; snapped: boolean; label?: string } {
  let best: SnapPoint | null = null
  let bestDist = threshold

  for (const p of snapPoints) {
    const dist = Math.abs(p.time - targetTime)
    if (dist < bestDist) {
      bestDist = dist
      best = p
    } else if (
      dist === bestDist &&
      best !== null &&
      p.priority > best.priority
    ) {
      // Same distance, pick higher priority
      best = p
    }
  }

  if (best !== null) {
    return { time: best.time, snapped: true, label: best.label }
  }
  return { time: targetTime, snapped: false }
}
