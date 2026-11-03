// ============================================================
// Studio take passes — the frames of a capture a punch keeps, and where every pass of a loop take begins and ends
// ============================================================
//
// A take's first captured sample lands on song frame `heardFirst`
// (take-timing.ts), and every later one a frame after, on the run's count:
// with Repeat on a range, that count runs on through the passes
// (loop-range.ts). So pass p of a loop from `start` to `end` (L frames) is
// take frames start + p·L − heardFirst to that plus L, and its first sample
// lands on `start` again. Every pass is cut on those frames exactly, so no
// frame is lost between two passes and none is in both.
//
// A capture on a clock that is not 48 kHz is cut on the nearest of its own
// frames, and its import resamples each pass (take-audio.ts), so a pass can
// come out a frame short; its clip then ends a frame (21 µs) early.
import { STUDIO_MAX_CLIP_PASSES } from '../model/clip-passes'
import { STUDIO_SAMPLE_RATE } from '../model/types'
import type { StudioFrameRange } from '../playback/loop-range'

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

/** One pass of a loop take, in frames of the capture at its own rate. */
export interface StudioLoopPass {
  readonly firstFrame: number
  /** One past its last frame; a pass cut short ends past the capture, and is padded with silence. */
  readonly endFrame: number
  readonly complete: boolean
}

/**
 * The shortest last pass kept when the take stopped inside it: a second,
 * or half the range for a shorter one. A pass barely begun is let go.
 */
export function studioMinPartialPass(rangeFrames: number): number {
  return Math.min(STUDIO_SAMPLE_RATE, rangeFrames / 2)
}

/**
 * Every pass of `range` a capture of `captured` frames at `rate` holds,
 * oldest first: each complete one, and a last one cut short when it holds
 * at least studioMinPartialPass. At most the passes a clip keeps.
 */
export function studioLoopPasses(
  heardFirst: number,
  range: StudioFrameRange,
  captured: number,
  rate: number,
): StudioLoopPass[] {
  const length = range.endFrame - range.startFrame
  const at = (frame: number) => Math.round((frame * rate) / STUDIO_SAMPLE_RATE)
  const minPartial = at(studioMinPartialPass(length))
  const passes: StudioLoopPass[] = []
  for (let pass = 0; passes.length < STUDIO_MAX_CLIP_PASSES; pass++) {
    const first = range.startFrame + pass * length - heardFirst
    const firstFrame = at(first)
    const endFrame = at(first + length)
    if (firstFrame >= captured) break
    // A pass that began before the capture did is not whole: it is skipped.
    if (firstFrame < 0) continue
    const complete = endFrame <= captured
    if (!complete && captured - firstFrame < minPartial) break
    passes.push({ firstFrame, endFrame, complete })
    if (!complete) break
  }
  return passes
}

/** The pass a loop take's clip plays: its newest complete one, else the one there is. */
export function studioHeardPass(passes: readonly StudioLoopPass[]): number {
  for (let index = passes.length - 1; index >= 0; index--)
    if (passes[index].complete) return index
  return passes.length - 1
}

/** A pass's samples, the capture's own when complete, padded with silence when cut short. */
export function studioPassSamples<T extends Float32Array | Int16Array>(
  samples: T,
  pass: StudioLoopPass,
): T {
  const end = Math.min(pass.endFrame, samples.length)
  const own = samples.subarray(pass.firstFrame, end) as T
  if (end === pass.endFrame) return own
  const padded = new (samples.constructor as new (length: number) => T)(
    pass.endFrame - pass.firstFrame,
  )
  padded.set(own)
  return padded
}

/** A loop pass's name: "Take 3, pass 2", counted from 1. */
export function studioPassTitle(title: string, pass: number): string {
  return `${title}, pass ${pass + 1}`
}

/** A loop pass's audio id: the take's own, numbered, so its journal can tell it was stored. */
export function studioPassAssetId(takeId: string, pass: number): string {
  return `${takeId}-pass-${pass + 1}`
}

/** Whether `assetId` is the take's audio, or one of its passes'. */
export function isStudioTakeAsset(takeId: string, assetId: string): boolean {
  return assetId === takeId || assetId.startsWith(`${takeId}-pass-`)
}
