// ============================================================
// Studio take passes — the clip a finished take makes: a plain take from the frame heard, a punch its range, a loop its whole passes
// ============================================================
//
// A take's first captured sample lands on song frame `heardFirst`
// (take-timing.ts), and every later one a frame after, on the run's count:
// with Repeat on a range, that count runs on through the passes
// (loop-range.ts). So pass p of a loop from `start` to `end` (L frames) is
// take frames start + p·L − heardFirst to that plus L, and its first sample
// lands on `start` again. The take is kept whole as one audio, and its
// passes are windows into it (clip-passes.ts) that meet frame to frame:
// none is lost between two passes, and none is in both.
//
// Frames here are the take's at 48 kHz, as its import stores it. A capture
// on another clock is resampled by the import, which can leave it a frame
// short of this count; the import keeps only the passes the audio holds
// whole (studioFitPasses).
import { STUDIO_MAX_CLIP_PASSES } from '../model/clip-passes'
import type { StudioClipPasses } from '../model/types'
import { STUDIO_SAMPLE_RATE } from '../model/types'
import type { StudioFrameRange } from '../playback/loop-range'
import type { StudioTakeCut } from './take-plan'
import { placeHeardTake } from './take-timing'

/** The fades at a punch's edges, 5 ms: no click, and the first consonant kept. */
export const STUDIO_PUNCH_FADE_FRAMES = 240

/** The shortest punch kept: a tenth of a second. */
const MIN_PUNCH_FRAMES = STUDIO_SAMPLE_RATE / 10

/** A punch's clip, in 48 kHz frames of the song and of the take. */
export interface StudioPunchCut {
  readonly startFrame: number
  readonly sourceInFrame: number
  readonly sourceOutFrame: number
  /** The fade at each edge. */
  readonly fadeFrames: number
}

/**
 * The take frames of `frames` (48 kHz) whose song frames fall in `range`,
 * for a take whose first sample lands on `heardFirst`. Null when the
 * capture ends before it holds a tenth of a second of the range.
 */
export function studioPunchCut(
  heardFirst: number,
  range: StudioFrameRange,
  frames: number,
): StudioPunchCut | null {
  if (!Number.isSafeInteger(heardFirst) || !Number.isSafeInteger(frames))
    return null
  const startFrame = Math.max(0, range.startFrame, heardFirst)
  const endFrame = Math.min(range.endFrame, heardFirst + frames)
  if (endFrame - startFrame < MIN_PUNCH_FRAMES) return null
  const kept = endFrame - startFrame
  return {
    startFrame,
    sourceInFrame: startFrame - heardFirst,
    sourceOutFrame: endFrame - heardFirst,
    fadeFrames: Math.min(STUDIO_PUNCH_FADE_FRAMES, Math.floor(kept / 2)),
  }
}

/**
 * The shortest stretch of its first pass a loop take with no whole pass
 * keeps: a second, or half the range for a shorter one. A pass barely
 * begun is let go.
 */
export function studioMinPartialPass(rangeFrames: number): number {
  return Math.min(STUDIO_SAMPLE_RATE, rangeFrames / 2)
}

/** The clip a finished take makes, in 48 kHz frames of the song and of the take. */
export interface StudioTakeClip {
  readonly startFrame: number
  readonly sourceInFrame: number
  /** Where the clip ends in the take; absent, at the take's end. */
  readonly sourceOutFrame?: number
  /** Fades this long at both edges: a punch's. */
  readonly fadeFrames?: number
  /** A loop take's whole passes, two or more, the clip playing the newest. */
  readonly passes?: StudioClipPasses
}

/**
 * A loop take's clip over `range`, its capture `frames` long: its whole
 * passes, at most the passes a clip keeps, playing the newest. A pass that
 * began before the capture did, or that the take stopped inside, is not
 * whole. With one whole pass the clip plays it; with none, what was sung
 * from the range's start, so a range longer than a take can be keeps an
 * ordinary take. Null when that is shorter than studioMinPartialPass.
 */
export function studioLoopCut(
  heardFirst: number,
  range: StudioFrameRange,
  frames: number,
): StudioTakeClip | null {
  const length = range.endFrame - range.startFrame
  if (
    !Number.isSafeInteger(heardFirst) ||
    !Number.isSafeInteger(frames) ||
    !(length > 0)
  )
    return null
  // The first pass whose first frame the capture holds.
  const skipped = Math.max(
    0,
    Math.ceil((heardFirst - range.startFrame) / length),
  )
  const firstFrame = range.startFrame + skipped * length - heardFirst
  const whole = Math.min(
    STUDIO_MAX_CLIP_PASSES,
    Math.max(0, Math.floor((frames - firstFrame) / length)),
  )
  if (whole === 0) {
    if (frames - firstFrame < studioMinPartialPass(length)) return null
    return { startFrame: range.startFrame, sourceInFrame: firstFrame }
  }
  const sourceInFrame = firstFrame + (whole - 1) * length
  return {
    startFrame: range.startFrame,
    sourceInFrame,
    sourceOutFrame: sourceInFrame + length,
    ...(whole >= 2 && { passes: { firstFrame, frames: length, count: whole } }),
  }
}

/**
 * The clip a finished take makes, its capture `frames` long at 48 kHz: a
 * plain take from the frame the singer heard (take-timing.ts), a punch its
 * range, a loop its passes. Null when nothing of it reaches the song.
 */
export function studioTakeClip(
  take: {
    readonly heardFirst: number
    readonly fromFrame: number | null
    readonly cut?: StudioTakeCut | null
  },
  frames: number,
): StudioTakeClip | null {
  const cut = take.cut ?? null
  if (cut?.mode === 'loop')
    return studioLoopCut(take.heardFirst, cut.range, frames)
  if (cut?.mode === 'punch')
    return studioPunchCut(take.heardFirst, cut.range, frames)
  const placed = placeHeardTake(take.heardFirst, take.fromFrame, frames)
  return (
    placed && {
      startFrame: placed.startFrame,
      sourceInFrame: placed.sourceInFrame,
    }
  )
}

/** A loop pass's name: "Take 3, pass 2", counted from 1. */
export function studioPassTitle(title: string, pass: number): string {
  return `${title}, pass ${pass + 1}`
}
