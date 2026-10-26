// Studio gesture drafts — pure move, trim and source-fade previews without project writes.
import type { StudioCommand } from '@/lib/studio/model/commands'
import type { StudioAsset, StudioClip, StudioProject, } from '@/lib/studio/model/types'
import { clipEndFrame } from './timeline-geometry'
import { snapStudioPosition } from './timeline-snap'

export const STUDIO_NEW_LANE = '__studio-new-lane__'
export type StudioGestureKind =
  | 'move'
  | 'trim-head'
  | 'trim-tail'
  | 'fade-in'
  | 'fade-out'
export interface StudioGestureDraft {
  clip: StudioClip
  kind: StudioGestureKind
  targetTrackId: string
  snapFrame: number | null
  valid: boolean
  message: string
}
export interface StudioGestureInput {
  project: StudioProject
  clip: StudioClip
  asset?: StudioAsset
  kind: StudioGestureKind
  deltaFrames: number
  targetTrackId: string
  pixelsPerSecond: number
  playheadFrame: number
  snap: boolean
}

type SnapPosition = (
  value: number,
  min: number,
  max: number,
  offsets?: readonly number[],
) => ReturnType<typeof snapStudioPosition>

function draftFade(
  input: StudioGestureInput,
  snap: SnapPosition,
): Pick<StudioGestureDraft, 'clip' | 'snapFrame'> {
  const clip = input.clip
  const fadeIn = input.kind === 'fade-in'
  const anchor = fadeIn
    ? (clip.fades.in?.fromSourceFrame ?? clip.sourceInFrame)
    : (clip.fades.out?.toSourceFrame ?? clip.sourceOutFrame)
  const existing = fadeIn
    ? (clip.fades.in?.toSourceFrame ?? clip.sourceInFrame)
    : (clip.fades.out?.fromSourceFrame ?? clip.sourceOutFrame)
  const visible = Math.max(
    clip.sourceInFrame,
    Math.min(clip.sourceOutFrame, existing),
  )
  const lower = fadeIn
    ? clip.sourceInFrame
    : Math.max(
        clip.sourceInFrame,
        clip.fades.in?.toSourceFrame ?? clip.sourceInFrame,
      )
  const upper = fadeIn
    ? Math.min(
        clip.sourceOutFrame,
        clip.fades.out?.fromSourceFrame ?? clip.sourceOutFrame,
      )
    : clip.sourceOutFrame
  if (lower > upper) return { clip, snapFrame: null }
  const position = snap(
    clip.startFrame + visible - clip.sourceInFrame + input.deltaFrames,
    clip.startFrame + lower - clip.sourceInFrame,
    clip.startFrame + upper - clip.sourceInFrame,
  )
  const source = clip.sourceInFrame + position.value - clip.startFrame
  const fades = { ...clip.fades }
  if (fadeIn) {
    if (source <= anchor) delete fades.in
    else fades.in = { fromSourceFrame: anchor, toSourceFrame: source }
  } else if (source >= anchor) delete fades.out
  else fades.out = { fromSourceFrame: source, toSourceFrame: anchor }
  return { clip: { ...clip, fades }, snapFrame: position.target }
}

export function draftStudioGesture(
  input: StudioGestureInput,
): StudioGestureDraft {
  const clip = input.clip
  const duration = clip.sourceOutFrame - clip.sourceInFrame
  const snap = (
    value: number,
    min: number,
    max: number,
    offsets?: readonly number[],
  ) =>
    snapStudioPosition({
      value,
      min,
      max,
      offsets,
      pixelsPerSecond: input.pixelsPerSecond,
      tempoBpm:
        input.project.ruler === 'bars' ? input.project.tempoBpm : undefined,
      playheadFrame: input.playheadFrame,
      clips: input.project.clips,
      excludeClipId: clip.id,
      enabled: input.snap,
    })
  let next = clip
  let snapFrame: number | null = null
  if (input.kind === 'move') {
    const position = snap(
      clip.startFrame + input.deltaFrames,
      0,
      Number.MAX_SAFE_INTEGER - duration,
      [0, duration],
    )
    next = { ...clip, startFrame: position.value, trackId: input.targetTrackId }
    snapFrame = position.target
  } else if (input.kind === 'trim-head') {
    const position = snap(
      clip.startFrame + input.deltaFrames,
      Math.max(0, clip.startFrame - clip.sourceInFrame),
      clipEndFrame(clip) - 1,
    )
    next = {
      ...clip,
      startFrame: position.value,
      sourceInFrame: clip.sourceInFrame + position.value - clip.startFrame,
    }
    snapFrame = position.target
  } else if (input.kind === 'trim-tail') {
    const sourceLength =
      input.asset?.normalizedFrameCount ?? clip.sourceOutFrame
    const position = snap(
      clipEndFrame(clip) + input.deltaFrames,
      clip.startFrame + 1,
      clip.startFrame + sourceLength - clip.sourceInFrame,
    )
    next = {
      ...clip,
      sourceOutFrame: clip.sourceInFrame + position.value - clip.startFrame,
    }
    snapFrame = position.target
  } else {
    const fade = draftFade(input, snap)
    next = fade.clip
    snapFrame = fade.snapFrame
  }
  const occupied = input.project.clips.some(
    (other) =>
      other.id !== clip.id &&
      other.trackId === next.trackId &&
      other.startFrame < clipEndFrame(next) &&
      clipEndFrame(other) > next.startFrame,
  )
  return {
    clip: next,
    kind: input.kind,
    targetTrackId: next.trackId,
    snapFrame,
    valid: !occupied,
    message: occupied
      ? 'This position overlaps another clip. Choose a free space or New lane.'
      : '',
  }
}

export function studioGestureCommand(
  draft: StudioGestureDraft,
  original: StudioClip,
): StudioCommand | null {
  if (!draft.valid || JSON.stringify(draft.clip) === JSON.stringify(original))
    return null
  const clipId = original.id
  const next = draft.clip
  switch (draft.kind) {
    case 'move':
      return next.trackId === STUDIO_NEW_LANE
        ? {
            type: 'move-clip-to-new-track',
            clipId,
            startFrame: next.startFrame,
            newTrackId: globalThis.crypto.randomUUID(),
          }
        : {
            type: 'move-clip',
            clipId,
            startFrame: next.startFrame,
            trackId: next.trackId,
          }
    case 'trim-head':
      return { type: 'trim-head', clipId, sourceInFrame: next.sourceInFrame }
    case 'trim-tail':
      return { type: 'trim-tail', clipId, sourceOutFrame: next.sourceOutFrame }
    default:
      return { type: 'set-fades', clipId, fades: next.fades }
  }
}
