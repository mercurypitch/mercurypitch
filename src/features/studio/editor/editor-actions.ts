// Studio edit shortcuts — an in-project clipboard reuses owned audio and commands preserve undo history.
import type { StudioClip } from '@/lib/studio/model/types'
import type { StudioEditorFocus, StudioEditorOptions } from './types'

export function createEditorActions(options: StudioEditorOptions) {
  let projectId = options.project()?.id ?? null
  let clipboard: StudioClip | null = null
  const createId = options.createId ?? (() => globalThis.crypto.randomUUID())

  function sync(): void {
    const nextId = options.project()?.id ?? null
    if (nextId === projectId) return
    projectId = nextId
    clipboard = null
    options.clipboardChanged?.(false)
  }

  function copy(clipId: string): boolean {
    sync()
    const clip = options.project()?.clips.find((item) => item.id === clipId)
    if (!clip) return false
    clipboard = structuredClone(clip)
    options.clipboardChanged?.(true)
    options.announce('Clip copied.')
    return true
  }

  function placed(clipId: string, previousTrackCount: number): void {
    const project = options.project()
    const clip = project?.clips.find((item) => item.id === clipId)
    if (!project || !clip) return
    options.selectClip(clipId)
    options.focusClip?.(clipId, clip.trackId)
    if (project.tracks.length > previousTrackCount)
      options.announce('Added on a new lane.')
  }

  function paste(trackId: string): boolean {
    sync()
    const project = options.project()
    if (!clipboard || !project || !options.writable()) return false
    const newClipId = createId()
    const accepted = options.dispatch({
      type: 'paste-clip',
      clip: structuredClone(clipboard),
      trackId,
      startFrame: options.playheadFrame(),
      newClipId,
      newTrackId: createId(),
    })
    if (accepted) placed(newClipId, project.tracks.length)
    return accepted
  }

  function duplicate(clipId: string): boolean {
    const project = options.project()
    if (!project) return false
    const newClipId = createId()
    const accepted = options.dispatch({
      type: 'duplicate-clip',
      clipId,
      newClipId,
      newTrackId: createId(),
    })
    if (accepted) placed(newClipId, project.tracks.length)
    return accepted
  }

  function remove(clipId: string): boolean {
    const project = options.project()
    const clip = project?.clips.find((item) => item.id === clipId)
    if (!project || !clip) return false
    const neighbor = project.clips
      .filter((item) => item.id !== clipId && item.trackId === clip.trackId)
      .sort(
        (a, b) =>
          Math.abs(a.startFrame - clip.startFrame) -
          Math.abs(b.startFrame - clip.startFrame),
      )[0]
    if (!options.dispatch({ type: 'remove-clip', clipId })) return false
    options.selectClip(neighbor?.id ?? null)
    options.focusClip?.(neighbor?.id ?? null, clip.trackId)
    return true
  }

  function split(clipId: string): boolean {
    const clip = options.project()?.clips.find((item) => item.id === clipId)
    const atFrame = options.playheadFrame()
    if (
      !clip ||
      atFrame <= clip.startFrame ||
      atFrame >= clip.startFrame + clip.sourceOutFrame - clip.sourceInFrame
    )
      return false
    return options.dispatch({
      type: 'split-clip',
      clipId,
      atFrame,
      newClipId: createId(),
    })
  }

  function header(focus: StudioEditorFocus, key: string): boolean {
    const track = options
      .project()
      ?.tracks.find((item) => item.id === focus.trackId)
    if (!track) return false
    return options.dispatch({
      type: 'update-track',
      trackId: track.id,
      changes: key === 'm' ? { mute: !track.mute } : { solo: !track.solo },
    })
  }

  return {
    sync,
    copy,
    paste,
    duplicate,
    remove,
    split,
    header,
    canPaste: () => {
      sync()
      return clipboard !== null && options.writable()
    },
  }
}
