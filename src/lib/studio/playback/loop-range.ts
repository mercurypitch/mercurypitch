// ============================================================
// Studio loop range — a stretch of the song that Repeat plays over and over, and where a looping run's frames fall in it
// ============================================================
//
// With no range, Repeat loops the whole song from its start, and a run's
// plan starts at frame 0 and ends with the song. With a range on the ruler,
// Repeat loops the range instead: the run's plan starts at the range's
// first frame and ends at its last, whatever the song's length, so a clip
// edit while it plays keeps the loop where it is (lane-replan.ts).
//
// A run's timeline counts on through its passes: frame `startFrame` is
// heard at `audibleEpoch` and every later frame 1/48000 s after, pass after
// pass. Pass p of a loop from `start` to `end` is frames start + p·L to
// start + (p+1)·L of that count (L = end − start), and plays song frames
// start to end. With the whole song (start 0) that is the familiar
// `frame % end`.
import { STUDIO_SAMPLE_RATE } from '../model/types'

/** A stretch of the song, in whole 48 kHz frames: start included, end not. */
export interface StudioFrameRange {
  readonly startFrame: number
  readonly endFrame: number
}

/** The shortest stretch that can loop: a quarter second, as the song's own loop (graph-passes.ts). */
export const STUDIO_MIN_LOOP_FRAMES = STUDIO_SAMPLE_RATE / 4

/** Whether `range` is whole frames from 0 on, at least the shortest loop long. */
export function isStudioLoopRange(
  range: StudioFrameRange | null | undefined,
): range is StudioFrameRange {
  return (
    range !== null &&
    range !== undefined &&
    Number.isSafeInteger(range.startFrame) &&
    Number.isSafeInteger(range.endFrame) &&
    range.startFrame >= 0 &&
    range.endFrame - range.startFrame >= STUDIO_MIN_LOOP_FRAMES
  )
}

/**
 * The song frame a plan from `start` to `end` plays at frame `frame` of a
 * run's count: frames before the end as they are, later ones wrapped into
 * the loop. Fractional frames stay fractional.
 */
export function wrapLoopFrame(
  frame: number,
  start: number,
  end: number,
): number {
  if (frame < end) return frame
  return start + ((frame - start) % (end - start))
}

/** Where pass `pass` of a loop from `start` to `end` ends, on a run's count. */
export function loopPassEnd(start: number, end: number, pass: number): number {
  return end + pass * (end - start)
}

/** What a run's plan is laid out for: the range it repeats, or none for the song. */
export interface StudioLoopLayout {
  /** Its plan's first frame. */
  readonly firstFrame: number
  /** The end its plan keeps through edits: a range's, or null for the song's own end. */
  readonly fixedEnd: number | null
}

/**
 * Whether a run laid out as `run` plays the loop wanted now: a range plan
 * for that same range, or a song plan when no range repeats.
 */
export function playsLoop(
  run: StudioLoopLayout,
  wanted: StudioFrameRange | null,
): boolean {
  if (wanted === null) return run.fixedEnd === null
  return (
    run.fixedEnd === wanted.endFrame && run.firstFrame === wanted.startFrame
  )
}

/** Where a Play with Repeat on a range starts: the frame if the range holds it, else the range's start. */
export function startInLoop(frame: number, range: StudioFrameRange): number {
  return frame >= range.startFrame && frame < range.endFrame
    ? Math.floor(frame)
    : range.startFrame
}

/**
 * Where a seek to `frame` lands, and the end the song stops at for it:
 * inside the range Repeat plays, as Play starts, or on the song, never past
 * its end.
 */
export function seekInLoop(
  frame: number,
  range: StudioFrameRange | null,
  songEnd: () => number,
): { readonly target: number; readonly end: number } {
  if (range) return { target: startInLoop(frame, range), end: range.endFrame }
  const end = songEnd()
  return { target: Math.min(frame, end), end }
}
