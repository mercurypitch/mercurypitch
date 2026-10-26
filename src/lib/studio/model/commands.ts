// Studio commands — atomic non-destructive edits with monotonic save revisions.
import type { TrackRole } from '@/lib/studio-fx/role-chains'
import { isTrackRole } from '@/lib/studio-fx/role-chains'
import { createStudioTrack } from './defaults'
import type { StudioAsset, StudioClip, StudioProject, StudioTrack, } from './types'
import { validateStudioProject } from './validation'
import { requireValue } from './validation-values'

export type StudioEdit =
  | { readonly type: 'rename-project'; readonly title: string }
  | { readonly type: 'add-track'; readonly track: StudioTrack }
  | { readonly type: 'add-clip'; readonly clip: StudioClip }
  | {
      readonly type: 'add-audio'
      readonly track: StudioTrack
      readonly clip: StudioClip
    }
  | { readonly type: 'remove-track'; readonly trackId: string }
  | {
      readonly type: 'set-track-role'
      readonly trackId: string
      readonly role: TrackRole
    }
  | {
      readonly type: 'update-track'
      readonly trackId: string
      readonly changes: Partial<
        Pick<
          StudioTrack,
          'name' | 'gainDb' | 'balanceGainDb' | 'pan' | 'mute' | 'solo' | 'fx'
        >
      >
    }
  | { readonly type: 'remove-clip'; readonly clipId: string }
  | {
      readonly type: 'move-clip'
      readonly clipId: string
      readonly trackId: string
      readonly startFrame: number
    }
  | {
      readonly type: 'trim-head'
      readonly clipId: string
      readonly sourceInFrame: number
    }
  | {
      readonly type: 'trim-tail'
      readonly clipId: string
      readonly sourceOutFrame: number
    }
  | {
      readonly type: 'split-clip'
      readonly clipId: string
      readonly atFrame: number
      readonly newClipId: string
    }
  | {
      readonly type: 'duplicate-clip'
      readonly clipId: string
      readonly newClipId: string
      readonly newTrackId: string
    }
  | {
      readonly type: 'set-fades'
      readonly clipId: string
      readonly fades: StudioClip['fades']
    }
  | {
      readonly type: 'set-clip-gain'
      readonly clipId: string
      readonly gainDb: number
    }
  | {
      readonly type: 'set-project-settings'
      readonly changes: Partial<
        Pick<StudioProject, 'tempoBpm' | 'ruler' | 'mix' | 'master' | 'export'>
      >
    }

export type StudioCommand =
  | StudioEdit
  | { readonly type: 'batch'; readonly commands: readonly StudioEdit[] }

export interface StudioCommandOptions {
  readonly assets: readonly StudioAsset[]
  readonly now?: Date | string
}

function getClip(project: StudioProject, id: string): StudioClip {
  const clip = project.clips.find((item) => item.id === id)
  requireValue(clip !== undefined, `clip.${id}`, 'Clip does not exist')
  return clip
}

function getTrack(project: StudioProject, id: string): StudioTrack {
  const track = project.tracks.find((item) => item.id === id)
  requireValue(track !== undefined, `track.${id}`, 'Lane does not exist')
  return track
}

function replaceClip(project: StudioProject, next: StudioClip): StudioProject {
  return {
    ...project,
    clips: project.clips.map((clip) => (clip.id === next.id ? next : clip)),
  }
}

function duplicateClip(
  project: StudioProject,
  edit: Extract<StudioEdit, { type: 'duplicate-clip' }>,
): StudioProject {
  const source = getClip(project, edit.clipId)
  const track = getTrack(project, source.trackId)
  const length = source.sourceOutFrame - source.sourceInFrame
  const start = source.startFrame + length
  const conflict = project.clips.some(
    (clip) =>
      clip.trackId === source.trackId &&
      clip.startFrame < start + length &&
      clip.startFrame + clip.sourceOutFrame - clip.sourceInFrame > start,
  )
  const next = {
    ...source,
    id: edit.newClipId,
    startFrame: start,
    trackId: conflict ? edit.newTrackId : source.trackId,
  }
  const newTrack = {
    ...track,
    id: edit.newTrackId,
    order: Math.max(-1, ...project.tracks.map((item) => item.order)) + 1,
  }
  return {
    ...project,
    tracks: conflict ? [...project.tracks, newTrack] : project.tracks,
    clips: [...project.clips, next],
  }
}

