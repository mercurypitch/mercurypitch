// ============================================================
// Studio clip takes — a clip keeps every take recorded over it, one playing and the rest ready to play over the same span
// ============================================================
//
// A clip's own audio fields are the take that plays (types.ts), so
// playback, export and freezing read a clip of many takes as a clip of one.
// The others wait in `takes`, oldest first, `activeTake` saying where the
// playing one stands among them. Every take plays over the clip's whole
// span: place and length belong to the clip, sound to the take (its audio,
// line-up, volume, fades, passes and comp).
//
// A take that is not playing is kept by its line-up with the playing one
// (`offsetFrames`), so a trim, split, move or punch that moves the clip's
// window moves every take with it, untouched. Only a change in the playing
// take's own audio rewrites the offsets: choosing another take, and
// choosing a pass (studioClipOnPass).
//
// Unpacked, a clip is its takes in the order they were recorded, each a
// clip of one take with the clip's id, lane and place (studioClipTakeList);
// packed around any one of them again it is the clip with that take
// playing (studioClipWithTakes). Every take edit is that: unpack, change,
// pack.
//
// A take recorded over clips of its lane is their newest take where it
// covers them ('stack-take'). Each clip under it is split at the take's
// edges, as REAPER splits; the stretch they share is one clip with one take
// more; what only the old clip covers stays as it was, and what only the
// new take covers is a clip of its own. So every take covers its whole clip,
// and nothing sung is lost (docs/plans/studio-takes.md).
import { fitStudioClipComp } from './clip-comp'
import { studioClipSourceBounds } from './clip-passes'
import type { SourceKind, StudioClip, StudioClipTake, StudioProject, } from './types'
import { requireValue } from './validation-values'

/** The most takes one clip keeps, as many as a loop take's passes. */
export const STUDIO_MAX_CLIP_TAKES = 32

/** How many takes a clip has: 1 for a clip of one take. */
export function studioClipTakeCount(clip: StudioClip): number {
  return (clip.takes?.length ?? 0) + 1
}

/** Which of its takes a clip plays, counted from 0, oldest first. */
export function studioClipActiveTake(clip: StudioClip): number {
  return clip.activeTake ?? 0
}

/** A clip without its other takes: the playing one alone. */
function ownTake(clip: StudioClip): StudioClip {
  const { takes: _takes, activeTake: _active, ...own } = clip
  return own
}

/** Take `take` of the clip as a clip of one take, lined up with the playing one. */
function takeClip(own: StudioClip, take: StudioClipTake): StudioClip {
  return {
    id: own.id,
    trackId: own.trackId,
    assetId: take.assetId,
    startFrame: own.startFrame,
    sourceInFrame: own.sourceInFrame + take.offsetFrames,
    sourceOutFrame: own.sourceOutFrame + take.offsetFrames,
    gainDb: take.gainDb,
    fades: take.fades,
    ...(take.passes && { passes: take.passes }),
    ...(take.comp && { comp: take.comp }),
  }
}

/** The clip's takes, oldest first, each as a clip of one take over the clip's span. */
export function studioClipTakeList(clip: StudioClip): StudioClip[] {
  const own = ownTake(clip)
  if (!clip.takes) return [own]
  const others = clip.takes.map((take) => takeClip(own, take))
  const at = studioClipActiveTake(clip)
  return [...others.slice(0, at), own, ...others.slice(at)]
}

/** A take that is not playing, as `playing` keeps it. */
function waitingTake(take: StudioClip, playing: StudioClip): StudioClipTake {
  return {
    assetId: take.assetId,
    offsetFrames: take.sourceInFrame - playing.sourceInFrame,
    gainDb: take.gainDb,
    fades: take.fades,
    ...(take.passes && { passes: take.passes }),
    ...(take.comp && { comp: take.comp }),
  }
}

/**
 * The clip of these takes, oldest first, playing take `active`. Each is a
 * clip of one take with the same id, lane, start and length
 * (studioClipTakeList).
 */
export function studioClipWithTakes(
  list: readonly StudioClip[],
  active: number,
): StudioClip {
  const playing = ownTake(list[active])
  if (list.length === 1) return playing
  return {
    ...playing,
    takes: list
      .filter((_, index) => index !== active)
      .map((take) => waitingTake(take, playing)),
    activeTake: active,
  }
}

