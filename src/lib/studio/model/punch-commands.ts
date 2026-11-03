// ============================================================
// Studio punch commands — a punch replaces what its lane plays under it, in place, as tape does
// ============================================================
//
// A punch takes over its stretch of the lane: any clip there is split at
// the take's first and last frames, the part between goes, and the take
// plays in its place, all as one edit and one Undo. The parts either side
// keep their audio as it was, each with a short fade on the edge the punch
// cut, as long as the take's own, so neither steps into silence with a
// click. A lane holds no two clips at once (validation-clips.ts), so the
// two fades meet at the edge rather than overlap.
//
// Nothing outside the range and those fades changes. A clip fade inside
// the new fade's stretch gives way to it, and one ending there hands over
// where it ends, since a clip's two fades may not overlap. A part already
// silent at the cut is left alone, and so is one with a fade under way
// across the cut from outside that stretch: a new fade could only meet it
// by changing what plays outside the stretch, so that part ends on the
// Studio's short edge fade (edge-envelope.ts) instead.
import type { StudioClip, StudioProject } from './types'
import { requireValue } from './validation-values'

export interface StudioPunchEdit {
  readonly type: 'punch-clip'
  /** The take's clip, on the lane it punches into. */
  readonly clip: StudioClip
  /** The id for what plays after the take of a clip the punch splits in two. */
  readonly afterClipId: string
  /** The fade on each edge the punch cuts: the take's own. */
  readonly fadeFrames: number
}

function clipEnd(clip: StudioClip): number {
  return clip.startFrame + clip.sourceOutFrame - clip.sourceInFrame
}

/** The part of a clip before a punch, fading out to its new end. */
function fadeOutToEnd(part: StudioClip, fadeFrames: number): StudioClip {
  const edge = part.sourceOutFrame
  const stretch = edge - fadeFrames
  const { in: rise, out: fall, curve } = part.fades
  // Silent by the cut (its fade-out over, or its fade-in not begun), or with
  // a fade under way across it from before the stretch: left as it was.
  if (
    (fall && (fall.toSourceFrame <= edge || fall.fromSourceFrame < stretch)) ||
    (rise && (rise.fromSourceFrame >= edge || rise.toSourceFrame > edge))
  )
    return part
  const from = Math.max(
    stretch,
    part.sourceInFrame,
    rise?.toSourceFrame ?? part.sourceInFrame,
  )
  return {
    ...part,
    fades: {
      curve,
      ...(rise && { in: rise }),
      ...(from < edge && {
        out: { fromSourceFrame: from, toSourceFrame: edge },
      }),
    },
  }
}

/** The part of a clip after a punch, fading in from its new start. */
function fadeInFromStart(part: StudioClip, fadeFrames: number): StudioClip {
  const edge = part.sourceInFrame
  const stretch = edge + fadeFrames
  const { in: rise, out: fall, curve } = part.fades
  // Silent at the cut (its fade-in not begun, or its fade-out over), or with
  // a fade under way across it past the stretch: left as it was.
  if (
    (rise && (rise.fromSourceFrame >= edge || rise.toSourceFrame > stretch)) ||
    (fall && (fall.toSourceFrame <= edge || fall.fromSourceFrame < edge))
  )
    return part
  const to = Math.min(
    stretch,
    part.sourceOutFrame,
    fall?.fromSourceFrame ?? part.sourceOutFrame,
  )
  return {
    ...part,
    fades: {
      curve,
      ...(to > edge && { in: { fromSourceFrame: edge, toSourceFrame: to } }),
      ...(fall && { out: fall }),
    },
  }
}

/** The song with `edit.clip` in its lane, in place of what the lane played under it. */
export function punchStudioClip(
  project: StudioProject,
  edit: StudioPunchEdit,
): StudioProject {
  const take = edit.clip
  requireValue(
    project.tracks.some((track) => track.id === take.trackId),
    `track.${take.trackId}`,
    'Lane does not exist',
  )
  const from = take.startFrame
  const to = clipEnd(take)
  let split = 0
  const clips = project.clips.flatMap((clip): StudioClip[] => {
    const start = clip.startFrame
    const end = clipEnd(clip)
    if (clip.trackId !== take.trackId || end <= from || start >= to)
      return [clip]
    const parts: StudioClip[] = []
    if (start < from)
      parts.push(
        fadeOutToEnd(
          { ...clip, sourceOutFrame: clip.sourceInFrame + from - start },
          edit.fadeFrames,
        ),
      )
    if (end > to) {
      if (start < from) split++
      parts.push(
        fadeInFromStart(
          {
            ...clip,
            id: start < from ? edit.afterClipId : clip.id,
            startFrame: to,
            sourceInFrame: clip.sourceInFrame + to - start,
          },
          edit.fadeFrames,
        ),
      )
    }
    return parts
  })
  requireValue(split <= 1, `clip.${take.id}`, 'Lane clips overlap')
  return { ...project, clips: [...clips, take] }
}
