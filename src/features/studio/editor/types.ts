// Studio keyboard contracts — transient previews and focus remain outside durable project data.
import type { StudioCommand } from '@/lib/studio/model/commands'
import type { StudioClip, StudioProject } from '@/lib/studio/model/types'

export interface StudioEditorOptions {
  project(): StudioProject | null
  writable(): boolean
  playheadFrame(): number
  pixelsPerSecond(): number
  dispatch(command: StudioCommand): boolean
  selectClip(id: string | null): void
  previewClip(clip: StudioClip | null): void
  announce(message: string): void
  focusClip?(clipId: string | null, trackId: string): void
  clipboardChanged?(ready: boolean): void
  createId?(): string
}

export interface StudioEditorFocus {
  clipId: string | null
  trackId: string
  header: boolean
}

export function finishStudioKey(event: KeyboardEvent): true {
  event.preventDefault()
  event.stopPropagation()
  return true
}
