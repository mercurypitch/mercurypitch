// ============================================================
// Studio clip comp — which pass of a loop take plays each stretch of its clip, so a singer keeps the best phrase of every pass
// ============================================================
//
// A loop take's passes are windows of one audio, all sung over the same
// range (clip-passes.ts), so frame f of one pass and frame f of another are
// the same moment of the song. A comp says, stretch by stretch, which pass
// plays: each stretch is a span of the clip's own source frames, those of
// the pass they sit in, and sounds that span of the pass it names, moved
// by whole passes. The clip's place, trims, fades and gain stay as they
// are. Playback crosses from one pass to the next with a short equal-power
// fade centred on each join (comp-plan.ts).
//
// A comp covers its clip exactly, stretch after stretch, and two
// neighbours never name the same pass: they are merged, and a comp left
// with one stretch is no comp but that pass played whole
// (studioClipOnPass). Every edit that moves a comped clip's edges keeps it
// that way (fitStudioComps, after each edit in commands.ts): a split cuts
// the comp where it splits, a trim cuts it at the new edge, and a trim back
// out plays the edge stretch's pass on into the frames it uncovers. Choose
// pass plays one pass whole and leaves no comp.
import { studioClipOnPass, studioPassAt } from './clip-passes'
import type { StudioClip, StudioCompSegment, StudioProject } from './types'
import { requireValue } from './validation-values'

/** The most stretches one comp keeps: a bar each of a long range, and more. */
export const STUDIO_MAX_COMP_SEGMENTS = 512

/** Play one pass over a stretch of a loop take's clip: one swipe, one undo. */
export interface StudioCompEdit {
  readonly type: 'comp-pass'
  readonly clipId: string
  /** The stretch, in the clip's own source frames, inside the clip. */
  readonly fromSourceFrame: number
  readonly toSourceFrame: number
  /** The pass to play over it, counted from 0, oldest first. */
  readonly pass: number
}

type LoopClip = StudioClip & {
  readonly passes: NonNullable<StudioClip['passes']>
}

/** The pass a loop take's clip is counted on: the one its own source frames sit in. */
function ownPass(clip: LoopClip): number {
  return studioPassAt(clip.passes, clip.sourceInFrame)
}

/** What plays over a loop take's clip, stretch by stretch: its comp, or its own pass throughout. Null for any other clip. */
export function studioClipComp(
  clip: StudioClip,
): readonly StudioCompSegment[] | null {
  if (!clip.passes) return null
  return (
    clip.comp ?? [
      {
        fromSourceFrame: clip.sourceInFrame,
        toSourceFrame: clip.sourceOutFrame,
        pass: ownPass(clip as LoopClip),
      },
    ]
  )
}

/** The pass playing at one of the clip's own source frames; before its first stretch or past its last, theirs. */
export function studioCompPassAt(
  clip: StudioClip,
  sourceFrame: number,
): number | null {
  const comp = studioClipComp(clip)
  if (!comp) return null
  return (comp.find((part) => sourceFrame < part.toSourceFrame) ?? comp.at(-1)!)
    .pass
}

/** The frame of the take that sounds for one of the clip's own source frames: moved by whole passes to the pass playing there. */
export function studioCompSourceFrame(
  clip: StudioClip,
  sourceFrame: number,
): number {
  if (!clip.passes || !clip.comp) return sourceFrame
  const pass = studioCompPassAt(clip, sourceFrame)!
  return sourceFrame + (pass - ownPass(clip as LoopClip)) * clip.passes.frames
}

/** Neighbours on one pass merged into one stretch. */
function merged(parts: readonly StudioCompSegment[]): StudioCompSegment[] {
  const result: StudioCompSegment[] = []
  for (const part of parts) {
    const last = result.at(-1)
    if (last?.pass === part.pass)
      result[result.length - 1] = { ...last, toSourceFrame: part.toSourceFrame }
    else result.push(part)
  }
  return result
}

/**
 * The clip playing `parts` over its source frames: cut to them, its edge
 * stretches reaching them, neighbours on one pass merged. One stretch left
 * is no comp: that pass, played whole.
 */
