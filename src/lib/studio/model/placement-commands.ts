// Studio placement commands — copied audio and explicit new lanes preserve source samples and track settings.
import type { StudioClip, StudioProject, StudioTrack } from './types'
import { requireValue } from './validation-values'

function trackById(project: StudioProject, id: string): StudioTrack {
  const track = project.tracks.find((item) => item.id === id)
  requireValue(track !== undefined, `track.${id}`, 'Lane does not exist')
  return track
}

function clonedTrack(
  project: StudioProject,
  source: StudioTrack,
  id: string,
): StudioTrack {
  return {
    ...source,
    id,
    order: Math.max(-1, ...project.tracks.map((track) => track.order)) + 1,
  }
}

export interface StudioPasteEdit {
  readonly type: 'paste-clip'
  readonly clip: StudioClip
  readonly trackId: string
  readonly startFrame: number
  readonly newClipId: string
  readonly newTrackId: string
}

export function pasteStudioClip(
  project: StudioProject,
  edit: StudioPasteEdit,
): StudioProject {
  const destination = trackById(project, edit.trackId)
  const length = edit.clip.sourceOutFrame - edit.clip.sourceInFrame
  const conflict = project.clips.some(
    (clip) =>
      clip.trackId === destination.id &&
      clip.startFrame < edit.startFrame + length &&
      clip.startFrame + clip.sourceOutFrame - clip.sourceInFrame >
        edit.startFrame,
  )
  const next = {
    ...edit.clip,
    id: edit.newClipId,
    trackId: conflict ? edit.newTrackId : destination.id,
    startFrame: edit.startFrame,
  }
  return {
    ...project,
    tracks: conflict
      ? [...project.tracks, clonedTrack(project, destination, edit.newTrackId)]
      : project.tracks,
    clips: [...project.clips, next],
  }
}

export function moveStudioClipToNewTrack(
  project: StudioProject,
  clip: StudioClip,
  startFrame: number,
  newTrackId: string,
): StudioProject {
  const source = trackById(project, clip.trackId)
  return {
    ...project,
    tracks: [...project.tracks, clonedTrack(project, source, newTrackId)],
    clips: project.clips.map((item) =>
      item.id === clip.id ? { ...clip, trackId: newTrackId, startFrame } : item,
    ),
  }
}