/**
 * The clip with `change` made to each of its takes, the same one still
 * playing: what an edit of the clip's sound at an edge it cuts does, so
 * whichever take is chosen later meets the edge the same way.
 */
export function studioClipEveryTake(
  clip: StudioClip,
  change: (take: StudioClip) => StudioClip,
): StudioClip {
  if (!clip.takes) return change(clip)
  return studioClipWithTakes(
    studioClipTakeList(clip).map(change),
    studioClipActiveTake(clip),
  )
}

/** Every asset a clip plays or keeps, its playing take's first. */
export function studioClipAssetIds(clip: StudioClip): string[] {
  return [clip.assetId, ...(clip.takes ?? []).map((take) => take.assetId)]
}

/** Every asset the song's clips play or keep: what a prune, a copy or a backup must keep. */
export function studioSongAssetIds(
  project: Pick<StudioProject, 'clips'>,
): Set<string> {
  return new Set(project.clips.flatMap(studioClipAssetIds))
}

/**
 * The source frames a clip's trims can reach, in its playing take's frames:
 * as far as every take can go (studioClipSourceBounds), since all of them
 * play over the clip's span. `framesOf` gives an asset's length; a take
 * whose length is not known yet ends where it does now.
 */
export function studioClipTakeBounds(
  clip: StudioClip,
  framesOf: (assetId: string) => number | undefined,
): { readonly first: number; readonly end: number } {
  let first = -Infinity
  let end = Infinity
  for (const take of studioClipTakeList(clip)) {
    const frames = framesOf(take.assetId) ?? take.sourceOutFrame
    const bounds = studioClipSourceBounds(take, frames)
    const shift = clip.sourceInFrame - take.sourceInFrame
    first = Math.max(first, bounds.first + shift)
    end = Math.min(end, bounds.end + shift)
  }
  return { first, end }
}

/** Every comp a take that is not playing keeps, fitted to its clip's edges as a playing one is (fitStudioComps). */
export function fitStudioTakeComps(project: StudioProject): StudioProject {
  let changed = false
  const clips = project.clips.map((clip) => {
    if (clip.takes?.some((take) => take.comp !== undefined) !== true)
      return clip
    const list = studioClipTakeList(clip)
    const fitted = list.map(fitStudioClipComp)
    if (fitted.every((take, index) => take === list[index])) return clip
    changed = true
    return studioClipWithTakes(fitted, studioClipActiveTake(clip))
  })
  return changed ? { ...project, clips } : project
}

/** A take recorded over clips of its lane, kept as their newest take where it covers them. */
export interface StudioStackTakeEdit {
  readonly type: 'stack-take'
  /** The take's clip, of one take, as it lands on its lane. */
  readonly clip: StudioClip
  /** Ids for the clips the stacking cuts out: three for each clip under the take is enough. */
  readonly newClipIds: readonly string[]
}

export function isStudioStackTakeEdit(edit: {
  readonly type: string
}): edit is StudioStackTakeEdit {
  return edit.type === 'stack-take'
}

const clipEnd = (clip: StudioClip) =>
  clip.startFrame + clip.sourceOutFrame - clip.sourceInFrame

/** The part of a clip between two frames of the song, every take with it. */
function cutClip(
  clip: StudioClip,
  from: number,
  to: number,
  id: string,
): StudioClip {
  const sourceIn = clip.sourceInFrame + from - clip.startFrame
  return {
    ...clip,
    id,
    startFrame: from,
    sourceInFrame: sourceIn,
    sourceOutFrame: sourceIn + to - from,
  }
}

/** The clips of a lane that a stretch of it overlaps, in song order. */
function clipsUnder(
  project: StudioProject,
  trackId: string,
  from: number,
  to: number,
): StudioClip[] {
  return project.clips
    .filter(
      (clip) =>
        clip.trackId === trackId &&
        clip.startFrame < to &&
        clipEnd(clip) > from,
    )
    .sort((a, b) => a.startFrame - b.startFrame)
}

/**
 * The clips a take landing on `trackId` between two frames would stack on,
 * in song order: none where the lane is free there. Null when it cannot
 * stack: a clip there plays MIDI, has no room for a take more, or is not a
 * take (`kindOf` says a picked file, or nothing), so a backing track never
 * goes quiet under a take. `kindOf` gives an asset's source.
 */
