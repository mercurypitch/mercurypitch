// ============================================================
// Studio clip passes — a loop take keeps every pass as its own audio, and its clip plays one of them
// ============================================================
//
// Recording over a range with Repeat on sings the same stretch again and
// again. Each pass becomes an asset of exactly the range's length, and one
// clip on the lane plays the newest whole pass, with the others listed in
// `passes` (types.ts), oldest first. Choosing another pass is one undoable
// edit that swaps the clip's asset ('choose-pass', commands.ts): the clip's
// place, trim, fades and gain stay as they are, since every pass covers the
// same source frames.
//
// That is the shape comping needs as well: a comp would be several clips
// over the range, each a stretch of one pass, which the same list names.
// Every place that keeps or copies a song's audio asks studioClipAssetIds,
// so a pass not heard is never pruned, dropped from a backup or left behind
// when a song is copied.
import type { StudioClip } from './types'

/** The most passes one loop take keeps; recording stops after the last. */
export const STUDIO_MAX_CLIP_PASSES = 32

/** Every asset a clip keeps: the one it plays, and a loop take's other passes. */
export function studioClipAssetIds(clip: StudioClip): readonly string[] {
  return clip.passes ?? [clip.assetId]
}

/** Every asset a song's clips keep, once each. */
export function studioSongAssetIds(clips: readonly StudioClip[]): Set<string> {
  return new Set(clips.flatMap((clip) => studioClipAssetIds(clip)))
}

/** Which pass a loop take's clip plays, counted from 1, of how many; null for any other clip. */
export function studioClipPass(
  clip: StudioClip,
): { readonly number: number; readonly count: number } | null {
  if (!clip.passes) return null
  return {
    number: clip.passes.indexOf(clip.assetId) + 1,
    count: clip.passes.length,
  }
}