function editClip(
  project: StudioProject,
  edit: Extract<StudioEdit, { clipId: string }>,
): StudioProject {
  const clip = getClip(project, edit.clipId)
  switch (edit.type) {
    case 'remove-clip':
      return {
        ...project,
        clips: project.clips.filter((item) => item.id !== clip.id),
      }
    case 'move-clip':
      return replaceClip(project, {
        ...clip,
        trackId: edit.trackId,
        startFrame: edit.startFrame,
      })
    case 'trim-head':
      return replaceClip(project, {
        ...clip,
        sourceInFrame: edit.sourceInFrame,
        startFrame: clip.startFrame + edit.sourceInFrame - clip.sourceInFrame,
      })
    case 'trim-tail':
      return replaceClip(project, {
        ...clip,
        sourceOutFrame: edit.sourceOutFrame,
      })
    case 'set-fades':
      return replaceClip(project, { ...clip, fades: edit.fades })
    case 'set-clip-gain':
      return replaceClip(project, { ...clip, gainDb: edit.gainDb })
    case 'duplicate-clip':
      return duplicateClip(project, edit)
    case 'split-clip': {
      const offset = edit.atFrame - clip.startFrame
      requireValue(
        Number.isSafeInteger(offset) &&
          offset > 0 &&
          offset < clip.sourceOutFrame - clip.sourceInFrame,
        `clip.${clip.id}`,
        'Split must be inside the clip',
      )
      const sourceFrame = clip.sourceInFrame + offset
      const left = { ...clip, sourceOutFrame: sourceFrame }
      const right = {
        ...clip,
        id: edit.newClipId,
        startFrame: edit.atFrame,
        sourceInFrame: sourceFrame,
      }
      return {
        ...project,
        clips: [
          ...project.clips.map((item) => (item.id === clip.id ? left : item)),
          right,
        ],
      }
    }
  }
}

function applyEdit(project: StudioProject, edit: StudioEdit): StudioProject {
  if ('clipId' in edit) return editClip(project, edit)
  switch (edit.type) {
    case 'rename-project':
      return { ...project, title: edit.title }
    case 'add-track':
      return { ...project, tracks: [...project.tracks, edit.track] }
    case 'add-clip':
      return { ...project, clips: [...project.clips, edit.clip] }
    case 'add-audio':
      return {
        ...project,
        tracks: [...project.tracks, edit.track],
        clips: [...project.clips, edit.clip],
      }
    case 'remove-track':
      getTrack(project, edit.trackId)
      return {
        ...project,
        tracks: project.tracks.filter((track) => track.id !== edit.trackId),
        clips: project.clips.filter((clip) => clip.trackId !== edit.trackId),
      }
    case 'set-track-role': {
      const target = getTrack(project, edit.trackId)
      requireValue(
        isTrackRole(edit.role),
        `track.${target.id}.role`,
        'Unsupported track role',
      )
      if (target.role === edit.role) return project
      const resolved = createStudioTrack({
        id: target.id,
        name: target.name,
        order: target.order,
        role: edit.role,
      })
      const next = {
        ...target,
        role: resolved.role,
        balanceGainDb: resolved.balanceGainDb,
        fx: resolved.fx,
      }
      return {
        ...project,
        tracks: project.tracks.map((track) =>
          track.id === target.id ? next : track,
        ),
      }
    }
    case 'update-track': {
      const target = getTrack(project, edit.trackId)
      return {
        ...project,
        tracks: project.tracks.map((track) =>
          track.id === target.id ? { ...track, ...edit.changes } : track,
        ),
      }
    }
    case 'set-project-settings':
      return { ...project, ...edit.changes }
  }
}

/** Revisions belong to commands; persistence compares and stores them without another bump. */
export function reviseStudioProject(
  current: StudioProject,
  next: StudioProject,
  options: StudioCommandOptions,
): StudioProject {
  const supplied =
    options.now instanceof Date
      ? options.now.toISOString()
      : (options.now ?? new Date().toISOString())
  const updatedAt = supplied < current.updatedAt ? current.updatedAt : supplied
  return validateStudioProject(
    {
      ...next,
      id: current.id,
      createdAt: current.createdAt,
      updatedAt,
      revision: current.revision + 1,
    },
    options.assets,
  )
}

export function applyStudioCommand(
  project: StudioProject,
  command: StudioCommand,
  options: StudioCommandOptions,
): StudioProject {
  const initial = validateStudioProject(project, options.assets)
  const edits = command.type === 'batch' ? command.commands : [command]
  const next = edits.reduce(applyEdit, initial)
  if (JSON.stringify(next) === JSON.stringify(initial)) return project
  return reviseStudioProject(project, next, options)
}
