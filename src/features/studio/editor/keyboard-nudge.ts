// Studio keyboard nudges — repeated keydown previews one absolute move and commits once on keyup.
import type { StudioClip } from '@/lib/studio/model/types'
import { studioGridInterval } from '../timeline/timeline-snap'
import type { StudioEditorOptions } from './types'
import { finishStudioKey } from './types'

interface NudgeDraft {
  projectId: string
  revision: number
  zoom: number
  original: StudioClip
  preview: StudioClip
  offset: number
  keys: Set<string>
}

export function createKeyboardNudge(options: StudioEditorOptions) {
  let draft: NudgeDraft | null = null

  function cancel(): void {
    if (!draft) return
    draft = null
    options.previewClip(null)
  }

  function sync(): void {
    const project = options.project()
    const writable = options.writable()
    const zoom = options.pixelsPerSecond()
    if (!draft) return
    if (
      !writable ||
      project?.id !== draft.projectId ||
      project.revision !== draft.revision ||
      zoom !== draft.zoom
    )
      cancel()
  }

  function keyDown(event: KeyboardEvent, clipId: string): boolean {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return false
    if (event.ctrlKey || event.metaKey || !options.writable()) return false
    const project = options.project()
    const clip = project?.clips.find((item) => item.id === clipId)
    if (!project || !clip) return false
    sync()
    if (draft && draft.original.id !== clip.id) cancel()
    draft ??= {
      projectId: project.id,
      revision: project.revision,
      zoom: options.pixelsPerSecond(),
      original: clip,
      preview: clip,
      offset: 0,
      keys: new Set(),
    }
    const interval = event.altKey
      ? 48
      : studioGridInterval(
          draft.zoom,
          project.ruler === 'bars' ? project.tempoBpm : undefined,
        )
    const direction = event.key === 'ArrowLeft' ? -1 : 1
    draft.offset += direction * interval * (event.shiftKey ? 10 : 1)
    const duration = clip.sourceOutFrame - clip.sourceInFrame
    const rawFrame = Math.round(draft.original.startFrame + draft.offset)
    const startFrame = Math.max(
      0,
      Math.min(Number.MAX_SAFE_INTEGER - duration, rawFrame),
    )
    if (startFrame !== rawFrame)
      draft.offset = startFrame - draft.original.startFrame
    draft.preview = { ...draft.original, startFrame }
    draft.keys.add(event.key)
    options.previewClip(draft.preview)
    return finishStudioKey(event)
  }

  function keyUp(event: KeyboardEvent): boolean {
    sync()
    if (draft === null || !draft.keys.has(event.key)) return false
    draft.keys.delete(event.key)
    if (draft.keys.size > 0) return finishStudioKey(event)
    const completed = draft
    cancel()
    if (completed.preview.startFrame !== completed.original.startFrame) {
      options.dispatch({
        type: 'move-clip',
        clipId: completed.original.id,
        trackId: completed.original.trackId,
        startFrame: completed.preview.startFrame,
      })
    }
    return finishStudioKey(event)
  }

  return { keyDown, keyUp, cancel, sync, active: () => draft !== null }
}
