// Studio timeline geometry — bounded drawing coordinates share one integer-frame timebase.
import type { StudioClip } from '@/lib/studio/model/types'
import { STUDIO_SAMPLE_RATE } from '@/lib/studio/model/types'

export function clipEndFrame(clip: StudioClip): number {
  return clip.startFrame + clip.sourceOutFrame - clip.sourceInFrame
}

export function studioContentEnd(clips: readonly StudioClip[]): number {
  return clips.reduce((end, clip) => Math.max(end, clipEndFrame(clip)), 0)
}

export function studioPixelsPerSecond(value: number): number {
  return Number.isFinite(value) ? Math.max(1, Math.min(400, value)) : 20
}

export function frameToPixel(frame: number, pixelsPerSecond: number): number {
  return (frame / STUDIO_SAMPLE_RATE) * pixelsPerSecond
}

export function pixelToFrame(
  pixel: number,
  pixelsPerSecond: number,
  endFrame: number,
): number {
  if (
    !Number.isFinite(pixel) ||
    !Number.isFinite(pixelsPerSecond) ||
    pixelsPerSecond <= 0
  )
    return 0
  return Math.max(
    0,
    Math.min(
      endFrame,
      Math.round((pixel / pixelsPerSecond) * STUDIO_SAMPLE_RATE),
    ),
  )
}

export function formatStudioTime(frame: number): string {
  const milliseconds = Math.max(
    0,
    Math.round((frame / STUDIO_SAMPLE_RATE) * 1000),
  )
  const minutes = Math.floor(milliseconds / 60000)
  return `${minutes}:${String(Math.floor(milliseconds / 1000) % 60).padStart(2, '0')}.${String(milliseconds % 1000).padStart(3, '0')}`
}

export interface StudioRulerTick {
  frame: number
  pixel: number
  label: string
}

/** Generate only visible ticks; long empty ranges cannot allocate a huge tick array. */
export function studioRulerTicks(
  startPixel: number,
  width: number,
  pixelsPerSecond: number,
  endFrame: number,
  tempoBpm?: number,
): StudioRulerTick[] {
  const desiredSeconds = 80 / pixelsPerSecond
  const beatSeconds = tempoBpm === undefined ? null : 60 / tempoBpm
  const base = beatSeconds ?? 1
  const exponent = Math.pow(
    10,
    Math.floor(Math.log10(Math.max(desiredSeconds / base, 0.000001))),
  )
  const units =
    [1, 2, 5, 10].find((step) => step * exponent >= desiredSeconds / base) ?? 10
  const seconds =
    beatSeconds === null
      ? units * exponent
      : Math.max(
          1,
          Math.pow(2, Math.ceil(Math.log2(desiredSeconds / beatSeconds))),
        ) * beatSeconds
  const step = Math.max(1, Math.round(seconds * STUDIO_SAMPLE_RATE))
  const start = pixelToFrame(Math.max(0, startPixel), pixelsPerSecond, endFrame)
  const end = pixelToFrame(
    Math.max(0, startPixel + width),
    pixelsPerSecond,
    endFrame,
  )
  const ticks: StudioRulerTick[] = []
  for (
    let frame = Math.floor(start / step) * step;
    frame <= end && ticks.length < 100;
    frame += step
  ) {
    ticks.push({
      frame,
      pixel: frameToPixel(frame, pixelsPerSecond),
      label:
        beatSeconds === null
          ? formatStudioTime(frame).replace(/\.000$/, '')
          : `${Math.floor(frame / STUDIO_SAMPLE_RATE / beatSeconds / 4) + 1}.${(Math.floor(frame / STUDIO_SAMPLE_RATE / beatSeconds) % 4) + 1}`,
    })
  }
  return ticks
}
