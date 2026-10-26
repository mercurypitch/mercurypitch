// Studio snapping — absolute integer-frame targets with a zoom-independent pointer tolerance.
import type { StudioClip } from '@/lib/studio/model/types'
import { STUDIO_SAMPLE_RATE } from '@/lib/studio/model/types'
import { clipEndFrame } from './timeline-geometry'

export const STUDIO_SNAP_PIXELS = 8

/** Beat intervals may be fractional: round absolute targets, never repeated steps. */
export function studioGridInterval(
  pixelsPerSecond: number,
  tempoBpm?: number,
): number {
  const desiredSeconds = 24 / Math.max(1, pixelsPerSecond)
  if (tempoBpm !== undefined) {
    const beatSeconds = 60 / tempoBpm
    return (
      beatSeconds *
      STUDIO_SAMPLE_RATE *
      Math.max(1 / 16, 2 ** Math.ceil(Math.log2(desiredSeconds / beatSeconds)))
    )
  }
  const power = 10 ** Math.floor(Math.log10(desiredSeconds))
  const unit =
    [1, 2, 5, 10].find((value) => value * power >= desiredSeconds) ?? 10
  return Math.max(1, Math.round(unit * power * STUDIO_SAMPLE_RATE))
}

export function studioGridFrame(
  index: number,
  pixelsPerSecond: number,
  tempoBpm?: number,
): number {
  return Math.round(index * studioGridInterval(pixelsPerSecond, tempoBpm))
}

interface SnapOptions {
  value: number
  offsets?: readonly number[]
  min: number
  max: number
  pixelsPerSecond: number
  tempoBpm?: number
  playheadFrame: number
  clips: readonly StudioClip[]
  excludeClipId: string
  enabled: boolean
}

export function snapStudioPosition(options: SnapOptions): {
  value: number
  target: number | null
} {
  const raw = Math.round(
    Math.max(options.min, Math.min(options.max, options.value)),
  )
  if (!options.enabled) return { value: raw, target: null }
  const tolerance =
    (STUDIO_SNAP_PIXELS / options.pixelsPerSecond) * STUDIO_SAMPLE_RATE
  const interval = studioGridInterval(options.pixelsPerSecond, options.tempoBpm)
  const anchors = [{ frame: options.playheadFrame, priority: 0 }]
  for (const clip of options.clips) {
    if (clip.id === options.excludeClipId) continue
    anchors.push(
      { frame: clip.startFrame, priority: 1 },
      { frame: clipEndFrame(clip), priority: 1 },
    )
  }
  const candidates: {
    value: number
    target: number
    distance: number
    priority: number
  }[] = []
  for (const offset of options.offsets ?? [0]) {
    const boundary = raw + offset
    const index = Math.floor(boundary / interval)
    const targets = [
      ...anchors,
      ...[index, index + 1].map((i) => ({
        frame: studioGridFrame(i, options.pixelsPerSecond, options.tempoBpm),
        priority: 2,
      })),
    ]
    for (const target of targets) {
      const value = target.frame - offset
      const distance = Math.abs(target.frame - boundary)
      if (distance <= tolerance && value >= options.min && value <= options.max)
        candidates.push({
          value,
          target: target.frame,
          distance,
          priority: target.priority,
        })
    }
  }
  candidates.sort(
    (a, b) =>
      a.distance - b.distance ||
      a.priority - b.priority ||
      a.target - b.target ||
      a.value - b.value,
  )
  if (candidates.length === 0) return { value: raw, target: null }
  const best = candidates[0]
  return { value: best.value, target: best.target }
}