function withComp(
  clip: LoopClip,
  parts: readonly StudioCompSegment[],
): StudioClip {
  const { comp: _comp, ...plain } = clip
  const inside = parts.flatMap((part) => {
    const fromSourceFrame = Math.max(part.fromSourceFrame, clip.sourceInFrame)
    const toSourceFrame = Math.min(part.toSourceFrame, clip.sourceOutFrame)
    return toSourceFrame > fromSourceFrame
      ? [{ fromSourceFrame, toSourceFrame, pass: part.pass }]
      : []
  })
  if (inside.length === 0)
    inside.push({
      ...(clip.sourceOutFrame <= parts[0].fromSourceFrame
        ? parts[0]
        : parts[parts.length - 1]),
    })
  inside[0] = { ...inside[0], fromSourceFrame: clip.sourceInFrame }
  inside[inside.length - 1] = {
    ...inside[inside.length - 1],
    toSourceFrame: clip.sourceOutFrame,
  }
  const result = merged(inside)
  if (result.length > 1) return { ...plain, comp: result }
  const [whole] = result
  return whole.pass === ownPass(clip)
    ? plain
    : studioClipOnPass(plain, whole.pass)
}

/** A comped clip after an edit that moved its edges: its comp fitted to them, or the same clip when it fits already. */
export function fitStudioClipComp(clip: StudioClip): StudioClip {
  const { comp } = clip
  if (comp === undefined || comp.length === 0 || !clip.passes) return clip
  if (
    comp[0].fromSourceFrame === clip.sourceInFrame &&
    comp[comp.length - 1].toSourceFrame === clip.sourceOutFrame
  )
    return clip
  return withComp(clip as LoopClip, comp)
}

/** Every comped clip of the song fitted to its edges: what commands.ts runs after each edit. */
export function fitStudioComps(project: StudioProject): StudioProject {
  let changed = false
  const clips = project.clips.map((clip) => {
    const fitted = fitStudioClipComp(clip)
    changed ||= fitted !== clip
    return fitted
  })
  return changed ? { ...project, clips } : project
}

export function isStudioCompEdit(edit: {
  readonly type: string
}): edit is StudioCompEdit {
  return edit.type === 'comp-pass'
}

/** The song with `edit.pass` playing over the edit's stretch of its clip, the rest as it was. */
export function applyStudioCompEdit(
  project: StudioProject,
  edit: StudioCompEdit,
): StudioProject {
  const clip = project.clips.find((item) => item.id === edit.clipId)
  requireValue(clip !== undefined, `clip.${edit.clipId}`, 'Clip does not exist')
  const comp = studioClipComp(clip)
  const path = `clip.${clip.id}.comp`
  requireValue(comp !== null, path, 'Only a loop take can be comped')
  const { fromSourceFrame: from, toSourceFrame: to, pass } = edit
  requireValue(
    Number.isSafeInteger(from) &&
      Number.isSafeInteger(to) &&
      from >= clip.sourceInFrame &&
      to <= clip.sourceOutFrame &&
      to > from,
    path,
    'The stretch must lie inside the clip',
  )
  requireValue(
    Number.isSafeInteger(pass) && pass >= 0 && pass < clip.passes!.count,
    path,
    "Pass is not one of the clip's",
  )
  // What the swipe leaves of each stretch, either side of it.
  const kept = comp.flatMap((part) => [
    ...(part.fromSourceFrame < from
      ? [{ ...part, toSourceFrame: Math.min(part.toSourceFrame, from) }]
      : []),
    ...(part.toSourceFrame > to
      ? [{ ...part, fromSourceFrame: Math.max(part.fromSourceFrame, to) }]
      : []),
  ])
  const parts = [...kept, { fromSourceFrame: from, toSourceFrame: to, pass }]
  parts.sort((a, b) => a.fromSourceFrame - b.fromSourceFrame)
  const next = withComp(clip as LoopClip, parts)
  return {
    ...project,
    clips: project.clips.map((item) => (item.id === clip.id ? next : item)),
  }
}
