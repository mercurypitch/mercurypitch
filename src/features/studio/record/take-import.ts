// ============================================================
// Studio take import — a finished take as the import keeps it: a plain take trimmed to the frame heard, a punch to its range, a loop as its passes
// ============================================================
//
// The recorder hands over the whole capture and what it was for
// (take-plan.ts). A plain take keeps everything from the frame the singer
// heard on (take-timing.ts). A punch keeps the whole capture as its file
// and trims its clip to the range, with short fades at both edges, so the
// clip can still be opened out later. A loop take becomes one file per
// pass, each exactly the range long (take-passes.ts), on one clip that
// plays the newest whole pass (clip-passes.ts).
import { STUDIO_SAMPLE_RATE } from '@/lib/studio/model/types'
import type { StudioCapturedTake } from '@/lib/studio/record/recorder-types'
import { studioTakeWav } from '@/lib/studio/record/take-audio'
import { studioHeardPass, studioLoopPasses, studioPassAssetId, studioPassSamples, studioPassTitle, studioPunchCut, } from '@/lib/studio/record/take-passes'
import { placeHeardTake } from '@/lib/studio/record/take-timing'
import type { StudioPassesImport, StudioRecordingImport, } from '../controller/imports'

/** How a finished take is kept; null when nothing of it reaches the song. */
export function studioTakeImport(
  take: StudioCapturedTake,
): StudioRecordingImport | StudioPassesImport | null {
  const frames = Math.round(
    (take.samples.length * STUDIO_SAMPLE_RATE) / take.sampleRate,
  )
  const cut = take.cut ?? null
  if (cut?.mode === 'loop') return passesImport(take, cut.range)
  if (cut?.mode === 'punch') {
    const punch = studioPunchCut(take.heardFirst, cut.range, frames)
    if (punch === null) return null
    return {
      wav: studioTakeWav(take.samples, take.sampleRate),
      title: take.title,
      startFrame: punch.startFrame,
      sourceInFrame: punch.sourceInFrame,
      sourceOutFrame: punch.sourceOutFrame,
      fadeFrames: punch.fadeFrames,
      trackId: take.trackId,
      assetId: take.id,
    }
  }
  const placement = placeHeardTake(take.heardFirst, take.fromFrame, frames)
  if (placement === null) return null
  return {
    wav: studioTakeWav(take.samples, take.sampleRate),
    title: take.title,
    startFrame: placement.startFrame,
    sourceInFrame: placement.sourceInFrame,
    trackId: take.trackId,
    assetId: take.id,
  }
}

function passesImport(
  take: StudioCapturedTake,
  range: { readonly startFrame: number; readonly endFrame: number },
): StudioRecordingImport | StudioPassesImport | null {
  const passes = studioLoopPasses(
    take.heardFirst,
    range,
    take.samples.length,
    take.sampleRate,
  )
  if (passes.length === 0) return null
  return {
    title: take.title,
    passes: passes.map((pass, index) => ({
      wav: studioTakeWav(
        studioPassSamples(take.samples, pass),
        take.sampleRate,
      ),
      title: studioPassTitle(take.title, index),
      assetId: studioPassAssetId(take.id, index),
    })),
    heard: studioHeardPass(passes),
    startFrame: range.startFrame,
    frames: range.endFrame - range.startFrame,
    trackId: take.trackId,
  }
}