export function studioStackTargets(
  project: StudioProject,
  trackId: string,
  from: number,
  to: number,
  kindOf: (assetId: string) => SourceKind | undefined,
): StudioClip[] | null {
  const under = clipsUnder(project, trackId, from, to)
  const stacks = under.every((clip) => {
    const kinds = studioClipAssetIds(clip).map(kindOf)
    return (
      clip.midi === undefined &&
      studioClipTakeCount(clip) < STUDIO_MAX_CLIP_TAKES &&
      kinds.every((kind) => kind !== undefined && kind !== 'file')
    )
  })
  return stacks ? under : null
}

/** The clip with `newest` added as its newest take, playing. */
function withNewestTake(clip: StudioClip, newest: StudioClip): StudioClip {
  const list = [...studioClipTakeList(clip), newest]
  return studioClipWithTakes(list, list.length - 1)
}

/** Hands out the edit's ids in order, and says so when they run out. */
function idSource(edit: StudioStackTakeEdit): () => string {
  let next = 0
  return () => {
    const id = edit.newClipIds[next++]
    requireValue(
      id !== undefined,
      `clip.${edit.clip.id}`,
      'Too few clip ids to stack the take',
    )
    return id
  }
}

/** The take, a clip of one audio take on an existing lane. */
function requireStackable(project: StudioProject, take: StudioClip): void {
  requireValue(
    project.tracks.some((track) => track.id === take.trackId),
    `track.${take.trackId}`,
    'Lane does not exist',
  )
  requireValue(
    take.takes === undefined && take.midi === undefined,
    `clip.${take.id}`,
    'Only an audio take of its own can be stacked',
  )
}

/** One clip under the take: its parts either side, and the stretch they share with the take as a clip of one take more. */
function stackOn(
  clip: StudioClip,
  take: StudioClip,
  nextId: () => string,
): {
  readonly before: StudioClip[]
  readonly shared: StudioClip
  readonly after: StudioClip[]
} {
  requireValue(
    clip.midi === undefined &&
      studioClipTakeCount(clip) < STUDIO_MAX_CLIP_TAKES,
    `clip.${clip.id}`,
    `A clip keeps up to ${STUDIO_MAX_CLIP_TAKES} takes, and a MIDI clip one`,
  )
  const from = Math.max(take.startFrame, clip.startFrame)
  const to = Math.min(clipEnd(take), clipEnd(clip))
  // The clip's first part keeps its id; any part after it gets a new one.
  let own: string | null = clip.id
  const part = (start: number, end: number) => {
    const id = own ?? nextId()
    own = null
    return cutClip(clip, start, end, id)
  }
  const before = clip.startFrame < from ? [part(clip.startFrame, from)] : []
  const middle = part(from, to)
  const shared = withNewestTake(middle, cutClip(take, from, to, middle.id))
  const after = to < clipEnd(clip) ? [part(to, clipEnd(clip))] : []
  return { before, shared, after }
}

/** The song with the edit's take stacked on the clips under it (see the header). */
export function stackStudioTake(
  project: StudioProject,
  edit: StudioStackTakeEdit,
): StudioProject {
  const take = edit.clip
  requireStackable(project, take)
  const under = clipsUnder(
    project,
    take.trackId,
    take.startFrame,
    clipEnd(take),
  )
  const nextId = idSource(edit)
  // The take's first part of its own keeps its id; any other part gets a new one.
  let own: string | null = take.id
  const ownPart = (start: number, end: number) => {
    const id = own ?? nextId()
    own = null
    return cutClip(take, start, end, id)
  }
  const placed: StudioClip[] = []
  let cursor = take.startFrame
  for (const clip of under) {
    const parts = stackOn(clip, take, nextId)
    if (cursor < parts.shared.startFrame)
      placed.push(ownPart(cursor, parts.shared.startFrame))
    placed.push(...parts.before, parts.shared, ...parts.after)
    cursor = clipEnd(parts.shared)
  }
  if (cursor < clipEnd(take)) placed.push(ownPart(cursor, clipEnd(take)))
  const replaced = new Set(under.map((clip) => clip.id))
  return {
    ...project,
    clips: [
      ...project.clips.filter((clip) => !replaced.has(clip.id)),
      ...placed,
    ],
  }
}
