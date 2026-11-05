// ============================================================
// Studio clip passes — a loop take keeps its whole capture as one audio, and its clip plays one pass of it
// ============================================================
//
// Recording over a range with Repeat on sings the same stretch again and
// again. The take is stored once, as captured, and `passes` (types.ts) marks
// where its whole passes lie in it: `count` windows of the range's length,
// back to back from `firstFrame`. The clip plays the window its source
// frames sit in, the newest whole pass when the take lands. Choosing another
// pass is one undoable edit that moves the clip's source frames, and its
// fades with them, by whole passes ('choose-pass', commands.ts): its place,
// trim, fades and gain stay as they were over the range.
//
// A pass the take stopped inside is no window: it would run past what was
// captured, and padding it would store silence. Its audio stays in the
// file, and a take with no whole pass keeps what was sung as an ordinary
// clip (take-passes.ts).
//
// That is the shape comping needs as well: a split leaves both halves the
// same windows (commands.ts), so each stretch of the range can play a pass
// of its own. A clip stays inside its pass, so its trims stop at the pass's
// edges (studioClipSourceBounds) and every pass it can move to holds it.
import type { StudioClip, StudioClipPasses } from './types'

/** The most passes one loop take keeps; recording stops after the last. */
export const STUDIO_MAX_CLIP_PASSES = 32

/** The source frames of pass `index`, counted from 0. */
export function studioPassWindow(
  passes: StudioClipPasses,
  index: number,
): { readonly first: number; readonly end: number } {
  const first = passes.firstFrame + index * passes.frames
  return { first, end: first + passes.frames }
}

/** The pass a source frame sits in, counted from 0; it may lie outside the take's passes. */
export function studioPassAt(passes: StudioClipPasses, sourceFrame: number) {
  return Math.floor((sourceFrame - passes.firstFrame) / passes.frames)
}

/** Which pass a loop take's clip plays, counted from 1, of how many; null for any other clip. */
export function studioClipPass(
  clip: StudioClip,
): { readonly number: number; readonly count: number } | null {
  if (!clip.passes) return null
  return {
    number: studioPassAt(clip.passes, clip.sourceInFrame) + 1,
    count: clip.passes.count,
  }
}

/** The source frames a clip's trims can reach: its pass's for a loop take, else all its audio's. */
export function studioClipSourceBounds(
  clip: StudioClip,
  audioFrames: number,
): { readonly first: number; readonly end: number } {
  if (!clip.passes) return { first: 0, end: audioFrames }
  return studioPassWindow(
    clip.passes,
    studioPassAt(clip.passes, clip.sourceInFrame),
  )
}

/** The clip playing pass `index` whole instead: its source frames and fades moved by whole passes, any comp let go (clip-comp.ts). */
export function studioClipOnPass(clip: StudioClip, index: number): StudioClip {
  if (!clip.passes) return clip
  const { comp: _comp, ...whole } = clip
  const shift =
    (index - studioPassAt(clip.passes, clip.sourceInFrame)) * clip.passes.frames
  const move = (ramp: { fromSourceFrame: number; toSourceFrame: number }) => ({
    fromSourceFrame: ramp.fromSourceFrame + shift,
    toSourceFrame: ramp.toSourceFrame + shift,
  })
  return {
    ...whole,
    sourceInFrame: clip.sourceInFrame + shift,
    sourceOutFrame: clip.sourceOutFrame + shift,
    fades: {
      curve: clip.fades.curve,
      ...(clip.fades.in && { in: move(clip.fades.in) }),
      ...(clip.fades.out && { out: move(clip.fades.out) }),
    },
  }
}

/**
 * A loop take's clip as its decoded audio allows: only the passes whose
 * every frame the audio holds (a capture not at 48 kHz can come out a frame
 * short), playing the newest of them when the pass meant is gone. Fewer
 * than two leave an ordinary clip over the one pass, or over what there is.
 */
export function studioFitPasses(
  source: { readonly sourceInFrame: number },
  passes: StudioClipPasses,
  audioFrames: number,
): {
  sourceInFrame: number
  sourceOutFrame: number
  passes?: StudioClipPasses
} {
  const whole = Math.min(
    passes.count,
    Math.max(0, Math.floor((audioFrames - passes.firstFrame) / passes.frames)),
  )
  if (whole === 0)
    return {
      sourceInFrame: passes.firstFrame,
      sourceOutFrame: Math.min(passes.firstFrame + passes.frames, audioFrames),
    }
  const fitted = { ...passes, count: whole }
  const heard = Math.min(studioPassAt(passes, source.sourceInFrame), whole - 1)
  const window = studioPassWindow(fitted, heard)
  return {
    sourceInFrame: window.first,
    sourceOutFrame: window.end,
    ...(whole >= 2 && { passes: fitted }),
  }
}
