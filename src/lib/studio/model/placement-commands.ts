// Studio placement commands — copied audio and explicit new lanes preserve source samples and track settings; a pasted MIDI clip plays the notes it was copied with.
import { sameStudioSequence, studioSequence } from './sequences'
import type { StudioClip, StudioProject, StudioSequence, StudioTrack, } from './types'
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
  /** A MIDI clip's sequence as it was copied: the song may have dropped or changed it since. */
  readonly sequence?: StudioSequence
  /** The id the copied sequence takes when the song no longer holds it as it was. */
  readonly newSequenceId?: string
  readonly trackId: string
  readonly startFrame: number
  readonly newClipId: string
  readonly newTrackId: string
}

/**
 * What a pasted clip plays: its sequence, shared while the song holds it as
 * it was copied; else the copy the paste carries, under a new id, since its
 * clip may be gone (and its sequence with it) or its notes edited since.
 */
function pastedMidi(
  project: StudioProject,
  edit: StudioPasteEdit,
): { clip: StudioClip; sequences: StudioProject['sequences'] } {
  const midi = edit.clip.midi
  const held = midi && studioSequence(project, midi.sequenceId)
  if (
    midi === undefined ||
    (held !== undefined &&
      (edit.sequence === undefined || sameStudioSequence(held, edit.sequence)))
  )
    return { clip: edit.clip, sequences: project.sequences }
  const copied = edit.sequence
  const id = edit.newSequenceId
  requireValue(
    copied?.id === midi.sequenceId &&
      id !== undefined &&
      studioSequence(project, id) === undefined,
    `clip.${edit.clip.id}.midi`,
    'The copied notes are gone',
  )
  return {
    clip: { ...edit.clip, midi: { ...midi, sequenceId: id } },
    sequences: [...(project.sequences ?? []), { ...copied, id }],
  }
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
  const pasted = pastedMidi(project, edit)
  const next = {
    ...pasted.clip,
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
    ...(pasted.sequences && { sequences: pasted.sequences }),
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
