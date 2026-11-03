// ============================================================
// Studio take import — a finished take as the import keeps it: its whole capture as one file, its clip trimmed to the frame heard, a punch's range or a loop's newest whole pass
// ============================================================
//
// The recorder hands over the whole capture and what it was for
// (take-plan.ts). Every take keeps the whole capture as its file, so its
// clip can still be opened out later. A plain take's clip starts on the
// frame the singer heard (take-timing.ts); a punch's is trimmed to the
// range, with short fades at both edges, and replaces what its lane plays
// there (punch-commands.ts); a loop take's plays its newest whole pass, the
// others windows of the same file it can move to (take-passes.ts,
// clip-passes.ts).
import { STUDIO_SAMPLE_RATE } from '@/lib/studio/model/types'
import type { StudioCapturedTake } from '@/lib/studio/record/recorder-types'
import { studioTakeWav } from '@/lib/studio/record/take-audio'
import { studioTakeClip } from '@/lib/studio/record/take-passes'
import type { StudioRecordingImport } from '../controller/imports'

/** A capture's length in the 48 kHz frames its import stores, give or take a frame of resampling. */
export function studioTakeFrames(take: {
  readonly frames: number
  readonly sampleRate: number
}): number {
  return Math.round((take.frames * STUDIO_SAMPLE_RATE) / take.sampleRate)
}

/** How a finished take is kept; null when nothing of it reaches the song. */
export function studioTakeImport(
  take: StudioCapturedTake,
): StudioRecordingImport | null {
  const frames = studioTakeFrames({
    frames: take.samples.length,
    sampleRate: take.sampleRate,
  })
  const clip = studioTakeClip(take, frames)
  if (clip === null) return null
  return {
    wav: studioTakeWav(take.samples, take.sampleRate),
    title: take.title,
    trackId: take.trackId,
    assetId: take.id,
    ...clip,
    // A punch replaces what its lane plays under it, as tape does.
    ...(take.cut?.mode === 'punch' && { punch: true }),
  }
}
