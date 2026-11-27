// Studio take commands — Crop to this take and Explode takes to new lanes: a clip's takes cut down to the one it plays, or its other takes moved out to lanes of their own, each one undo step.
//
// REAPER's "Crop to active take" (Alt+Shift+T) removes every take but the
// active one, and its loop takes are takes of their own, so a loop take
// here loses its other passes too, unless a comp plays them: a comp needs
// every pass it plays. Its "Explode all takes to new tracks" copies each
// take to a new track and leaves the item as it was, so the active take
// plays twice until it is muted. Studio moves the other takes out instead:
// the clip keeps the take it plays, and each take sounds once
// (docs/plans/studio-takes.md, sections 3.3 and 7).
import { studioClipActiveTake, studioClipTakeList, studioClipTakeSteps, } from './clip-takes'
import { createStudioTrack } from './defaults'
import type { StudioClip, StudioProject } from './types'
import { requireValue } from './validation-values'

/** Crop to this take: the clip keeps the take it plays and nothing else. */
export interface StudioCropTakesEdit {
  readonly type: 'crop-takes'
  readonly clipId: string
}

/** A lane for a take that leaves its clip: its id, and the name it shows. */
export interface StudioTakeLaneSeed {
  readonly id: string
  readonly name: string
}

/** Explode takes to new lanes: each other take moves to a lane of its own right under the clip's, at the same place. */
export interface StudioExplodeTakesEdit {
  readonly type: 'explode-takes'
  readonly clipId: string
  /** A lane for each other take, in the order they were sung; the edit gives them their places. */
  readonly lanes: readonly StudioTakeLaneSeed[]
  /** The id of each of those takes as a clip of its own, in the same order. */
  readonly clipIds: readonly string[]
}

export type StudioTakeEdit = StudioCropTakesEdit | StudioExplodeTakesEdit

export function isStudioTakeEdit(edit: {
  readonly type: string
}): edit is StudioTakeEdit {
  return edit.type === 'crop-takes' || edit.type === 'explode-takes'
}

/** True when a crop leaves something out: another take, or another pass of a loop take that no comp plays. */
export function studioCanCropTakes(clip: StudioClip): boolean {
  return studioClipTakeSteps(clip).length > 1
}

/** The take a clip plays, alone. A loop take keeps its passes only while a comp plays them. */
export function studioClipCropped(clip: StudioClip): StudioClip {
  const list = studioClipTakeList(clip)
  const own = list[studioClipActiveTake(clip)]
  if (own.passes === undefined || own.comp !== undefined) return own
  const { passes: _passes, ...alone } = own
  return alone
}

function requireClip(project: StudioProject, clipId: string): StudioClip {
  const clip = project.clips.find((item) => item.id === clipId)
  requireValue(clip !== undefined, `clip.${clipId}`, 'Clip does not exist')
  return clip
}

function cropTakes(
  project: StudioProject,
  edit: StudioCropTakesEdit,
): StudioProject {
  const clip = requireClip(project, edit.clipId)
  requireValue(
    studioCanCropTakes(clip),
    `clip.${clip.id}`,
    'The clip plays its only take',
  )
  const cropped = studioClipCropped(clip)
  return {
    ...project,
    clips: project.clips.map((item) => (item.id === clip.id ? cropped : item)),
  }
}

function explodeTakes(
  project: StudioProject,
  edit: StudioExplodeTakesEdit,
): StudioProject {
  const clip = requireClip(project, edit.clipId)
  requireValue(
    clip.takes !== undefined,
    `clip.${clip.id}`,
    'The clip plays its only take',
  )
  const active = studioClipActiveTake(clip)
  const list = studioClipTakeList(clip)
  const others = list.filter((_, index) => index !== active)
  requireValue(
    edit.lanes.length === others.length &&
      edit.clipIds.length === others.length,
    `clip.${clip.id}`,
    'A new lane and a clip id for each other take',
  )
  const lane = project.tracks.find((track) => track.id === clip.trackId)
  requireValue(
    lane !== undefined,
    `track.${clip.trackId}`,
    'Lane does not exist',
  )
  // The new lanes go right under the clip's, in the order the takes were
  // sung; every lane below moves down to make room.
  const added = edit.lanes.map((seed, index) =>
    createStudioTrack({
      id: seed.id,
      name: seed.name,
      order: lane.order + 1 + index,
      role: lane.role,
    }),
  )
  const moved = others.map((take, index) => ({
    ...take,
    id: edit.clipIds[index],
    trackId: added[index].id,
  }))
  // The take it plays, alone: studioClipTakeList hands it over without the others.
  const kept = list[active]
  return {
    ...project,
    tracks: [
      ...project.tracks.map((track) =>
        track.order > lane.order
          ? { ...track, order: track.order + added.length }
          : track,
      ),
      ...added,
    ],
    clips: [
      ...project.clips.map((item) => (item.id === clip.id ? kept : item)),
      ...moved,
    ],
  }
}

export function applyStudioTakeEdit(
  project: StudioProject,
  edit: StudioTakeEdit,
): StudioProject {
  return edit.type === 'crop-takes'
    ? cropTakes(project, edit)
    : explodeTakes(project, edit)
}
